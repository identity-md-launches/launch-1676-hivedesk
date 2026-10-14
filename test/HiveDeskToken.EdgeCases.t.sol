// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {HiveDeskToken} from "src/HiveDeskToken.sol";

/// @notice Boundary and failure properties complementing the existing deployment/launch tests.
/// forge-config: default.fuzz.runs = 1000
contract HiveDeskTokenEdgeCasesTest is Test {
    uint256 internal constant SUPPLY = 1_000_000_000 * 10 ** 18;
    HiveDeskToken internal token;
    address internal alice;
    address internal bob;
    address internal carol;

    function setUp() public {
        token = new HiveDeskToken();
        alice = makeAddr("edge-alice");
        bob = makeAddr("edge-bob");
        carol = makeAddr("edge-carol");
    }

    function test_zeroTransfersFromEmptyAccountsEmitEvents() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit IERC20.Transfer(alice, bob, 0);
        vm.prank(alice);
        assertTrue(token.transfer(bob, 0));

        // A zero transferFrom needs no approval, even from an empty account.
        vm.expectEmit(true, true, false, true, address(token));
        emit IERC20.Transfer(alice, bob, 0);
        vm.prank(carol);
        assertTrue(token.transferFrom(alice, bob, 0));
        assertEq(token.allowance(alice, carol), 0);
        _assertUntouchedSupply();
    }

    function test_zeroOneAndFullSupplyTransferRoundTrips() public {
        uint256[3] memory amounts = [uint256(0), uint256(1), SUPPLY];
        for (uint256 i; i < amounts.length; ++i) {
            uint256 amount = amounts[i];
            vm.expectEmit(true, true, false, true, address(token));
            emit IERC20.Transfer(address(this), alice, amount);
            assertTrue(token.transfer(alice, amount));
            assertEq(token.balanceOf(alice), amount);
            assertEq(token.balanceOf(address(this)), SUPPLY - amount);
            vm.prank(alice);
            assertTrue(token.transfer(address(this), amount));
            _assertUntouchedSupply();
        }
    }

    function test_selfTransferCannotSpendMoreThanBalance() public {
        assertTrue(token.transfer(alice, 1));
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 1, 2));
        vm.prank(alice);
        token.transfer(alice, 2);
        assertEq(token.balanceOf(alice), 1);
        assertEq(token.balanceOf(address(this)), SUPPLY - 1);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_maximumTransferAndSelfTransferRevertWithoutChangingState() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, address(this), SUPPLY, type(uint256).max
            )
        );
        token.transfer(alice, type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, address(this), SUPPLY, type(uint256).max
            )
        );
        token.transfer(address(this), type(uint256).max);
        _assertUntouchedSupply();
    }

    function test_selfTransferFromConsumesFiniteAllowanceWithoutMovingBalance() public {
        assertTrue(token.approve(bob, 7));
        vm.expectEmit(true, true, false, true, address(token));
        emit IERC20.Transfer(address(this), address(this), 3);
        vm.prank(bob);
        assertTrue(token.transferFrom(address(this), address(this), 3));
        assertEq(token.allowance(address(this), bob), 4);
        vm.prank(bob);
        assertTrue(token.transferFrom(address(this), address(this), 4));
        assertEq(token.allowance(address(this), bob), 0);

        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, 1));
        vm.prank(bob);
        token.transferFrom(address(this), address(this), 1);
        _assertUntouchedSupply();
    }

    function test_deployerCannotBypassItsOwnTransferFromAllowance() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(this), 0, 1));
        token.transferFrom(address(this), alice, 1);
        _assertUntouchedSupply();

        assertTrue(token.approve(address(this), 1));
        assertTrue(token.transferFrom(address(this), alice, 1));
        assertEq(token.allowance(address(this), address(this)), 0);
        assertEq(token.balanceOf(alice), 1);
        assertEq(token.balanceOf(address(this)), SUPPLY - 1);
    }

    function test_exhaustedAllowanceCannotBeReusedAfterOwnerIsRefunded() public {
        assertTrue(token.approve(bob, SUPPLY));
        vm.prank(bob);
        assertTrue(token.transferFrom(address(this), alice, SUPPLY));
        assertEq(token.balanceOf(alice), SUPPLY);
        assertEq(token.balanceOf(address(this)), 0);
        assertEq(token.allowance(address(this), bob), 0);
        vm.prank(alice);
        assertTrue(token.transfer(address(this), SUPPLY));

        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, 1));
        vm.prank(bob);
        token.transferFrom(address(this), alice, 1);
        assertEq(token.allowance(address(this), bob), 0);
        _assertUntouchedSupply();
    }

    function test_maximumMinusOneApprovalIsFinite() public {
        assertTrue(token.approve(bob, type(uint256).max - 1));
        vm.prank(bob);
        assertTrue(token.transferFrom(address(this), alice, SUPPLY));
        assertEq(token.allowance(address(this), bob), type(uint256).max - 1 - SUPPLY);
        assertEq(token.balanceOf(alice), SUPPLY);
        assertEq(token.balanceOf(address(this)), 0);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_infiniteApprovalCanBeReplacedAndRevoked() public {
        assertTrue(token.approve(bob, type(uint256).max));
        vm.prank(bob);
        assertTrue(token.transferFrom(address(this), alice, 1));
        assertEq(token.allowance(address(this), bob), type(uint256).max);

        assertTrue(token.approve(bob, 2));
        assertEq(token.allowance(address(this), bob), 2);
        vm.prank(bob);
        assertTrue(token.transferFrom(address(this), alice, 1));
        assertEq(token.allowance(address(this), bob), 1);

        vm.expectEmit(true, true, false, true, address(token));
        emit IERC20.Approval(address(this), bob, 0);
        assertTrue(token.approve(bob, 0));
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, 1));
        vm.prank(bob);
        token.transferFrom(address(this), alice, 1);
        assertEq(token.balanceOf(alice), 2);
        assertEq(token.balanceOf(address(this)), SUPPLY - 2);
        assertEq(token.allowance(address(this), bob), 0);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_approvalFromEmptyOwnerDoesNotCreateSpendableTokens() public {
        vm.prank(alice);
        assertTrue(token.approve(bob, type(uint256).max));
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 0, 1));
        vm.prank(bob);
        token.transferFrom(alice, carol, 1);
        assertEq(token.allowance(alice, bob), type(uint256).max);
        _assertUntouchedSupply();

        // The same approval becomes usable only after the owner receives real tokens.
        assertTrue(token.transfer(alice, 1));
        vm.prank(bob);
        assertTrue(token.transferFrom(alice, carol, 1));
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(carol), 1);
        assertEq(token.balanceOf(address(this)), SUPPLY - 1);
        assertEq(token.allowance(alice, bob), type(uint256).max);
    }

    function test_zeroAddressesAreRejectedEvenForZeroAmounts() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        token.transfer(address(0), 0);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidSpender.selector, address(0)));
        token.approve(address(0), 0);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        token.transferFrom(address(this), address(0), 0);

        // Only rejection is required: validation of allowance/owner may precede sender validation.
        vm.expectRevert();
        token.transferFrom(address(0), alice, 0);
        assertEq(token.allowance(address(0), address(this)), 0);
        assertEq(token.allowance(address(this), address(0)), 0);
        _assertUntouchedSupply();
    }

    function test_maximumTransferFromCannotOverflowWithInfiniteApproval() public {
        assertTrue(token.approve(bob, type(uint256).max));
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, address(this), SUPPLY, type(uint256).max
            )
        );
        vm.prank(bob);
        token.transferFrom(address(this), alice, type(uint256).max);
        assertEq(token.allowance(address(this), bob), type(uint256).max);
        _assertUntouchedSupply();
    }

    function testFuzz_transferRoundTripRestoresBalancesAndPreservesApproval(uint256 amount, uint256 approval) public {
        amount = bound(amount, 0, SUPPLY);
        assertTrue(token.approve(bob, approval));
        assertTrue(token.transfer(alice, amount));
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(address(this)), SUPPLY - amount);
        vm.prank(alice);
        assertTrue(token.transfer(address(this), amount));
        assertEq(token.allowance(address(this), bob), approval);
        _assertUntouchedSupply();
    }

    function testFuzz_failedTransferFromRestoresFiniteAllowance(uint256 held, uint256 requested, uint256 approved)
        public
    {
        held = bound(held, 0, SUPPLY);
        requested = bound(requested, held + 1, type(uint256).max - 1);
        approved = bound(approved, requested, type(uint256).max - 1);
        assertTrue(token.transfer(alice, held));
        vm.prank(alice);
        assertTrue(token.approve(bob, approved));

        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, held, requested));
        vm.prank(bob);
        token.transferFrom(alice, carol, requested);

        assertEq(token.allowance(alice, bob), approved, "failed debit must roll back the allowance spend");
        assertEq(token.balanceOf(alice), held);
        assertEq(token.balanceOf(carol), 0);
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.balanceOf(address(this)), SUPPLY - held);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function testFuzz_insufficientAllowanceRevertsWithSufficientBalance(
        uint256 amount,
        uint256 approval,
        bool selfRecipient
    ) public {
        amount = bound(amount, 1, SUPPLY);
        approval = bound(approval, 0, amount - 1);
        assertTrue(token.approve(bob, approval));
        address to = selfRecipient ? address(this) : alice;
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, approval, amount));
        vm.prank(bob);
        token.transferFrom(address(this), to, amount);
        assertEq(token.allowance(address(this), bob), approval);
        _assertUntouchedSupply();
    }

    function testFuzz_zeroRecipientRollsBackAllowance(uint256 amount, bool infinite) public {
        amount = bound(amount, 0, SUPPLY);
        uint256 approval = infinite ? type(uint256).max : amount + 1;
        assertTrue(token.approve(bob, approval));
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(bob);
        token.transferFrom(address(this), address(0), amount);
        assertEq(token.allowance(address(this), bob), approval);
        _assertUntouchedSupply();
    }

    function testFuzz_approvalReplacementIsIdempotentAndIsolated(uint256 first, uint256 replacement, uint256 other)
        public
    {
        assertTrue(token.approve(bob, first));
        assertTrue(token.approve(carol, other));
        vm.prank(alice);
        assertTrue(token.approve(bob, other));
        for (uint256 i; i < 2; ++i) {
            vm.expectEmit(true, true, false, true, address(token));
            emit IERC20.Approval(address(this), bob, replacement);
            assertTrue(token.approve(bob, replacement));
            assertEq(token.allowance(address(this), bob), replacement);
            assertEq(token.allowance(address(this), carol), other);
            assertEq(token.allowance(alice, bob), other);
            assertEq(token.allowance(bob, address(this)), 0);
            _assertUntouchedSupply();
        }
    }

    function testFuzz_transferFromHandlesAliasedRoles(uint256 amount, uint8 roles, bool infinite) public {
        amount = bound(amount, 0, SUPPLY);
        roles = uint8(bound(roles, 0, 4));
        address to = roles == 1 || roles == 4 ? address(this) : alice;
        address spender = roles == 2 || roles == 4 ? address(this) : (roles == 3 ? to : bob);
        uint256 approval = infinite ? type(uint256).max : amount;
        assertTrue(token.approve(spender, approval));
        vm.expectEmit(true, true, false, true, address(token));
        emit IERC20.Transfer(address(this), to, amount);
        vm.prank(spender);
        assertTrue(token.transferFrom(address(this), to, amount));

        assertEq(token.allowance(address(this), spender), infinite ? type(uint256).max : 0);
        assertEq(token.balanceOf(address(this)), to == address(this) ? SUPPLY : SUPPLY - amount);
        assertEq(token.balanceOf(alice), to == alice ? amount : 0);
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function testFuzz_splittingDelegatedSpendMatchesSingleSpend(uint256 amount, uint256 first, bool infinite) public {
        amount = bound(amount, 0, SUPPLY);
        first = bound(first, 0, amount);
        HiveDeskToken single = new HiveDeskToken();
        uint256 approval = infinite ? type(uint256).max : SUPPLY;
        assertTrue(token.approve(bob, approval));
        assertTrue(single.approve(bob, approval));
        vm.startPrank(bob);
        assertTrue(token.transferFrom(address(this), alice, first));
        assertTrue(token.transferFrom(address(this), alice, amount - first));
        assertTrue(single.transferFrom(address(this), alice, amount));
        vm.stopPrank();

        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(alice), single.balanceOf(alice));
        assertEq(token.balanceOf(address(this)), single.balanceOf(address(this)));
        assertEq(token.allowance(address(this), bob), single.allowance(address(this), bob));
        assertEq(token.allowance(address(this), bob), infinite ? type(uint256).max : SUPPLY - amount);
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(single.totalSupply(), SUPPLY);
    }

    function _assertUntouchedSupply() internal view {
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(address(this)), SUPPLY);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.balanceOf(carol), 0);
        assertEq(token.balanceOf(address(0)), 0);
    }
}
