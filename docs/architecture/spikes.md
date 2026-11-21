# Spikes — facts learned while building

## P02 — QoreChain integration (2026-11-21)

| Question | Answer | Status |
|---|---|---|
| Hybrid native tx from code | `EthNativeSigner(account, { signMode: "hybrid", rest })` + `signAndBroadcast(StargateClient, {chainId, accountNumber, sequence, fee, messages})` from `@qorechain/sdk` 0.14 (see `contracts/scripts/window.ts`, from the create-qorechain-dapp foundry template) | CONFIRMED (tested) |
| Account derivation | `deriveUnifiedAccount(mnemonic, 0)` → m/44'/60'/0'/0/0 eth_secp256k1 key; `.evm` 0x, `.cosmos` qor1, `.pqc` ML-DSA-87 keypair derived from the same mnemonic | CONFIRMED |
| Our test account | `0x707B92f6276799f928CCe4D5873f5A2babF85347` = `qor1wpae9a38v7vlj2xvun2cw0669w4ls568zar4w8`; PQ key registered (dilithium5, key_type hybrid, possession_proven true) and matches the SDK-derived key | CONFIRMED |
| Can we sign MsgOpenEVMWindow hybrid | Yes. `openEvmWindowMsg({sender, blocks, maxTxs, maxValue})` | CONFIRMED |
| First hybrid-signed tx | `82CAAC0311B6927598BBD789BFD250CE236DD6DD0B241CB444B511CFE74A1104` (height 10499468): `/qorechain.pqc.v1.MsgOpenEVMWindow`, code 0, extension `/qorechain.pqc.v1.PQCHybridSignature {algorithm_id, pqc_signature, pqc_public_key}` | CONFIRMED |
| REST shapes | `/qorechain/pqc/v1/account/{qor1}` → `{found, account:{address, public_key(b64), algorithm_id, algorithm_name, ecdsa_pubkey, key_type, created_at_height, migration_*, classical_key_source, possession_proven}}`; `/evm_window/{qor1}` → `{found, live, opened_height, expiry_height, max_txs, used_txs, max_value, used_value, remaining_*, native_only, allowed_targets, …}` | CONFIRMED |
| Window lifetime | `blocks` is a block count; 2000 blocks expired in well under an hour → open windows right before use | CONFIRMED |
| QoreX from a dApp (native) | `@qorechain/qorex-rainbowkit` connects the EVM lane; native hybrid signing via QoreX → to be wired in P10 (`@qorechain/qorex-*` kits) | OPEN (P10) |
| Precompiles 0x0A01 / 0x0A02 ABI | — | OPEN (P07) |
| Browser access to REST | Public REST has **no CORS** → app uses `/lcd-testnet` proxy (vite dev) and a Vercel rewrite in prod | CONFIRMED (template note) |
