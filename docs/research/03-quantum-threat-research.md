# Quantum threat to existing chains — research notes (2026-11-21)

## Headline numbers (sources differ by method; treat as approximate)
- Glassnode (Oct 2026): ~6.26M BTC (~31.2% of supply) in quantum-exposed addresses; ~4.33M of it from address reuse.
- Project Eleven live tracker: ~6.93M BTC vulnerable.
- Quantum Alliance: ~6.04M BTC. EU regulators (Sep 2026): ~6.9M BTC ≈ $586B.
- Coinbase split: ~1.7M BTC in ~20k legacy P2PK outputs + ~5M BTC whose key was revealed by a spend.
- Satoshi-attributed: >1.1M BTC, mostly P2PK.

## Progress of quantum attacks
- Apr 2026: Project Eleven's 1-BTC Q-Day Prize won for breaking a 15-bit ECC key on public quantum hardware (toy size, 512× jump).
- Mar 2026: Google Quantum AI estimated ~1,200 logical qubits could break 256-bit ECC (down from earlier, much higher estimates).
- Ethereum Foundation: a cryptographically relevant quantum computer is not believed imminent — but planning targets ~2029.

## Bitcoin's fix status
- BIP-360 (P2MR — pay-to-Merkle-root, drops Taproot key path): **Draft**, merged in BIP repo Mar 2026, no activation plan.
  Adds no PQ signature scheme itself. BIP-361 also draft.
- → Bitcoin users have **no protocol-level PQ option today**.

## Ethereum's fix status
- EF Post-Quantum team formed Jan 2026 (pq.ethereum.org).
- EOA path: account abstraction (EIP-8141, considered for Hegotá H2 2026); core PQ infra targeted ~2029, not guaranteed.
- ethereum.org: "when an account sends a transaction, its public key is exposed onchain"; receive-only accounts expose only the hash.
- → Ethereum users have **no PQ EOA option today**.

## Why this matters for QoreChain
QoreChain already enforces hybrid ML-DSA-87 signatures on mainnet and testnet (verified via chain params). It is one of the
few places an at-risk holder can hold value under PQ signatures **today**. Our app connects that fact to each user's own exposure.

## Sources
- https://postquantum.com/quantum-threat-crypto/bitcoin-quantum-vulnerability/
- https://www.coindesk.com/tech/2026/09/24/eu-financial-watchdogs-warn-quantum-computing-poses-imminent-threat-to-blockchain-encryption
- https://www.coindesk.com/tech/2026/04/04/bitcoin-s-usd1-3-trillion-security-race-key-initiatives-aimed-at-quantum-proofing-the-world-s-largest-blockchain
- https://www.spendnode.io/blog/bitcoin-quantum-risk-626-million-exposed-glassnode-october-2026/
- https://cryptoticker.io/en/quantum-alliance-bitcoin-exposed-public-keys/
- https://cryptoslate.com/latest-quantum-computer-breaks-the-math-behind-bitcoin-headlines-massively-exaggerate-risk/
- https://www.coindesk.com/tech/2026/04/24/researcher-wins-1-bitcoin-bounty-for-largest-quantum-attack-on-underlying-tech
- https://ethereum.org/en/roadmap/security/quantum-resistance/
- https://pq.ethereum.org/
- https://raw.githubusercontent.com/bitcoin/bips/master/bip-0360.mediawiki
- https://cointelegraph.com/features/bitcoin-s-quantum-upgrade-path-what-bip-360-changes-and-what-it-does-not
- https://www.quanchain.ai/guides/bitcoin-quantum-risk-assessment-guide
- https://thequantuminsider.com/2026/07/03/qorechain-first-post-quantum-blockchain-transaction/
