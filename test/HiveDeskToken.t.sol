// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {HiveDeskToken} from "../src/HiveDeskToken.sol";
import {DeployHiveDeskToken} from "../script/DeployHiveDeskToken.s.sol";

/// @notice Stands in for the launch factory: deploys the token so that it, not the test contract,
///         is `msg.sender` in the constructor and therefore receives the supply.
contract DeployerProbe {
    HiveDeskToken public token;

    function deploy() external returns (HiveDeskToken deployed) {
        deployed = new HiveDeskToken();
        token = deployed;
    }

    function send(address to, uint256 amount) external returns (bool) {
        return token.transfer(to, amount);
    }
}

contract HiveDeskTokenTest is Test {
    uint256 internal constant EXPECTED_SUPPLY = 1_000_000_000 ether;

    DeployerProbe internal deployer;
    HiveDeskToken internal token;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant STRANGER = address(0xBEEF);

    function setUp() public {
        deployer = new DeployerProbe();
        token = deployer.deploy();
    }

    // ---------------------------------------------------------------- metadata

    function test_nameSymbolDecimals() public view {
        assertEq(token.name(), "HiveDesk");
        assertEq(token.symbol(), "HVD");
        assertEq(token.decimals(), 18);
    }

    function test_constantsMatchTheBrief() public view {
        assertEq(token.SUPPLY_WHOLE_TOKENS(), 1_000_000_000);
        assertEq(token.TOTAL_SUPPLY(), EXPECTED_SUPPLY);
        assertEq(token.TOTAL_SUPPLY(), 1_000_000_000 * 10 ** uint256(token.decimals()));
    }

    // ------------------------------------------------------------------ supply

    function test_mintsWholeSupplyToDeployerOnce() public view {
        assertEq(token.totalSupply(), EXPECTED_SUPPLY, "total supply");
        assertEq(token.balanceOf(address(deployer)), EXPECTED_SUPPLY, "deployer holds everything");
        assertEq(token.balanceOf(address(this)), 0, "the test contract received nothing");
    }

    function test_constructorEmitsSingleMintTransfer() public {
        DeployerProbe fresh = new DeployerProbe();
        vm.recordLogs();
        HiveDeskToken minted = fresh.deploy();
        Vm.Log[] memory logs = vm.getRecordedLogs();

        uint256 transfers;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(minted)) continue;
            if (logs[i].topics[0] != IERC20.Transfer.selector) continue;
            transfers++;
            assertEq(address(uint160(uint256(logs[i].topics[1]))), address(0), "mint comes from zero");
            assertEq(address(uint160(uint256(logs[i].topics[2]))), address(fresh), "mint goes to deployer");
            assertEq(abi.decode(logs[i].data, (uint256)), EXPECTED_SUPPLY, "mint amount");
        }
        assertEq(transfers, 1, "exactly one Transfer in the constructor");
    }

    function test_deployScriptMintsToItsCaller() public {
        DeployHiveDeskToken script = new DeployHiveDeskToken();
        HiveDeskToken scripted = script.deploy();
        assertEq(scripted.totalSupply(), EXPECTED_SUPPLY);
        assertEq(scripted.balanceOf(address(script)), EXPECTED_SUPPLY);
    }

    function test_eachDeploymentIsIndependent() public {
        DeployerProbe other = new DeployerProbe();
        HiveDeskToken second = other.deploy();
        assertTrue(address(second) != address(token));
        assertEq(second.totalSupply(), EXPECTED_SUPPLY);
        assertEq(second.balanceOf(address(other)), EXPECTED_SUPPLY);
        assertEq(second.balanceOf(address(deployer)), 0);
        assertEq(token.totalSupply(), EXPECTED_SUPPLY, "the first token is unaffected");
    }

    // --------------------------------------------------------- supply is fixed

    /// @dev Every common mint / admin selector must be absent: the call reverts (no fallback), the
    ///      supply does not grow, and the caller gains nothing. Tried from a stranger and from the deployer.
    function test_noMintPathExists() public {
        string[12] memory signatures = [
            "mint(address,uint256)",
            "mint(uint256)",
            "mint()",
            "issue(uint256)",
            "setOwner(address)",
            "transferOwnership(address)",
            "upgradeTo(address)",
            "initialize(address)",
            "unpause()",
            "setMinter(address)",
            "owner()",
            "burnFrom(address,uint256)"
        ];
        address[2] memory callers = [STRANGER, address(deployer)];
        for (uint256 c; c < callers.length; ++c) {
            for (uint256 i; i < signatures.length; ++i) {
                bytes memory data = abi.encodeWithSignature(signatures[i], STRANGER, type(uint128).max);
                vm.prank(callers[c]);
                (bool ok,) = address(token).call(data);
                assertFalse(ok, signatures[i]);
                assertEq(token.totalSupply(), EXPECTED_SUPPLY, signatures[i]);
                assertEq(token.balanceOf(STRANGER), 0, signatures[i]);
            }
        }
    }

    function test_noPrivilegedCallMovesOrFreezesAHolder() public {
        uint256 held = EXPECTED_SUPPLY / 1_000;
        assertTrue(deployer.send(ALICE, held));
        string[12] memory signatures = [
            "pause()",
            "blacklist(address)",
            "blocklist(address)",
            "freeze(address)",
            "freezeAccount(address)",
            "setBlacklist(address,bool)",
            "setBlocked(address,bool)",
            "lock(address)",
            "disableTransfers()",
            "setTransfersEnabled(bool)",
            "burnFrom(address,uint256)",
            "seize(address)"
        ];
        for (uint256 i; i < signatures.length; ++i) {
            vm.prank(address(deployer));
            (bool ok,) = address(token).call(abi.encodeWithSignature(signatures[i], ALICE, true));
            assertFalse(ok, signatures[i]);
        }
        // Even the deployer cannot pull from a holder without an allowance.
        vm.prank(address(deployer));
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(deployer), 0, 1)
        );
        token.transferFrom(ALICE, address(deployer), 1);

        assertEq(token.balanceOf(ALICE), held, "balance untouched");
        vm.prank(ALICE);
        assertTrue(token.transfer(BOB, held / 2), "holder can still transfer");
        assertEq(token.balanceOf(BOB), held / 2);
    }

    function test_plainEtherIsRejected() public {
        vm.deal(STRANGER, 1 ether);
        vm.prank(STRANGER);
        (bool ok,) = address(token).call{value: 1 ether}("");
        assertFalse(ok, "no receive or fallback");
        assertEq(address(token).balance, 0);
    }

    function test_runtimeHasNoDelegatecallCallcodeOrSelfdestruct() public view {
        bytes memory runtime = address(token).code;
        assertGt(runtime.length, 0);
        assertLe(runtime.length, 24_576, "EIP-170");
        for (uint256 i; i < runtime.length; ++i) {
            uint8 op = uint8(runtime[i]);
            if (op >= 0x60 && op <= 0x7F) {
                i += (op - 0x5F);
                continue;
            }
            assertTrue(op != 0xF4, "DELEGATECALL");
            assertTrue(op != 0xF2, "CALLCODE");
            assertTrue(op != 0xFF, "SELFDESTRUCT");
        }
    }

    // --------------------------------------------------------------- transfers

    function test_transferMovesExactAmount() public {
        uint256 amount = 1_234_567 ether;
        vm.expectEmit(true, true, true, true, address(token));
        emit IERC20.Transfer(address(deployer), ALICE, amount);
        assertTrue(deployer.send(ALICE, amount));
        assertEq(token.balanceOf(ALICE), amount, "arrives whole");
        assertEq(token.balanceOf(address(deployer)), EXPECTED_SUPPLY - amount);
        assertEq(token.totalSupply(), EXPECTED_SUPPLY, "no burn on transfer");
    }

    function test_launchFlowsArriveWhole() public {
        address distributor = address(0xD157);
        address claimant = address(0xC1A1);
        address pool = address(0x9001);
        address remainder = address(0x612a9bB008e16ef2D24f41DAe9Fc661831d93367);

        uint256 swarm = EXPECTED_SUPPLY / 10;
        uint256 seed = (EXPECTED_SUPPLY * 8_000) / 10_000;
        uint256 rest = EXPECTED_SUPPLY - swarm - seed;

        assertTrue(deployer.send(distributor, swarm));
        assertTrue(deployer.send(pool, seed));
        assertTrue(deployer.send(remainder, rest));
        assertEq(token.balanceOf(address(deployer)), 0, "factory paid everything out");

        vm.prank(distributor);
        assertTrue(token.transfer(claimant, swarm));
        assertEq(token.balanceOf(claimant), swarm, "claim arrives whole");
        assertEq(token.balanceOf(distributor), 0);
        assertEq(token.balanceOf(pool), seed);
        assertEq(token.balanceOf(remainder), rest);
        assertEq(token.totalSupply(), EXPECTED_SUPPLY);
    }

    function test_transferToSelfKeepsBalance() public {
        deployer.send(ALICE, 10 ether);
        vm.prank(ALICE);
        assertTrue(token.transfer(ALICE, 10 ether));
        assertEq(token.balanceOf(ALICE), 10 ether);
    }

    function test_zeroValueTransferSucceeds() public {
        vm.prank(ALICE);
        assertTrue(token.transfer(BOB, 0));
        assertEq(token.balanceOf(BOB), 0);
    }

    function test_transferRevertsOnInsufficientBalance() public {
        deployer.send(ALICE, 5 ether);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 5 ether, 6 ether));
        token.transfer(BOB, 6 ether);
    }

    function test_transferRevertsToZeroAddress() public {
        vm.prank(address(deployer));
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        token.transfer(address(0), 1);
    }

    // ---------------------------------------------------------- allowances

    function test_approveAndTransferFrom() public {
        deployer.send(ALICE, 100 ether);
        vm.prank(ALICE);
        vm.expectEmit(true, true, true, true, address(token));
        emit IERC20.Approval(ALICE, BOB, 60 ether);
        assertTrue(token.approve(BOB, 60 ether));
        assertEq(token.allowance(ALICE, BOB), 60 ether);

        vm.prank(BOB);
        assertTrue(token.transferFrom(ALICE, STRANGER, 40 ether));
        assertEq(token.balanceOf(STRANGER), 40 ether);
        assertEq(token.balanceOf(ALICE), 60 ether);
        assertEq(token.allowance(ALICE, BOB), 20 ether, "allowance decremented");
    }

    function test_infiniteAllowanceIsNotDecremented() public {
        deployer.send(ALICE, 100 ether);
        vm.prank(ALICE);
        token.approve(BOB, type(uint256).max);
        vm.prank(BOB);
        token.transferFrom(ALICE, STRANGER, 100 ether);
        assertEq(token.allowance(ALICE, BOB), type(uint256).max);
    }

    function test_transferFromRevertsBeyondAllowance() public {
        deployer.send(ALICE, 100 ether);
        vm.prank(ALICE);
        token.approve(BOB, 10 ether);
        vm.prank(BOB);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, BOB, 10 ether, 11 ether)
        );
        token.transferFrom(ALICE, STRANGER, 11 ether);
    }

    function test_transferFromRevertsBeyondBalanceEvenWithAllowance() public {
        deployer.send(ALICE, 5 ether);
        vm.prank(ALICE);
        token.approve(BOB, 100 ether);
        vm.prank(BOB);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 5 ether, 6 ether));
        token.transferFrom(ALICE, STRANGER, 6 ether);
    }

    function test_approveRevertsForZeroSpender() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidSpender.selector, address(0)));
        token.approve(address(0), 1);
    }

    // -------------------------------------------------------------------- fuzz

    function testFuzz_transferConservesSupply(address to, uint256 amount) public {
        vm.assume(to != address(0) && to != address(deployer));
        amount = bound(amount, 0, EXPECTED_SUPPLY);
        assertTrue(deployer.send(to, amount));
        assertEq(token.balanceOf(to), amount);
        assertEq(token.balanceOf(address(deployer)), EXPECTED_SUPPLY - amount);
        assertEq(token.balanceOf(to) + token.balanceOf(address(deployer)), EXPECTED_SUPPLY);
        assertEq(token.totalSupply(), EXPECTED_SUPPLY);
    }

    function testFuzz_transferAboveBalanceReverts(address to, uint256 extra) public {
        vm.assume(to != address(0));
        extra = bound(extra, 1, type(uint256).max - EXPECTED_SUPPLY);
        vm.prank(address(deployer));
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector,
                address(deployer),
                EXPECTED_SUPPLY,
                EXPECTED_SUPPLY + extra
            )
        );
        token.transfer(to, EXPECTED_SUPPLY + extra);
    }

    function testFuzz_transferFromWithinAllowance(address spender, uint256 allowance, uint256 spend) public {
        vm.assume(spender != address(0) && spender != ALICE);
        allowance = bound(allowance, 0, EXPECTED_SUPPLY);
        spend = bound(spend, 0, allowance);
        deployer.send(ALICE, EXPECTED_SUPPLY);

        vm.prank(ALICE);
        token.approve(spender, allowance);
        vm.prank(spender);
        assertTrue(token.transferFrom(ALICE, BOB, spend));

        assertEq(token.balanceOf(BOB), spend);
        assertEq(token.balanceOf(ALICE), EXPECTED_SUPPLY - spend);
        assertEq(token.allowance(ALICE, spender), allowance == type(uint256).max ? allowance : allowance - spend);
        assertEq(token.totalSupply(), EXPECTED_SUPPLY);
    }
}
