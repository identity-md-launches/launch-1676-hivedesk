// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {HiveDeskToken} from "src/HiveDeskToken.sol";

/// @notice Drives the real token through a closed set of holders, including its deployer.
/// @dev No token storage writes or synthetic minting. Ghosts record requested, successful
/// transfers and approvals, never copy balances or allowances back from the implementation.
contract HiveDeskTokenHandler is Test {
    uint256 public constant SUPPLY = 1_000_000_000 * 10 ** 18;
    uint256 public constant INITIAL_BALANCE = SUPPLY / 4;
    HiveDeskToken public immutable token;
    address[4] public actors;
    mapping(address => uint256) public received;
    mapping(address => uint256) public sent;
    mapping(address => mapping(address => uint256)) public expectedAllowance;

    constructor() {
        actors = [address(this), makeAddr("invariant-alice"), makeAddr("invariant-bob"), makeAddr("invariant-carol")];
        token = new HiveDeskToken();
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(address(this)), SUPPLY, "constructor mint goes to actual deployer");
        for (uint256 i = 1; i < actors.length; ++i) {
            assertTrue(token.transfer(actors[i], INITIAL_BALANCE));
        }
        for (uint256 i; i < actors.length; ++i) {
            assertEq(token.balanceOf(actors[i]), INITIAL_BALANCE);
        }
    }

    function transfer(uint256 fromSeed, uint256 toSeed, uint256 rawAmount) external {
        address from = _actor(fromSeed);
        _transfer(from, _actor(toSeed), bound(rawAmount, 0, _balance(from)));
    }

    function transferAll(uint256 fromSeed, uint256 toSeed) external {
        address from = _actor(fromSeed);
        _transfer(from, _actor(toSeed), _balance(from));
    }

    function approve(uint256 ownerSeed, uint256 spenderSeed, uint256 rawAmount, uint8 mode) external {
        uint256 amount;
        mode %= 4;
        if (mode == 0) amount = bound(rawAmount, 0, SUPPLY);
        else if (mode == 1) amount = type(uint256).max;
        else if (mode == 2) amount = type(uint256).max - 1;
        // mode 3 explicitly revokes, so the fuzzer frequently revisits zero allowances.
        _approve(_actor(ownerSeed), _actor(spenderSeed), amount);
    }

    function transferFrom(uint256 ownerSeed, uint256 spenderSeed, uint256 toSeed, uint256 rawAmount) external {
        address owner = _actor(ownerSeed);
        address spender = _actor(spenderSeed);
        address to = _actor(toSeed);
        uint256 allowance = expectedAllowance[owner][spender];
        uint256 available = _balance(owner);
        uint256 amount = bound(rawAmount, 0, available < allowance ? available : allowance);

        // Do not auto-approve here: spending must depend on earlier calls in the random sequence.
        vm.prank(spender);
        assertTrue(token.transferFrom(owner, to, amount), "valid delegated transfer failed");
        if (allowance != type(uint256).max) expectedAllowance[owner][spender] = allowance - amount;
        _recordTransfer(owner, to, amount);
    }

    function roundTrip(uint256 fromSeed, uint256 toSeed, uint256 rawAmount) external {
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        uint256 fromBefore = token.balanceOf(from);
        uint256 toBefore = token.balanceOf(to);
        uint256 amount = bound(rawAmount, 0, _balance(from));
        _transfer(from, to, amount);
        // Check the intermediate result too; a compensating error must not hide a bad transfer.
        assertEq(token.balanceOf(from), _balance(from));
        assertEq(token.balanceOf(to), _balance(to));
        _transfer(to, from, amount);
        assertEq(token.balanceOf(from), fromBefore, "round trip changed sender balance");
        assertEq(token.balanceOf(to), toBefore, "round trip changed receiver balance");
    }

    function rejectOverBalance(uint256 fromSeed, uint256 toSeed, uint256 rawAmount) external {
        address from = _actor(fromSeed);
        uint256 balance = _balance(from);
        uint256 amount = bound(rawAmount, balance + 1, type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, from, balance, amount));
        vm.prank(from);
        token.transfer(_actor(toSeed), amount);
        // Ghosts stay unchanged on every rejected call. The invariants check all balances/pairs.
    }

    function rejectOverAllowance(uint256 ownerSeed, uint256 spenderSeed, uint256 toSeed) external {
        address owner = _actor(ownerSeed);
        address spender = _actor(spenderSeed);
        uint256 allowance = expectedAllowance[owner][spender];
        if (allowance == type(uint256).max) {
            _approve(owner, spender, 0);
            allowance = 0;
        }
        uint256 amount = allowance + 1;
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, allowance, amount)
        );
        vm.prank(spender);
        token.transferFrom(owner, _actor(toSeed), amount);
    }

    function rejectTransferFromOverBalance(
        uint256 ownerSeed,
        uint256 spenderSeed,
        uint256 toSeed,
        uint256 rawAmount,
        bool infinite
    ) external {
        address owner = _actor(ownerSeed);
        address spender = _actor(spenderSeed);
        uint256 balance = _balance(owner);
        uint256 amount = bound(rawAmount, balance + 1, type(uint256).max - 1);
        _approve(owner, spender, infinite ? type(uint256).max : amount);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, owner, balance, amount));
        vm.prank(spender);
        token.transferFrom(owner, _actor(toSeed), amount);
        assertEq(token.allowance(owner, spender), expectedAllowance[owner][spender], "revert consumed approval");
    }

    function rejectZeroAddress(uint256 ownerSeed, uint256 spenderSeed, uint256 rawAmount, uint8 action) external {
        address owner = _actor(ownerSeed);
        address spender = _actor(spenderSeed);
        uint256 amount = bound(rawAmount, 0, _balance(owner));
        action %= 3;
        if (action == 0) {
            vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
            vm.prank(owner);
            token.transfer(address(0), amount);
        } else if (action == 1) {
            vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidSpender.selector, address(0)));
            vm.prank(owner);
            token.approve(address(0), amount);
        } else {
            _approve(owner, spender, amount + 1);
            vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
            vm.prank(spender);
            token.transferFrom(owner, address(0), amount);
        }
    }

    function rejectPrivilegedCall(uint256 callerSeed, uint256 victimSeed, uint256 amount, uint8 action) external {
        address victim = _actor(victimSeed);
        bytes memory data;
        action %= 6;
        if (action == 0) data = abi.encodeWithSignature("mint(address,uint256)", victim, amount);
        else if (action == 1) data = abi.encodeWithSignature("burnFrom(address,uint256)", victim, amount);
        else if (action == 2) data = abi.encodeWithSignature("pause()");
        else if (action == 3) data = abi.encodeWithSignature("blacklist(address)", victim);
        else if (action == 4) data = abi.encodeWithSignature("initialize(address)", victim);
        else data = abi.encodeWithSignature("transferOwnership(address)", victim);
        vm.prank(_actor(callerSeed));
        (bool success,) = address(token).call(data);
        assertFalse(success, "token unexpectedly exposes a privileged selector");
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _balance(address actor) internal view returns (uint256) {
        return INITIAL_BALANCE + received[actor] - sent[actor];
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        vm.prank(owner);
        assertTrue(token.approve(spender, amount), "valid approval failed");
        expectedAllowance[owner][spender] = amount;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        vm.prank(from);
        assertTrue(token.transfer(to, amount), "valid transfer failed");
        _recordTransfer(from, to, amount);
    }

    function _recordTransfer(address from, address to, uint256 amount) internal {
        sent[from] += amount;
        received[to] += amount;
    }
}

