// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {HiveDeskToken} from "../src/HiveDeskToken.sol";

/// @title Deploy script for HiveDesk (HVD)
/// @notice For review and local rehearsal only. The IdentityMD launch deploys the token from its
///         built bytecode through the ProjectFactory; this script is never what deploys it on mainnet.
/// @dev The token takes no constructor arguments, so there is no configuration to read. `deploy()`
///      is the unit the tests call directly; `run()` only wraps it in a broadcast.
contract DeployHiveDeskToken is Script {
    /// @notice Deploys the token. Whoever calls this (the broadcaster under `run()`) receives the supply.
    function deploy() public returns (HiveDeskToken token) {
        token = new HiveDeskToken();
    }

    function run() external returns (HiveDeskToken token) {
        vm.startBroadcast();
        token = deploy();
        vm.stopBroadcast();
    }
}
