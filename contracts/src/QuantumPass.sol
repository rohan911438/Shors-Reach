// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title QuantumPass — a soulbound proof that an account moved under post-quantum protection.
/// @notice A pass can only be minted by an account that
///   1. has an ML-DSA-87 key registered on QoreChain (checked via the pqcKeyStatus precompile 0x0A02), and
///   2. signed the pass contents with THAT registered key (checked on-chain via the pqcVerify precompile 0x0A01).
/// The public key is read from the chain's registry, never supplied by the caller, so a pass cannot be minted
/// with a throwaway key. Passes are non-transferable (ERC-5192 "locked").
/// @dev The precompiles are active on testnet qorechain-diana only (mainnet returns empty data → mint reverts).
contract QuantumPass {
    // ------------------------------------------------------------------ precompiles
    address internal constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;
    address internal constant PQC_KEY_STATUS = 0x0000000000000000000000000000000000000a02;

    // ------------------------------------------------------------------ data
    struct Pass {
        bytes32 scanHash; // keccak256(salted, anonymised scan summary) — reveals nothing on its own
        uint8 scoreBucket; // 0..10  (exposure score / 10, rounded down; 10 = 100 %)
        uint16 chainsMask; // bit i set = exposure found on chain i (see CHAIN_BITS in the app)
        uint8 exposedUsdBucket; // 0 = none, k = exposed USD in [10^(k-1), 10^k)  (self-reported, coarse)
        uint8 pqAlgorithm; // algorithm id reported by the PQC registry (1 = ML-DSA-87 / dilithium5)
        uint64 mintedAt;
        bytes32 pqKeyHash; // keccak256 of the registered ML-DSA public key that signed
    }

    string public constant name = "Quantum Pass";
    string public constant symbol = "QPASS";

    mapping(address => Pass) public passOf;
    uint256 public totalPasses;
    uint256[11] public passesByScoreBucket;
    uint256[16] public passesByChain;
    /// Sum over passes of the lower bound of their exposed-USD bucket (10^(k-1)) — "at least $X attested".
    uint256 public attestedExposedUsdFloor;
    /// Relayer allowed to call attest(). Immutable: no admin, no upgrades.
    address public immutable attester;
    /// Native QoreChain tx hashes already used as proof by attest().
    mapping(bytes32 => bool) public nativeTxUsed;

    constructor(address attester_) {
        attester = attester_;
    }

    // ------------------------------------------------------------------ events & errors
    event PassMinted(
        address indexed holder,
        bytes32 scanHash,
        uint8 scoreBucket,
        uint16 chainsMask,
        uint8 exposedUsdBucket,
        bytes32 pqKeyHash
    );
    /// ERC-721 Transfer (mint only) so wallets and explorers can index passes.
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    /// ERC-5192
    event Locked(uint256 tokenId);
    /// Emitted by attest(): the native hybrid-signed tx that carried the holder's commitment.
    event NativeProof(address indexed holder, bytes32 nativeTxHash);

    error AlreadyMinted();
    error PqKeyNotRegistered();
    error BadPqSignature();
    error PrecompileUnavailable();
    error OutOfRange();
    error Soulbound();
    error NoPass();
    error NotAttester();
    error ProofReused();

    // ------------------------------------------------------------------ mint
    /// @notice The 32-byte digest the holder must sign with their registered ML-DSA-87 key.
    function digest(
        address holder,
        bytes32 scanHash,
        uint8 scoreBucket,
        uint16 chainsMask,
        uint8 exposedUsdBucket
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                "ShorsReach.QuantumPass.v1",
                block.chainid,
                address(this),
                holder,
                scanHash,
                scoreBucket,
                chainsMask,
                exposedUsdBucket
            )
        );
    }

    /// @notice Self-mint: the caller proves control of its registered ML-DSA-87 key by signing `digest(...)`;
    /// the signature is verified on-chain by the pqcVerify precompile.
    function mint(
        bytes32 scanHash,
        uint8 scoreBucket,
        uint16 chainsMask,
        uint8 exposedUsdBucket,
        bytes calldata pqSignature
    ) external {
        _checkNew(msg.sender, scoreBucket, exposedUsdBucket);
        (bool registered, uint8 algorithm, bytes memory pqPubkey) = _keyStatus(msg.sender);
        if (!registered || pqPubkey.length == 0) revert PqKeyNotRegistered();

        bytes32 d = digest(msg.sender, scanHash, scoreBucket, chainsMask, exposedUsdBucket);
        if (!_pqVerify(pqPubkey, pqSignature, abi.encodePacked(d))) revert BadPqSignature();

        _record(msg.sender, scanHash, scoreBucket, chainsMask, exposedUsdBucket, algorithm, keccak256(pqPubkey));
    }

    /// @notice Attested mint for wallets that sign only native transactions (QoreX today).
    /// The holder commits to `digest(...)` in the memo of a native QoreChain transaction, which the chain only
    /// accepts with a valid hybrid secp256k1 + ML-DSA-87 signature from the holder's registered key. The attester
    /// checks that transaction off-chain; this contract still re-checks the registry on-chain and binds the pass
    /// to the registered key, and each native transaction can be used once.
    function attest(
        address holder,
        bytes32 scanHash,
        uint8 scoreBucket,
        uint16 chainsMask,
        uint8 exposedUsdBucket,
        bytes32 nativeTxHash
    ) external {
        if (msg.sender != attester) revert NotAttester();
        if (nativeTxUsed[nativeTxHash]) revert ProofReused();
        _checkNew(holder, scoreBucket, exposedUsdBucket);
        (bool registered, uint8 algorithm, bytes memory pqPubkey) = _keyStatus(holder);
        if (!registered || pqPubkey.length == 0) revert PqKeyNotRegistered();
        nativeTxUsed[nativeTxHash] = true;
        _record(holder, scanHash, scoreBucket, chainsMask, exposedUsdBucket, algorithm, keccak256(pqPubkey));
        emit NativeProof(holder, nativeTxHash);
    }

    function _checkNew(address holder, uint8 scoreBucket, uint8 exposedUsdBucket) internal view {
        if (passOf[holder].mintedAt != 0) revert AlreadyMinted();
        if (scoreBucket > 10 || exposedUsdBucket > 15) revert OutOfRange();
    }

    function _record(
        address holder,
        bytes32 scanHash,
        uint8 scoreBucket,
        uint16 chainsMask,
        uint8 exposedUsdBucket,
        uint8 algorithm,
        bytes32 keyHash
    ) internal {
        passOf[holder] = Pass({
            scanHash: scanHash,
            scoreBucket: scoreBucket,
            chainsMask: chainsMask,
            exposedUsdBucket: exposedUsdBucket,
            pqAlgorithm: algorithm,
            mintedAt: uint64(block.timestamp),
            pqKeyHash: keyHash
        });

        unchecked {
            totalPasses++;
            passesByScoreBucket[scoreBucket]++;
            for (uint256 i = 0; i < 16; i++) {
                if (chainsMask & (uint256(1) << i) != 0) passesByChain[i]++;
            }
            if (exposedUsdBucket > 0) attestedExposedUsdFloor += 10 ** (exposedUsdBucket - 1);
        }

        uint256 tokenId = uint256(uint160(holder));
        emit PassMinted(holder, scanHash, scoreBucket, chainsMask, exposedUsdBucket, keyHash);
        emit Transfer(address(0), holder, tokenId);
        emit Locked(tokenId);
    }

    // ------------------------------------------------------------------ stats helpers
    function scoreBuckets() external view returns (uint256[11] memory) {
        return passesByScoreBucket;
    }

    function chainCounts() external view returns (uint256[16] memory) {
        return passesByChain;
    }

    // ------------------------------------------------------------------ minimal ERC-721 (read-only) + ERC-5192
    function balanceOf(address owner) external view returns (uint256) {
        return passOf[owner].mintedAt == 0 ? 0 : 1;
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = address(uint160(tokenId));
        if (tokenId >> 160 != 0 || passOf[owner].mintedAt == 0) revert NoPass();
    }

    function locked(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId);
        return true;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 // ERC-165
            || id == 0x80ac58cd // ERC-721
            || id == 0xb45a3c0e; // ERC-5192
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    // ------------------------------------------------------------------ precompile wrappers
    /// @dev Live return layout on diana: (bool registered, uint8 algorithmId, bytes pubkey, uint256) — 4 words.
    function _keyStatus(address account) internal view returns (bool, uint8, bytes memory) {
        (bool ok, bytes memory ret) =
            PQC_KEY_STATUS.staticcall(abi.encodeWithSignature("pqcKeyStatus(address)", account));
        if (!ok || ret.length < 96) revert PrecompileUnavailable();
        (bool registered, uint8 algorithm, bytes memory pubkey) = abi.decode(ret, (bool, uint8, bytes));
        return (registered, algorithm, pubkey);
    }

    function _pqVerify(bytes memory pubkey, bytes calldata signature, bytes memory message) internal view returns (bool) {
        (bool ok, bytes memory ret) =
            PQC_VERIFY.staticcall(abi.encodeWithSignature("pqcVerify(bytes,bytes,bytes)", pubkey, signature, message));
        if (!ok || ret.length < 32) revert PrecompileUnavailable();
        return abi.decode(ret, (bool));
    }
}