/// @notice Supply, individual entitlement and authorization must survive arbitrary call ordering.
/// forge-config: default.invariant.runs = 256
/// forge-config: default.invariant.depth = 128
/// forge-config: default.invariant.fail-on-revert = true
contract HiveDeskTokenInvariantTest is Test {
    uint256 internal constant SUPPLY = 1_000_000_000 * 10 ** 18;
    HiveDeskTokenHandler internal handler;
    HiveDeskToken internal token;

    function setUp() public {
        handler = new HiveDeskTokenHandler();
        token = handler.token();
        // Explicit targeting prevents direct token calls from bypassing the ghost accounting.
        bytes4[] memory selectors = new bytes4[](10);
        selectors[0] = handler.transfer.selector;
        selectors[1] = handler.transferAll.selector;
        selectors[2] = handler.approve.selector;
        selectors[3] = handler.transferFrom.selector;
        selectors[4] = handler.roundTrip.selector;
        selectors[5] = handler.rejectOverBalance.selector;
        selectors[6] = handler.rejectOverAllowance.selector;
        selectors[7] = handler.rejectTransferFromOverBalance.selector;
        selectors[8] = handler.rejectZeroAddress.selector;
        selectors[9] = handler.rejectPrivilegedCall.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariant_fixedSupplyEqualsSumOfAllReachableBalances() public view {
        uint256 sum;
        for (uint256 i; i < 4; ++i) {
            sum += token.balanceOf(handler.actors(i));
        }
        assertEq(token.totalSupply(), SUPPLY, "supply changed after construction");
        assertEq(sum, SUPPLY, "tokens were created, lost, or diverted outside the holders");
        assertEq(token.balanceOf(address(0)), 0, "zero address acquired a balance");
        assertEq(token.balanceOf(address(token)), 0, "token took a transfer fee");
    }

    function invariant_eachBalanceMatchesCumulativeAuthorizedTransfers() public view {
        for (uint256 i; i < 4; ++i) {
            address actor = handler.actors(i);
            assertEq(
                token.balanceOf(actor) + handler.sent(actor),
                SUPPLY / 4 + handler.received(actor),
                "holder balance disagrees with independently tracked transfers"
            );
        }
    }

    function invariant_allowancesMatchApprovalsAndSuccessfulSpending() public view {
        for (uint256 i; i < 4; ++i) {
            address owner = handler.actors(i);
            assertEq(token.allowance(owner, address(0)), 0);
            assertEq(token.allowance(address(0), owner), 0);
            for (uint256 j; j < 4; ++j) {
                address spender = handler.actors(j);
                assertEq(
                    token.allowance(owner, spender),
                    handler.expectedAllowance(owner, spender),
                    "approval changed without authorization or was spent incorrectly"
                );
            }
        }
    }

    /// @dev At the end of every campaign run, every holder can still move its entire balance.
    function afterInvariant() public {
        for (uint256 i = 1; i < 4; ++i) {
            handler.transferAll(i, 0);
            assertEq(token.balanceOf(handler.actors(i)), 0, "holder could not empty its account");
        }
        assertEq(token.balanceOf(address(handler)), SUPPLY);
        invariant_fixedSupplyEqualsSumOfAllReachableBalances();
        invariant_eachBalanceMatchesCumulativeAuthorizedTransfers();
        invariant_allowancesMatchApprovalsAndSuccessfulSpending();
    }

    /// @dev Pins a nonzero delegated-spend/revoke/failure lifecycle independently of random selection.
    function test_handlerSequenceExercisesNonzeroSpendsAndRollback() public {
        handler.approve(0, 1, 100, 0);
        handler.transferFrom(0, 1, 2, 40);
        assertEq(token.balanceOf(handler.actors(2)), SUPPLY / 4 + 40);
        assertEq(token.allowance(handler.actors(0), handler.actors(1)), 60);
        handler.transferFrom(0, 1, 0, 60);
        assertEq(token.balanceOf(handler.actors(0)), SUPPLY / 4 - 40);
        assertEq(token.allowance(handler.actors(0), handler.actors(1)), 0);
        handler.rejectOverAllowance(0, 1, 2);

        handler.approve(0, 1, 0, 1);
        handler.transferFrom(0, 1, 2, 1);
        assertEq(token.allowance(handler.actors(0), handler.actors(1)), type(uint256).max);
        handler.approve(0, 1, 0, 3);
        handler.rejectOverAllowance(0, 1, 2);
        handler.rejectTransferFromOverBalance(2, 3, 0, type(uint256).max, false);
        handler.rejectZeroAddress(2, 3, 1, 2);
        handler.rejectOverBalance(2, 2, type(uint256).max);
        handler.rejectPrivilegedCall(0, 2, 1, 0);
        handler.transfer(2, 3, 1);
        handler.roundTrip(2, 3, 1);
        invariant_fixedSupplyEqualsSumOfAllReachableBalances();
        invariant_eachBalanceMatchesCumulativeAuthorizedTransfers();
        invariant_allowancesMatchApprovalsAndSuccessfulSpending();
        afterInvariant();
    }
}
