// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title HiveDesk (HVD)
/// @notice A fixed-supply ERC-20. The whole supply is minted once, in the constructor, to the
///         deployer (`msg.sender`), and nothing can ever mint again.
/// @dev Design choices, each deliberate:
///      - No owner, no admin role, no pause, no blocklist, no burn-from, no upgrade path. There is
///        no privileged hand that can move, freeze or dilute a holder's balance.
///      - No constructor arguments: the deployer is whoever creates the contract. At launch that is
///        the ProjectFactory, which then pays the supply out (swarm share, pool seed, remainder).
///      - Ordinary transfers are untaxed and move exactly what they say, so every launch flow
///        (factory to distributor, distributor to claimant, pool seed, swaps) arrives whole.
///      - Only internal library code is used, so the bytecode has no link placeholders.
contract HiveDeskToken is ERC20 {
    /// @notice Token name, as `name()` returns it.
    string public constant TOKEN_NAME = "HiveDesk";

    /// @notice Token symbol, as `symbol()` returns it.
    string public constant TOKEN_SYMBOL = "HVD";

    /// @notice Whole-token supply before decimals: one billion.
    uint256 public constant SUPPLY_WHOLE_TOKENS = 1_000_000_000;

    /// @notice The entire supply in minor units (18 decimals): 1,000,000,000 * 10^18.
    uint256 public constant TOTAL_SUPPLY = SUPPLY_WHOLE_TOKENS * 1e18;

    /// @notice Mints the whole supply to the deployer. This is the only mint that ever happens.
    constructor() ERC20(TOKEN_NAME, TOKEN_SYMBOL) {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
