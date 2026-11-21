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

## P07 — PQC precompiles (2026-11-21)

| Question | Answer | Status |
|---|---|---|
| Active on diana? | `/cosmos/evm/vm/v1/params.active_static_precompiles` = `0x…0901`, `0x…0C01`, `0x…0a01`, `0x…0a02` | CONFIRMED |
| `pqcVerify(bytes pubkey, bytes signature, bytes message) → bool` at `0x…0a01` | Correct ML-DSA-87 sig over a 32-byte digest → `true`; wrong message → `false`. Direct call ≈ 312k gas | CONFIRMED (tested) |
| `pqcKeyStatus(address)` at `0x…0a02` | Returns **4 words**: `(bool registered, uint8 algorithmId, bytes pubkey, uint256)`; the SDK's 3-output `IQORE_PQC_ABI` fails to decode in viem. Solidity `abi.decode(ret,(bool,uint8,bytes))` works | CONFIRMED — SDK bug worth reporting |
| Address literals | SDK exports mixed-case `0x…0A01` which viem and solc reject as bad checksums → use lowercase | CONFIRMED |
| Signing | `pqcSign(secretKey, digestBytes)` from `@qorechain/sdk` (deterministic FIPS-204) | CONFIRMED |
| Design decision | QuantumPass reads the **registered** key from 0x0a02 and verifies with 0x0a01 → caller can't use a throwaway key | DONE |
| Deployed | `QuantumPass` `0x6e48187e3717af4ccf6c9c27716c5d77d7af5c5d`, first mint `0x6914aca7…3cc8` (gasUsed 1,000,000) | DONE |

## P10 — QoreX capabilities and the pass path (2026-11-21)

| Question | Answer | Status |
|---|---|---|
| Can a dApp get EVM txs or arbitrary signatures from QoreX? | **No (QoreX 0.3.x).** EVM provider answers only `eth_chainId`/`eth_accounts`/`eth_requestAccounts`/`wallet_switchEthereumChain`; `signArbitrary` is refused. Native `signAndBroadcast` works and always adds the ML-DSA-87 layer. PQ key registration is wallet-only. (`@qorechain/qorex-types` docs) | CONFIRMED |
| Consequence | A QoreX user cannot call `QuantumPass.mint()` (needs an EVM tx + ML-DSA signature over a digest) | — |
| Design | **Two paths.** (1) `mint()` — fully on-chain ML-DSA verify (0x0a01) for accounts that can send EVM txs. (2) `attest()` — QoreX path: user sends a hybrid-signed native self-transfer (1 uqor) whose memo commits to the pass fields; attester verifies the committed tx (code 0, `PQCHybridSignature` alg 1, self-transfer, memo) and calls `attest()`; contract re-reads the key registry (0x0a02), binds `pqKeyHash`, burns the proof hash. Attester is immutable, no admin. | DONE |
| v2 deployed | `0x4f54b69693458523223504b48fa7cd44657a56df` (deploy `0x28f58054…7e2e`, window `C584F991…3972` hybrid), self-mint `0xb6ac662a…a38d` | DONE |
| Live attest E2E (fresh account, index 1) | proof `926E749D…E55F` (hybrid, memo) → `/api/attest` → `0x872179a1…2f60`; `passOf` populated, `pqKeyHash` = registered key, `nativeTxUsed` = true, totals 2 | DONE |
| Note | One `/api/attest` call failed with a transient `fetch failed`; retry succeeded → page retries 404/502 | — |
