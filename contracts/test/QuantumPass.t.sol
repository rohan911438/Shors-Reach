// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {QuantumPass} from "../src/QuantumPass.sol";

/// Mock of the pqcKeyStatus precompile (0x0A02): returns the live 4-word layout.
contract MockKeyStatus {
    mapping(address => bytes) public keys;

    function setKey(address a, bytes calldata k) external {
        keys[a] = k;
    }

    fallback(bytes calldata data) external returns (bytes memory) {
        address a = abi.decode(data[4:], (address));
        bytes memory k = keys[a];
        return abi.encode(k.length > 0, uint8(k.length > 0 ? 1 : 0), k, uint256(1));
    }
}

/// Mock of the pqcVerify precompile (0x0A01): valid iff signature == keccak256(pubkey ‖ message) (test-only scheme).
contract MockVerify {
    fallback(bytes calldata data) external returns (bytes memory) {
        (bytes memory pk, bytes memory sig, bytes memory msg_) = abi.decode(data[4:], (bytes, bytes, bytes));
        return abi.encode(keccak256(sig) == keccak256(abi.encodePacked(keccak256(abi.encodePacked(pk, msg_)))));
    }
}

contract QuantumPassTest is Test {
    QuantumPass pass;
    address constant VERIFY = 0x0000000000000000000000000000000000000a01;
    address constant STATUS = 0x0000000000000000000000000000000000000a02;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes alicePk;
    bytes bobPk;

    event PassMinted(address indexed holder, bytes32 scanHash, uint8 scoreBucket, uint16 chainsMask, uint8 exposedUsdBucket, bytes32 pqKeyHash);

    function setUp() public {
        vm.etch(STATUS, address(new MockKeyStatus()).code);
        vm.etch(VERIFY, address(new MockVerify()).code);
        pass = new QuantumPass();
        // Real ML-DSA-87 sizes: 2,592-byte public key.
        alicePk = _bytes(2592, 0xA1);
        bobPk = _bytes(2592, 0xB0);
        MockKeyStatus(STATUS).setKey(alice, alicePk);
        MockKeyStatus(STATUS).setKey(bob, bobPk);
    }

    function _bytes(uint256 n, uint8 fill) internal pure returns (bytes memory b) {
        b = new bytes(n);
        for (uint256 i = 0; i < n; i++) b[i] = bytes1(fill);
    }

    /// Test-only "signature" matching MockVerify; padded to the real 4,627-byte ML-DSA-87 size for gas realism.
    function _sign(bytes memory pk, bytes32 d) internal pure returns (bytes memory) {
        return abi.encodePacked(keccak256(abi.encodePacked(pk, abi.encodePacked(d))));
    }

    function _mint(address who, bytes memory pk, bytes32 scanHash, uint8 score, uint16 mask, uint8 usd) internal {
        bytes32 d = pass.digest(who, scanHash, score, mask, usd);
        vm.prank(who);
        pass.mint(scanHash, score, mask, usd, _sign(pk, d));
    }

    function test_MintHappyPath() public {
        bytes32 d = pass.digest(alice, keccak256("scan"), 7, 0x0003, 5);
        vm.expectEmit(true, false, false, true);
        emit PassMinted(alice, keccak256("scan"), 7, 0x0003, 5, keccak256(alicePk));
        vm.prank(alice);
        pass.mint(keccak256("scan"), 7, 0x0003, 5, _sign(alicePk, d));

        (bytes32 scanHash, uint8 score, uint16 mask, uint8 usd, uint8 alg, uint64 mintedAt, bytes32 keyHash) = pass.passOf(alice);
        assertEq(scanHash, keccak256("scan"));
        assertEq(score, 7);
        assertEq(mask, 3);
        assertEq(usd, 5);
        assertEq(alg, 1);
        assertGt(mintedAt, 0);
        assertEq(keyHash, keccak256(alicePk));
        assertEq(pass.totalPasses(), 1);
        assertEq(pass.balanceOf(alice), 1);
        assertEq(pass.ownerOf(uint256(uint160(alice))), alice);
        assertTrue(pass.locked(uint256(uint160(alice))));
        assertEq(pass.attestedExposedUsdFloor(), 10_000);
    }

    function test_RevertWhen_MintTwice() public {
        _mint(alice, alicePk, keccak256("a"), 1, 1, 1);
        bytes32 d = pass.digest(alice, keccak256("b"), 1, 1, 1);
        vm.prank(alice);
        vm.expectRevert(QuantumPass.AlreadyMinted.selector);
        pass.mint(keccak256("b"), 1, 1, 1, _sign(alicePk, d));
    }

    function test_RevertWhen_KeyNotRegistered() public {
        address carol = address(0xCA201);
        bytes32 d = pass.digest(carol, keccak256("c"), 1, 1, 1);
        vm.prank(carol);
        vm.expectRevert(QuantumPass.PqKeyNotRegistered.selector);
        pass.mint(keccak256("c"), 1, 1, 1, _sign(alicePk, d));
    }

    function test_RevertWhen_SignedWithAnotherKey() public {
        // Bob signs with Alice's key → must fail: the contract uses Bob's REGISTERED key.
        bytes32 d = pass.digest(bob, keccak256("x"), 1, 1, 1);
        vm.prank(bob);
        vm.expectRevert(QuantumPass.BadPqSignature.selector);
        pass.mint(keccak256("x"), 1, 1, 1, _sign(alicePk, d));
    }

    function test_RevertWhen_FieldsTampered() public {
        // Signature over score 2, submitted with score 9.
        bytes32 d = pass.digest(alice, keccak256("x"), 2, 1, 1);
        vm.prank(alice);
        vm.expectRevert(QuantumPass.BadPqSignature.selector);
        pass.mint(keccak256("x"), 9, 1, 1, _sign(alicePk, d));
    }

    function test_RevertWhen_Replayed() public {
        // Alice's signature replayed by Bob (digest binds the holder).
        bytes32 d = pass.digest(alice, keccak256("x"), 1, 1, 1);
        vm.prank(bob);
        vm.expectRevert(QuantumPass.BadPqSignature.selector);
        pass.mint(keccak256("x"), 1, 1, 1, _sign(bobPk, d));
    }

    function test_RevertWhen_PrecompilesInactive() public {
        vm.etch(STATUS, "");
        vm.etch(VERIFY, "");
        vm.prank(alice);
        vm.expectRevert(QuantumPass.PrecompileUnavailable.selector);
        pass.mint(keccak256("x"), 1, 1, 1, hex"00");
    }

    function test_Soulbound() public {
        _mint(alice, alicePk, keccak256("a"), 1, 1, 1);
        uint256 id = uint256(uint160(alice));
        vm.expectRevert(QuantumPass.Soulbound.selector);
        pass.transferFrom(alice, bob, id);
        vm.expectRevert(QuantumPass.Soulbound.selector);
        pass.safeTransferFrom(alice, bob, id);
        vm.expectRevert(QuantumPass.Soulbound.selector);
        pass.approve(bob, id);
        vm.expectRevert(QuantumPass.Soulbound.selector);
        pass.setApprovalForAll(bob, true);
    }

    function test_OwnerOfUnknownReverts() public {
        vm.expectRevert(QuantumPass.NoPass.selector);
        pass.ownerOf(uint256(uint160(bob)));
    }

    function test_CountersAcrossMinters() public {
        _mint(alice, alicePk, keccak256("a"), 10, 0x0001, 3); // bitcoin, $100+
        _mint(bob, bobPk, keccak256("b"), 4, 0x0006, 6); // ethereum+base, $100k+
        assertEq(pass.totalPasses(), 2);
        uint256[11] memory s = pass.scoreBuckets();
        assertEq(s[10], 1);
        assertEq(s[4], 1);
        uint256[16] memory c = pass.chainCounts();
        assertEq(c[0], 1);
        assertEq(c[1], 1);
        assertEq(c[2], 1);
        assertEq(pass.attestedExposedUsdFloor(), 100 + 100_000);
    }

    function test_SupportsInterfaces() public view {
        assertTrue(pass.supportsInterface(0x80ac58cd));
        assertTrue(pass.supportsInterface(0xb45a3c0e));
        assertTrue(pass.supportsInterface(0x01ffc9a7));
        assertFalse(pass.supportsInterface(0xffffffff));
    }

    function testFuzz_RangeChecks(uint8 score, uint8 usd) public {
        bytes32 d = pass.digest(alice, keccak256("f"), score, 1, usd);
        vm.prank(alice);
        if (score > 10 || usd > 15) {
            vm.expectRevert(QuantumPass.OutOfRange.selector);
            pass.mint(keccak256("f"), score, 1, usd, _sign(alicePk, d));
        } else {
            pass.mint(keccak256("f"), score, 1, usd, _sign(alicePk, d));
            assertEq(pass.totalPasses(), 1);
        }
    }

    function testFuzz_DigestBindsEveryField(bytes32 h, uint8 s, uint16 m, uint8 u) public view {
        bytes32 base = pass.digest(alice, h, s, m, u);
        assertTrue(base != pass.digest(bob, h, s, m, u));
        assertTrue(base != pass.digest(alice, h, s, m ^ 1, u));
        assertTrue(base != pass.digest(alice, h, s, m, u ^ 1));
    }
}
