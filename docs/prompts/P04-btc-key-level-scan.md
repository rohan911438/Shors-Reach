# P04 — Bitcoin key-level scan  (target: 23–24 Nov)

## Goal
Implement the differentiators: public-key extraction from spends, sibling-format derivation, P2PK lookup, multisig
cosigners, and xpub wallet scanning.

## PROMPT
```
Read: architecture/02-scan-engine.md §1 (traps + algorithm), §6 fixtures.

Task P04 — key-level BTC:
1. btc/pubkeys.ts: extract public keys from inputs that spend a given address:
   - P2PKH: last push of scriptSig; - P2WPKH: witness[1]; - P2SH-P2WPKH: witness[1] (redeemScript = 0014<hash>);
   - P2SH / P2WSH multisig: parse redeem/witness script, extract all pubkeys (OP_m <pk…> OP_n OP_CHECKMULTISIG).
   Verify every extracted key hashes back to the address (HASH160 / script hash) — discard mismatches.
2. btc/siblings.ts: from a pubkey (compressed or uncompressed; derive the other form with @noble/secp256k1) produce:
   P2PKH(c), P2PKH(u), P2WPKH, P2SH-P2WPKH addresses and P2PK(c), P2PK(u) scripthashes (sha256 of script, NOT reversed).
3. btc/scan.ts: full algorithm from the spec. Deduplicate holdings by script. Each EXPOSED_NOW holding carries
   evidence { txid of the revealing spend, url: https://mempool.space/tx/<txid> }.
   Optional input: a raw pubkey (hex) → scans all 6 forms (this is how Satoshi's P2PK coins are found).
4. btc/xpub.ts: parse xpub/ypub/zpub (@scure/bip32), derive receive (0/i) and change (1/i) with gap limit 20,
   address type by prefix (xpub→p2pkh, ypub→p2sh-p2wpkh, zpub→p2wpkh); scan all; aggregate; cap 200 addresses.
   The xpub never leaves this module (no logging).
5. UTXO >500 fallback: use chain_stats sums and mark amount "approximate".
6. Fixtures + tests:
   - genesis pubkey → P2PK(u) scripthash 3318537dfb…0474 ≈ 50.01 BTC EXPOSED_NOW
   - a P2PKH address that has spent and still holds coins → EXPOSED_NOW with evidence
   - a key that spent via bc1q while its 1… sibling holds coins → sibling EXPOSED_NOW
   - a 2-of-3 P2WSH that has spent → 3 cosigner keys extracted
   - a test xpub (BIP-84 test vector) → derivation matches the spec's published addresses
   - pubkey/hash mismatch is discarded

Run the VALIDATION GATE and report.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | All scan tests pass offline | `npx vitest run src/scan` |
| 2 | Genesis P2PK fixture ≈ 50.01 BTC EXPOSED_NOW | test |
| 3 | Sibling exposure test passes | test |
| 4 | BIP-84 derivation vectors match | test |
| 5 | Every EXPOSED_NOW has evidence | property test over all fixtures |
| 6 | Live: `npm run scan:live -- <genesis pubkey hex>` | output pasted |
| 7 | Live: `npm run scan:live -- <a public zpub test wallet>` completes < 30 s | timing pasted |

## IF THE GATE FAILS
```
P04 gate failed on: <items>. For parsing bugs, add the failing tx as a fixture first, then fix. Re-run gate.
If xpub is not stable by end of 24 Nov, move it to BACKLOG (cut list #3) and continue.
```

## Hand-off to P05
Tag `p04-done`.
