# 04 — QoreChain integration

## Network config (testnet only for writes)
```ts
export const QORE = {
  chainId: "qorechain-diana", evmChainId: 9800,
  rest: "https://api-testnet.qore.host", rpc: "https://rpc-testnet.qore.host", evm: "https://evm-testnet.qore.host",
  explorer: "https://explore.qore.network", denom: "uqor", decimals: 6,
};
```

## Packages
| Package | Used for |
|---|---|
| `@qorechain/sdk` | REST client, hybrid tx building, `openEvmWindowMsg`, `fetchEvmWindow`, `classifyEvmWindowRejection`, bech32 helpers |
| `@qorechain/qorex-rainbowkit` (+ wagmi, viem, RainbowKit, react-query) | QoreX connect on EVM lane (comes with `viem-wagmi` template) |
| `@qorechain/qorex-cosmos-kit` or `-interchain-kit` | QoreX **native** signing (hybrid window tx) — chosen after spike |
| `@qorechain/pqc` | ML-DSA verify client-side (fallback + UI check) |
| `@qorechain/qoresign` | Message signing with PQ key (scan-hash signature) — chosen after spike |
| `@qorechain/qorex-wallet-mock` | E2E tests without a real wallet |

## The Quantum Pass transaction sequence
```
1. connect QoreX (testnet)                          → get 0x + qor1 (same 20 bytes)
2. GET /pqc/v1/account/{qor1}
     found=false → step 3 ; found=true → skip
3. Register PQ key  (classical-signed; protocol exemption; QoreX handles it)   [NOT the hybrid tx]
4. GET /pqc/v1/evm_window/{qor1}
     live with wide scope → warn ("max loss if ECDSA breaks = X")
5. Open scoped EVM window — MsgOpenEVMWindow, HYBRID-SIGNED by QoreX:          ★ track requirement
     blocks: 600 (~1h) · max_txs: 2 · max_value: 0 · allowed_targets: [QuantumPass]
6. Sign message M = keccak256(chainid, passAddr, user, scanHash) with the ML-DSA key (QoreX / qoresign)
7. EVM tx: QuantumPass.mint(scanHash, buckets…, pqPubkey, pqSig)   (secp256k1, admitted by window)
8. Show tx hashes (5 and 7) + explorer links
```
Teaching moment in UI: step 5 shows *why* a tight window matters — the same window data feeds the "max loss" estimate.

## Spike questions (answer in prompt 02, record in `architecture/spikes.md`)
1. How does a dApp ask QoreX to sign a **native** hybrid tx (which kit, which call)?
2. Can QoreX sign `MsgOpenEVMWindow`, or only bank sends? (Fallback: hybrid self-send of 1 uqor with memo = scanHash.)
3. How does a dApp get an **ML-DSA signature over arbitrary bytes** from QoreX (`signArbitrary`-like)? (Fallback: the hybrid tx itself carries the ML-DSA signature; contract checks key status only.)
4. Exact ABI of precompiles `0x0A01` / `0x0A02`.
Sources to read: `github.com/qorechain/build-before-qday` (workshops 1–2), `github.com/qorechain/qorechain-sdk`, `@qorechain/qorex-types`, docs `/qorex`.

## Error handling
- Map EVM rejections with `classifyEvmWindowRejection(err)` → human messages: "no PQ key" / "no window" / "window exhausted" / "target not allowed".
- Faucet guidance when balance < 0.5 QOR (link to dashboard faucet; no faucet API exists).
- Never retry a key registration automatically (second, different key is refused **after** the fee).
