# Project page — copy-paste

**Name:** Shor's Reach
**Category:** Quantum Pass · ☑ AI-native
**Tagline:** See your crypto the way a quantum attacker sees it — then lock your QoreChain account before they can.

## Description (≤ 600 chars)

Shor's Reach scans Bitcoin, 7 EVM chains and QoreChain at the key level — not the address — and shows what a quantum computer could attack today, with the transaction that proves each verdict. It catches what address checkers miss: Satoshi-era raw-key coins, Taproot, sibling address forms, cross-chain key reuse. An AI advisor turns it into a calm plan from an anonymised summary. Then you mint a soulbound Quantum Pass on QoreChain, proven by a hybrid secp256k1 + ML-DSA-87 transaction and bound to your registered post-quantum key.

## How it's made

- `create-qorechain-dapp` scaffold: `viem-wagmi` (Vite, React, wagmi, RainbowKit + QoreX) and `foundry` templates — first commit untouched.
- Scan engine in TypeScript, runs in the browser: mempool.space Esplora, 7 public EVM RPCs, QoreChain REST (PQC account + EVM window), CoinGecko. 7 sibling forms per key, P2PK by script hash, xpub gap-limit scan, evidence invariant.
- `QuantumPass.sol`: soulbound (ERC-5192). `mint()` verifies ML-DSA-87 on-chain with the `pqcVerify` precompile (0x0a01) against the key from `pqcKeyStatus` (0x0a02). `attest()` serves QoreX users: their proof is a hybrid-signed native self-transfer whose memo commits to the pass; the contract re-checks the registry and burns the proof.
- AI advisor: Claude Opus 5.5, structured JSON output, zod validation in and out, identifier leak filters, deterministic fallback.
- 105 app tests + 18 Foundry tests (fuzz + attack cases); CI on GitHub Actions. Built with Claude Code through a gated P01→P13 plan.

## Kits & network features actually used

- `create-qorechain-dapp` (viem-wagmi, foundry)
- `@qorechain/qorex-rainbowkit`, `@qorechain/qorex-types` (native `enable` / `getKey` / `signAndBroadcast`)
- `@qorechain/sdk` (unified account, `EthNativeSigner` hybrid signing, `openEvmWindowMsg`, `buildRegisterPqcKeyMsg`, `signProofOfPossession`, `pqcSign`)
- `@qorechain/evm` (`evmWindowStatus`, chain definitions)
- QoreChain features: hybrid signatures (`PQCHybridSignature`), PQC key registry, EVM windows, precompiles `pqcVerify` 0x0a01 and `pqcKeyStatus` 0x0a02

## Testnet (qorechain-diana, EVM 9800)

- QuantumPass: `0x4f54b69693458523223504b48fa7cd44657a56df`
- Deploy tx: `0x28f58054f338364083b4f0c9b17751dbdd1df0b27c42974c6d6a553fe7e17e2e`
- Hybrid-signed txs: `82CAAC0311B6927598BBD789BFD250CE236DD6DD0B241CB444B511CFE74A1104` (EVM window), `926E749DC6C1641ADDF6E87158E836C48084B0528707EC6D2B6849CCE56FE55F` (pass proof)
- Mints: `0xb6ac662a1d2618febcc1e20ad337776b1a9af89a37a00d8a63b38ce3e5b4a38d` (on-chain ML-DSA verify), `0x872179a1355536531bd3f496b297e8d67d6b6ee86813131e38d5d42b739a2f60` (attest)

## Links

- Repo: https://github.com/rohan911438/Shors-Reach
- Live demo: _Vercel URL_
- Video: _link_
