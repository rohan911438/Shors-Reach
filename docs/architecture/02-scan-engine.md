# 02 — Scan engine (the core)

## 0. Principle
A quantum attacker (Shor) attacks a **public key**, not an address. An address is only a hash of a key.
The scan is **key-centric**: find every place a key has been revealed, then every coin that key controls,
in every script format and on every chain where that key lives.

Two attack classes, scored separately:
| Class | Meaning | Attacker's time window |
|---|---|---|
| **Long-exposure** → `EXPOSED_NOW` | Key already public at rest | Unlimited |
| **Short-exposure** → `EXPOSED_ON_SPEND` | Key hidden; revealed when spending (tx in mempool) | BTC ≈ 10 min · ETH ≈ 12 s |

## 1. Bitcoin rules
| Script type | Prefix | Key public at rest? | Becomes exposed when |
|---|---|---|---|
| P2PK | (no address) | **Yes, always** | funded |
| P2PKH | `1…` | No (HASH160) | any spend by the same key (any sibling format) |
| P2WPKH | `bc1q…` (42 chars) | No | same |
| P2SH-P2WPKH | `3…` | No | same |
| P2SH / P2WSH multisig | `3…` / `bc1q…` (62) | No | after a spend → **all cosigner keys** revealed (scan each) |
| P2TR (Taproot) | `bc1p…` | **Yes, always** (32-byte output key in scriptPubKey, BIP-341) | funded |

### Traps naive scanners miss (our differentiators — each needs a test)
1. **Sibling formats share one key.** One key → P2PKH (compressed), P2PKH (uncompressed), P2WPKH, P2SH-P2WPKH, P2PK (compressed), P2PK (uncompressed).
   A spend from *any* exposes *all*. → Recover the pubkey from any spend, derive all six, scan each.
2. **P2PK outputs have no address.** Verified live: Satoshi's `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa` shows `spent_txo_count: 0`
   (looks safe) but the genesis key's P2PK scripthash `3318537dfb3135df9f3d950dbdf8a7ae68dd7c7dfef61ed17963ff80f3850474`
   holds ~50.01 BTC in 19 UTXOs. Lookup = `GET /api/scripthash/{sha256(script) hex, NOT byte-reversed}`.
3. **Address ≠ wallet.** HD wallets spread coins across receive + change chains. → Accept xpub/ypub/zpub; derive
   `m/0/i` and `m/1/i` client-side with gap limit 20; scan each address; aggregate.
4. **Taproot is worst for long-exposure** despite being newest.
5. **Off-chain signatures** (message signing, some PSBT/Lightning flows) are invisible → `UNKNOWN` + questionnaire.

### BTC algorithm
```
scanBtcAddress(addr):
  type = classify(addr)                                  # p2pkh | p2wpkh | p2sh | p2wsh | p2tr
  stats = esplora.address(addr)                          # funded/spent counts + sums
  balance = funded_sum - spent_sum
  if type == p2tr:            return EXPOSED_NOW(balance, reason="taproot-output-key", evidence=first funding tx)
  pubkeys = []
  if stats.spent_txo_count > 0:
     txs = esplora.addressTxs(addr)                      # paginate
     pubkeys = extractPubkeysFromInputs(txs, addr)       # scriptSig (P2PKH) / witness[1] (P2WPKH) / redeem+witness script (multisig)
  if pubkeys.empty: return EXPOSED_ON_SPEND(balance, reason="hash-hidden")
  for pk in pubkeys:
     for sib in siblings(pk):                            # 6 forms
        s = esplora.address(sib) or esplora.scripthash(sha256(p2pkScript(pk)))
        add holding(sib, balance(s), EXPOSED_NOW, reason="key revealed in tx <txid>", evidence=txid)
  return holdings (deduplicated by script)
scanXpub(xpub): derive receive/change with gap limit 20 → scanBtcAddress each → aggregate
```

## 2. Ethereum / EVM rules
- Any signed tx lets anyone recover the pubkey (ecrecover). **nonce > 0 ⇒ key exposed.**
- **Same key on every EVM chain.** Verified: vitalik.eth nonce `0x1752` on Ethereum, `0x46` on Base.
  → Query `eth_getTransactionCount` + `eth_getBalance` on: Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche, QoreChain EVM.
  If nonce > 0 on **any** chain → all balances on **all** chains are `EXPOSED_NOW` (evidence: the chain + nonce; stretch: first tx hash via explorer API).
- **Off-chain signatures** (permit / EIP-712 / SIWE / personal_sign) can expose a nonce-0 key → `UNKNOWN` unless questionnaire answered "never".
- **Smart-contract wallets** (`eth_getCode` ≠ `0x`): try Safe `getOwners()`; scan each owner; wallet status = worst owner status. Unknown contract type → `UNKNOWN`.
- **EIP-7702 delegated EOAs** (code starts `0xef0100`): treat as EOA (ECDSA key still root).
- Value: native balance per chain × price. Stretch: top ERC-20s (USDC/USDT/WETH) via `balanceOf`.

