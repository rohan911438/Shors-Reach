# Research — QoreChain Developer Fest & QoreChain tech (collected 2026-11-21)

> Source pages: build.qorechain.io (/, /rules, /prizes, /start, /faq, /projects, /feed, /kits), docs.qorechain.io
> (build-before-qday, sdk/quickstart, developer-tools/mcp, dashboard/faucet, architecture/*), github.com/qorechain.
> The site states rules/prizes "are not final and may still change until the end of the event" — re-check before submitting.

## 1. The event
- **Name:** QoreChain Developer Fest — "Build Before Q-Day" (QoreChain Association). Prize pool $20,000, 61 prizes.
- **Building window:** 4 Nov → **2 Dec 2026 23:59 UTC**. At the deadline the project page becomes read-only; that version is checked.
- **Checks:** 3–5 Dec · **Judging:** 6–15 Dec · **People's Choice vote:** 6–15 Dec (QoreX on mainnet) · **Winners:** 16 Dec (live demo show)
- **Payouts:** stablecoin 17–22 Dec; follow-on QOR grants from Jan 2027.
- **Workshop still upcoming:** 27 Nov 2026 16:30 UTC "Protocol building and submission clinic" (luma.com/rli48c3m).
- Fest stats seen: 115 projects, ~381 registered builders.

## 2. Category bounties
| Category | Team | Prizes | Main requirements |
|---|---|---|---|
| **Quantum Pass** | 1–2 | 10×$150 (jury) + 20×$50 raffle = $2,500 | create-qorechain-dapp, connect QoreX, deploy on testnet, one hybrid-signed tx |
| Post-Quantum dApp | 1–3 | $1,500/$750/$500 | scoped EVM window, pqcVerify, two-stage QCAI audit, Foundry/Hardhat tests |
| Post-Quantum AI Agents | 1–4 | $1,500/$750 | scoped EVM window, tx/value/duration/target limits, smart-account spend rules, authenticated messaging |
| Encrypted Apps | 1–4 | $1,500/$750 | ML-KEM-1024, registered recipient keys, ML-DSA key binding, client-side enc/dec |
| Cross-VM | 1–4 | TBA | EVM contract atomically calls approved Native contract |
| Protocol Builders | 2–4 | $3,000/$1,500 | ML-DSA-signed batches, withdrawal, settlement receipt, watchtower, ML-KEM, threat model |

Quantum Pass raffle: drawn among passing QP projects that did not win $150; one entry each; drand randomness; public script; 10 reserves.

## 3. Special awards
| Award | Prize | Condition |
|---|---|---|
| Q-Day Survivor | 5×$200 | Q-Day Drill ranking — **drill ran 18 Nov; closed** |
| People's Choice | $500/$300/$200 | community vote 6–15 Dec |
| Best AI-Native Build | $500 | tick AI-native option + `AI_USAGE.md` in repo |
| Quantum Campus | $500 | every team member enrolled as a student (proof by email) |
| Regional Awards | 5×$200 | Europe, Americas, MEA, APAC, Türkiye — **not if you win another prize** |
| Top-Quality Awards | 7×$250 | ≥70/100 from jury, all checks passed, **no other prize won** |

## 4. Eligibility & registration
- 18+, one GitHub account per person, every team member registers individually.
- Registration complete when **GitHub + X + QoreX testnet address** are connected.
- If the wallet's PQ key isn't registered, a proof tx is sent (~0.1 test QOR fee).
- Removal for spam, vote manipulation, multiple accounts, copied work.

## 5. Submission checklist (no submit button)
- Public GitHub repo, **MIT or Apache-2.0** licence file detected by GitHub
- README
- **Video ≤ 3 min (required)**
- Cover image 16:9, ≥1200×675, JPG/PNG/WebP, ≤5 MB (optional, auto-generated otherwise)
- ≥1 testnet address (qor1…)
- Kits + network features used declared
- **Install the "QoreChain Build GitHub App"** on the repo
- One category; description + "How it's made"
- Checks: commits made during the fest; every member registered; kits detected.
- Kits auto-verified from dependency files + on-chain txs ("Verified" beats "Declared");
  create-qorechain-dapp + Solidity PQC verify checked manually by jurors.

## 6. Network
| | Testnet (diana) | Mainnet (vladi) |
|---|---|---|
| Chain ID | qorechain-diana | qorechain-vladi |
| EVM chain ID | **9800** | 9801 |
| REST | https://api-testnet.qore.host | https://api.qore.host |
| RPC | https://rpc-testnet.qore.host | https://rpc.qore.host |
| EVM RPC | https://evm-testnet.qore.host | https://evm.qore.host |
Token QOR / uqor, 6 decimals. Explorer https://explore.qore.network. Faucet https://dashboard.qorechain.io/faucet
(100 QOR / 24h per account+address, sign-in, qor1 only; also fUSD/fETH/fBTC fest tokens).

## 7. QoreChain tech essentials
- Cosmos SDK L1, EVM + CosmWasm (+ SVM disabled), cross-VM messaging.
- PQC: **ML-DSA-87** (pk 2,592 B, sig 4,627 B), **ML-KEM-1024**, SHAKE-256.
- Native txs **must** be hybrid (secp256k1 + ML-DSA-87 extension). Only exemption: first PQ key registration (classical).
- EVM lane: plain secp256k1 tx, but sender needs a registered ML-DSA key **and** an open EVM window (MsgOpenEVMWindow),
  else refused (codespace pqc, codes 26/27/28). EVM lane needs a coin-type-60 key (deriveUnifiedAccount / deriveEvmAccount).
- Window bounds: blocks 1–17,280; max-txs 1–1,000; max-value (uqor); scopes --native-only / --allowed-targets.
- Precompiles (testnet only): `0x…0A01` ML-DSA-87 verify, `0x…0A02` PQ key status.
- `BLOCKHASH` returns 0 on diana. `qor_` JSON-RPC namespace not served. Max 30M gas/EVM tx.
- QCAI: rate limit 600 tx/min/sender, anomaly flagging only.

## 8. Kits (versions on kits page)
`create-qorechain-dapp` 0.14.0 (templates: evm-solidity, fullstack-web, rollup-app, foundry, hardhat, **viem-wagmi**, cosmwasm) ·
`@qorechain/sdk` 0.14.0 · `@qorechain/react` · `@qorechain/evm` · `@qorechain/pqc` 0.2.3 · `@qorechain/qoresign` 0.2.0
(Sign-In With QoreChain, message signing) · `@qorechain/qoreseal` 0.1.0 · `@qorechain/qorex-rainbowkit` / `-cosmos-kit` /
`-interchain-kit` / `-types` / `-wallet-mock` / `-synpress` 0.1.0 · `@qorechain/wallet-adapter` 0.6.0 · `@qorechain/handles` ·
`@qorechain/mcp` 0.1.x (14 read-only tools) · `@qorechain/qorescan` (CBOM) · `@qorechain/chain-bridge` · `@qorechain/asset-kit`.

Hybrid send (condensed from SDK quickstart):
```ts
import { createClient, deriveNativeAccount, directSignerFromPrivateKey,
  derivePqcCanonical, ensurePqcRegistered, toBase } from "@qorechain/sdk";
const client = createClient();                               // testnet default (0.12+)
const account = await deriveNativeAccount(mnemonic);
const signer = await directSignerFromPrivateKey(account.privateKey, "qor");
const pqcKeypair = derivePqcCanonical(account.address, mnemonic);
const tx = await client.connectTx(signer, { pqcKeypair });
await ensurePqcRegistered(tx, { pqcKeypair, rest: client.network.endpoints.rest,
  fee: { amount: [{ denom: "uqor", amount: "60000" }], gas: "600000" } });
const res = await tx.bankSend("qor1…", [{ denom: "uqor", amount: toBase("1.5") }]);
```
Gotchas: register PQ key once (a second, different key is refused **after** fee is taken); pass `rest` to signer;
SDK ≥0.6.1 required; docs samples use localhost/9801 → use testnet/9800.

Example code: github.com/qorechain/build-before-qday (workshop 1 hybrid tx; workshop 2 PQ-gated contract + agent limits;
workshop 3 QoreSeal + cross-VM).

## 9. Live endpoint tests (2026-11-21, all OK)
- `GET api-testnet.qore.host/qorechain/pqc/v1/params` → `hybrid_signature_mode: required`, `allow_classical_fallback: false`, `min_security_level: 5`
- `GET …/pqc/v1/account/{qor1}` → `{found, account}`
- `GET …/pqc/v1/evm_window/{qor1}` → `found, live, max_txs, used_txs, max_value, remaining_*, native_only, allowed_targets…`
- EVM RPC `eth_chainId` → `0x2648` (9800)
