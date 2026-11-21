# 03 — Smart contract: `QuantumPass.sol`

Scaffolded from `create-qorechain-dapp --template foundry` into `contracts/`. Solidity 0.8.24, deployed to qorechain-diana (EVM chain ID 9800).

## Purpose
A **soulbound** (non-transferable, ERC-5192-style) pass proving that an account:
1. has a registered ML-DSA-87 key on QoreChain, and
2. signed (with that PQ key) a hash of its exposure scan.
It also keeps **public counters** that power the dashboard.

## Storage
```solidity
struct Pass {
    bytes32 scanHash;        // keccak256 of canonical anonymised scan summary
    uint8   scoreBucket;     // 0..10  (exposed % / 10) — coarse, privacy-preserving
    uint16  chainsMask;      // bit per chain where exposure was found
    uint32  exposedUsdBucket;// log-scale bucket of exposed USD (self-reported, coarse)
    uint64  mintedAt;
    bytes32 pqKeyHash;       // keccak256 of the ML-DSA public key used
}
mapping(address => Pass) public passOf;
uint256 public totalPasses;
uint256 public totalExposedUsdBucketsSum;  // for "≈$X now protected" display
mapping(uint8 => uint256) public passesByBucket;
event PassMinted(address indexed holder, bytes32 scanHash, uint8 scoreBucket, uint16 chainsMask, uint32 exposedUsdBucket);
```

## `mint(...)` checks (in order)
1. `passOf[msg.sender].mintedAt == 0` (one pass per account; `refresh()` allowed later as stretch).
2. **PQ key registered:** staticcall key-status precompile `0x…0A02` for `msg.sender` → must be registered.
3. **PQ signature:** staticcall ML-DSA-87 verify precompile `0x…0A01` with (pubkey 2,592 B, message = `keccak256(abi.encode(chainid, address(this), msg.sender, scanHash))`, signature 4,627 B) → must be valid.
   Also check `keccak256(pubkey)` equals the registered key's hash if the status precompile exposes it.
4. Store pass, bump counters, emit event.
5. `transferFrom`/`approve` revert (`Soulbound()`), `locked(id) = true`.

> **Spike required (prompt 07):** exact ABI/encoding of `0x0A01` and `0x0A02` is not in the docs we read. Source of truth =
> github.com/qorechain/build-before-qday (workshop 2 "PQ-gated contract") and `qorechain-core` precompile code.
> **Fallback if 0x0A01 can't be used in time:** keep check 2 (0x0A02 status) and verify the ML-DSA signature client-side
> (`@qorechain/pqc` `pqcVerify`) + store signature hash; README states this honestly.

## Gas
ML-DSA-87 calldata ≈ 7.2 KB (pk + sig). Within the 30M gas/tx cap. Measure in tests; record numbers in README.

## Tests (Foundry)
| Test | Expect |
|---|---|
| mint happy path (precompiles mocked via `vm.etch`) | pass stored, counters bumped, event |
| mint twice | revert `AlreadyMinted` |
| key not registered | revert `PqKeyNotRegistered` |
| bad signature | revert `BadPqSignature` |
| transfer / approve | revert `Soulbound` |
| counters across 3 minters | correct sums |
| fuzz scoreBucket/chainsMask bounds | reverts out of range |
Plus one **live** script test on diana (`forge script … --broadcast`) recorded in README.

## Deployment
1. Deployer account: registered PQ key + open EVM window (allowed target: none needed for CREATE; window `max-txs` ≥ 3).
2. `forge create` / `forge script` with `--rpc-url https://evm-testnet.qore.host --chain 9800`.
3. Record address + tx hash in `deployments/diana.json` and README.