## 3. QoreChain rules (why migrating helps)
Verified params (`/qorechain/pqc/v1/params`): `hybrid_signature_mode: required`, `allow_classical_fallback: false`, `min_security_level: 5`.
- **Native lane:** breaking ECDSA is not enough; ML-DSA-87 signature also required → `PROTECTED`.
- **EVM lane:** secp256k1-only txs accepted only inside an open window. Max loss if ECDSA breaks =
  window scope (`remaining_value`, `remaining_txs`, `remaining_blocks`, `allowed_targets`, `native_only`) from
  `GET /qorechain/pqc/v1/evm_window/{qor1}` (verified, returns all fields).
- **Unregistered account = as weak as Ethereum.** The first PQ key registration is the one classical-only tx, so
  whoever breaks ECDSA first can register their own key. → status `EXPOSED_NOW` with reason "pq-key-not-registered".
- `GET /qorechain/pqc/v1/account/{qor1}` → `found`, key info, `possession_proven`.
- 0x ⇄ qor1: same 20 bytes, bech32 with HRP `qor` (verified: `0xd8dA…6045` ⇄ `qor1mrdxhunfvjhe6lhdncp72dq46da2jcz9ew85sn`).

## 4. Output model
```ts
type Status = "EXPOSED_NOW" | "EXPOSED_ON_SPEND" | "PROTECTED" | "UNKNOWN";
interface Holding {
  chain: "bitcoin" | "ethereum" | "base" | … | "qorechain";
  format: "p2pk" | "p2pkh" | "p2wpkh" | "p2sh-p2wpkh" | "p2sh" | "p2wsh" | "p2tr" | "eoa" | "safe" | "qore-native" | "qore-evm";
  locator: string;                 // address or script hash (never sent to server)
  amount: string; asset: string; usd: number | null;
  status: Status; reason: ReasonCode; evidence?: { txid?: string; url: string; note?: string };
}
interface ScanResult { holdings: Holding[]; totals: Record<Status, number>; score: number; sources: SourceHealth[]; scannedAt: string; }
```
- **Headline score** = value-weighted % of USD in `EXPOSED_NOW` (0–100, higher = worse); show also ON_SPEND and UNKNOWN %.
- If USD unknown → fall back to count-weighted and label it.
- Every `EXPOSED_NOW` row must carry evidence. Rule: **no evidence → not EXPOSED_NOW** (prevents false alarms).
- `ReasonCode` maps 1:1 to a paragraph in the methodology page.

## 5. Verified data sources
| Need | Endpoint | Status |
|---|---|---|
| BTC address stats | `https://mempool.space/api/address/{a}` | ✅ tested |
| BTC address txs (pubkey extraction) | `…/address/{a}/txs` (+ `/txs/chain/{last_txid}` paging) | to wire |
| BTC P2PK by key | `…/scripthash/{sha256}` | ✅ tested |
| BTC UTXOs | `…/address/{a}/utxo` — errors >500 UTXOs → fall back to chain_stats sums | ⚠️ limit |
| EVM nonce / balance / code | publicnode RPCs (e.g. `https://ethereum-rpc.publicnode.com`, `https://base-rpc.publicnode.com`) | ✅ tested |
| QoreChain PQ key | `https://api-testnet.qore.host/qorechain/pqc/v1/account/{qor1}` | ✅ tested |
| QoreChain EVM window | `…/qorechain/pqc/v1/evm_window/{qor1}` | ✅ tested |
| QoreChain params | `…/qorechain/pqc/v1/params` | ✅ tested |
| Prices | `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,…&vs_currencies=usd` | ✅ tested |
Rate limits: queue requests (max ~4 concurrent per host), cache per session, exponential backoff ×2.

## 6. Test fixtures (must exist before UI work)
| Fixture | Expected |
|---|---|
| `1A1zP1…DivfNa` + genesis pubkey | P2PKH balance + P2PK 50.01 BTC → EXPOSED_NOW (P2PK) — and the limit note for address-only input |
| A spent-from P2PKH address with remaining balance | EXPOSED_NOW, evidence = spending txid |
| Fresh P2WPKH never spent | EXPOSED_ON_SPEND |
| Any `bc1p…` with balance | EXPOSED_NOW (taproot-output-key) |
| P2WPKH key that spent → sibling P2PKH has coins | sibling flagged EXPOSED_NOW |
| vitalik.eth | nonce > 0 on ETH & Base → all EVM balances EXPOSED_NOW |
| Fresh EVM address (nonce 0 everywhere) | UNKNOWN-offchain or EXPOSED_ON_SPEND (per questionnaire) |
| Unregistered qor1 | EXPOSED_NOW (pq-key-not-registered) |
| Registered qor1 + no window | PROTECTED |
Unit tests use recorded JSON responses (no network); a separate `npm run test:live` hits real APIs.

## 7. Known limits (go into README)
- Keys revealed only via P2PK whose address never spent can't be found from the address alone → bundle known early P2PK keys (stretch).
- Off-chain signatures invisible → UNKNOWN.
- Custodial/exchange addresses: reported, user can't migrate keys.
- Diagnosis only: never moves funds; never asks for seeds or private keys.
