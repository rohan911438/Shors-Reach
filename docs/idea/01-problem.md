# 01 — The problem

## In one sentence
Millions of people hold crypto behind keys that a future quantum computer can break, **they cannot tell whether they are
exposed**, and the chains they use offer no post-quantum fix today.

## Why the risk is real
- Bitcoin, Ethereum and every EVM chain sign with ECDSA/Schnorr on secp256k1. Shor's algorithm breaks these given a
  large enough quantum computer.
- An attacker needs the **public key**, not the address. A key becomes public when:
  - you **spend** (Bitcoin) or **send any tx** (EVM) — the signature reveals it;
  - you use **Taproot** (`bc1p…`) — the key is in the output itself;
  - coins sit in old **P2PK** outputs (Satoshi era) — the key *is* the output;
  - you **sign a message off-chain** (permits, Sign-In-With-Ethereum, Bitcoin message signing).
- Estimates: ~6–7M BTC (~30% of supply, ~$500B+) already sit behind exposed keys (Glassnode, Project Eleven, Coinbase).
- Progress is accelerating: public demos break growing toy keys (Apr 2026); qubit estimates for 256-bit ECC keep falling
  (Google, Mar 2026: ~1,200 logical qubits). Regulators (EU, Sep 2026) call it a near-term concern.
- "Harvest now, steal later": exposed keys are public **forever**. Nothing stops an attacker from recording them today.

## Why users can't solve it today
1. **No visibility.** Wallets don't show "your key is public". Most users don't know address reuse or one Base tx exposes them.
2. **Existing tools are naive.** Address-level checkers miss the real cases (see `../architecture/02-scan-engine.md`):
   sibling address formats, P2PK outputs, cross-EVM key reuse, HD wallets, Taproot.
3. **No fix on their chain.** Bitcoin BIP-360 is a draft with no activation; Ethereum targets ~2029 for PQ accounts.

## Why QoreChain cares
QoreChain's pitch is "Build Before Q-Day" — a chain where **every native tx must carry an ML-DSA-87 signature** today.
But a pitch is abstract. QoreChain needs:
- a **personal** reason for holders on other chains to care ("*your* $X is exposed"),
- a **concrete first step** onto QoreChain,
- a **public metric** proving people are moving.

## A second, QoreChain-internal problem we found
On QoreChain, the **first** PQ key registration is the one transaction allowed with only a classical signature.
So an account that has **not yet registered** a PQ key is exactly as weak as an Ethereum account: whoever breaks the
ECDSA key first can register *their own* ML-DSA key and take the account. Most users won't know this.
**Registering early is the real protection.**
