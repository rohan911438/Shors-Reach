# Accuracy benchmark — key-level scan vs single-address check

Run 2026-11-22T07:04:36.134Z · live chain data · `npx tsx scripts/benchmark.ts`

**Baseline** = the rule single-address checkers use: one address, exposed only if it has spent (BTC) or has an Ethereum nonce > 0 (EVM).
**Shor's Reach** = full engine: sibling forms of the key, P2PK, Taproot output keys, xpub gap scan, 8 chains, evidence per row.

| Case | Baseline verdict | Baseline exposed value | Shor's Reach exposed value | Exposed rows (with evidence) | Chains with funds | Scan time |
|---|---|---|---|---|---|---|
| HD wallet (BIP-84 test zpub) | Exposed (90 spends on this address) | n/a | **$0** | 0 (0) | 0 | 38.6 s ⚠ mempool.space down |
| Satoshi's genesis key | **Safe** (0 spends on this address) | $0 | **$6.35M** | 4 (4) | 1 | 7.4 s |
| Taproot address | **Safe** (0 spends on this address) | $0 | **$156** | 1 (1) | 1 | 4.4 s |
| Exchange cold wallet (reused P2SH) | Exposed (451 spends on this address) | 14.66B | **14.66B** | 1 (1) | 1 | 10.0 s |
| vitalik.eth (EVM) | Exposed (Ethereum nonce 5971) | $9.6K | **$15.5K** | 8 (8) | 7 | 4.6 s |

## Summary

- Cases where the baseline says **safe** but funds are provably exposed: **2 / 5** (Satoshi's genesis key, Taproot address).
- Exposed value found (non-control cases): baseline **$9.6K** vs Shor's Reach **$6.37M** (662.1×).
- Exposed rows backed by a linked on-chain transaction or output: **14 / 14**.

## Why each case matters

- **HD wallet (BIP-84 test zpub)** — A wallet is many addresses; checking one misses the rest.
- **Satoshi's genesis key** — Famous address never spent, but the key sits in a P2PK output since block 0.
- **Taproot address** — P2TR writes the output key on-chain; exposed on receipt, spent or not.
- **Exchange cold wallet (reused P2SH)** — Control case: reuse after spending is exposed under both methods.
- **vitalik.eth (EVM)** — Baseline checks Ethereum only; the same key holds value on 7 more chains.

Notes: the baseline is given the address a holder would most likely paste; USD uses the same CoinGecko price for both columns. Values move with chain state and prices.
