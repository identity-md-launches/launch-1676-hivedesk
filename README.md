# HiveDesk (HVD)

A fixed-supply ERC-20 token and a public, read-only dashboard on Ethereum mainnet.

## Dashboard

The production website is in **[dist/index.html](dist/index.html)**, with its complete local assets. Its React/TypeScript source, Vite configuration, package manifest and lockfile are under **[web/](web/)**. Serve `dist/` over HTTP or HTTPS; opening the HTML with `file://` does not support its module and wallet behavior. Hosting and onchain deployment are outside this change.

The dashboard reads HiveDeskToken's name, symbol, decimals and total supply from Ethereum. Connecting a wallet enables an exact HVD balance read for that account. Every successful snapshot links to its source block. Refresh controls fetch new snapshots; there is no periodic polling, price API, backend, signature request, approval or transaction action.

Desk NAV, BTC, equity index and coin flip benchmarks, performance history, decision log and oracle signers explicitly show **Awaiting deployment**, without numeric placeholders or invented history. The supplied deployment lists only HiveDeskToken, so none of those application contracts is required to use this token dashboard.

The wallet picker supports named EIP-6963 browser wallets, mobile links to MetaMask/Coinbase/Rabby/Phantom, and Coinbase Smart Wallet. It needs no relay project ID. Connecting grants account visibility only. The connected control opens the account/disconnect dialog; on an unsupported network it offers a switch to the configured Ethereum network. Use HTTPS for a hosted wallet connection; localhost works for local preview.

### Install, typecheck, rebuild and preview

Use Node.js 24 and npm 11 (the versions used for validation). From the repository root:

```sh
node web/scripts/site.mjs install
node web/scripts/site.mjs typecheck
node web/scripts/site.mjs build
node web/scripts/site.mjs preview
```

The helper prints its workspace and preview URL. It installs locked dependencies and caches in an isolated operating-system temporary directory, keeping `node_modules` and caches out of this repository. The build copies the current source to that workspace, validates the ABI/configuration, runs Vite, and replaces the root `dist/` with the complete result. Run `install` again if the lockfile changes or the temporary directory is removed. Preview runs in the foreground; stop it with Ctrl+C.

Vite uses `base: './'`. The page uses hash anchors and every required local asset is relative, so the committed export can be served from a static gateway subpath without a routing server. The publisher can use `dist/` directly without rebuilding. Preserve all files in `dist/`, including the Coinbase SDK chunk, font, wallet marks, favicon, share card and dependency notices.

### Configuration and contract provenance

[web/config/deployment.json](web/config/deployment.json) and [web/config/network.json](web/config/network.json) preserve the exact assignment pins. They are build-time inputs, independent of `.imd/reads/`, which is not needed to rebuild. The only configured application target is HiveDeskToken at the address supplied in that deployment. No contract was redeployed or modified by this website task.

The full [token ABI](web/config/abis/HiveDeskToken.json) was derived from the pinned Solidity source. Every production build checks its canonical keccak256 against the attested `abiHash`; the client receives only its `view` functions. The local runtime bytecode hash also matched deployed code on both RPCs during validation. See [configuration notes](web/config/README.md) for the derivation and hash.

If the token address is unset, its token and wallet sections remain awaiting deployment and make no token reads. Failed RPC reads show an error and Retry; they never use the manifest's supply as a fallback. Missing desk contracts have no fabricated ABIs or addresses. A future desk integration requires verified deployment pins and separately implemented adapters.

### Validation

Actual worker results, findings, fixes and limitations are recorded in **[web/validation/REPORT.md](web/validation/REPORT.md)**. The implemented visual system is documented in **[DESIGN.md](DESIGN.md)**. The report and evidence are also supplied under `artifacts/`; `web/validation/` preserves them in the Git submission because this workspace excludes `artifacts/`.

The production build, TypeScript check and canonical ABI check passed. Both public RPCs returned token data and matching deployed code. Chromium and WebKit completed 30 interaction checks, including wallet discovery, rejected/pending connections, account changes, balance failures/retries, network switching, reconnect/disconnect, keyboard dialog behavior and static subpath assets. The pinned taste probe passed all 16 checks. A separate unset-address build made no RPC reads and showed awaiting states. A changed ABI was correctly rejected by the build validator.

To repeat the browser suite on a machine with Playwright's required system libraries:

```sh
node web/scripts/site.mjs browsers
node web/scripts/site.mjs check:live
node web/scripts/site.mjs check:ui
```

The browser suite starts and closes its own local server. Its wallet provider is explicitly a validation simulation using real pinned account addresses and live balance reads; it has no keys and cannot sign or send transactions. It writes results and screenshots under `artifacts/`. The worker's restricted machine needed temporary Linux libraries and software rendering for WebKit; exact environment details are in the validation record. No such libraries or browser binaries are shipped.

The suite does not establish real extension authorization, native phone handoff, Coinbase passkey completion, screen-reader behavior or browser-native zoom. Those checks remain unperformed. Vite reports a non-fatal main-chunk size advisory; the export is complete and remains well below the assignment's total size cap. These are worker observations, not independent certification.

The share card is a local PNG rendered from [web/design/share.html](web/design/share.html); [render-share.mjs](web/scripts/render-share.mjs) regenerates it with Playwright. Font, artwork and design-guide attributions are in [web/licenses/README.md](web/licenses/README.md).

## Token implementation

The existing contract implementation and Foundry build configuration are preserved. The following contract notes describe the original token deliverable.

| Item | Value |
| --- | --- |
| Token name | HiveDesk |
| Symbol | HVD |
| Decimals | 18 |
| Total supply | 1,000,000,000 HVD = `1000000000000000000000000000` minor units |
| Solidity contract | `HiveDeskToken` (`src/HiveDeskToken.sol`) |
| Constructor arguments | none |
| Compiler | solc 0.8.26, optimizer on (200 runs), EVM `cancun`, `bytecode_hash = "none"` |

The whole supply is minted once, in the constructor, to `msg.sender`. Nothing can mint afterwards.

## What the contract does

`HiveDeskToken` inherits OpenZeppelin's `ERC20` (v5.4.0, vendored under `lib/`) and adds only
constants and a constructor. It deliberately has:

- no owner, admin role or minter;
- no pause, blocklist, freeze, lock, seize or `burnFrom`;
- no fee, tax, burn or reflection on transfer: every transfer moves exactly the amount requested;
- no proxy, `delegatecall`, `callcode` or `selfdestruct`;
- no `receive` or `fallback`, so stray ETH is rejected;
- no external library calls, so the bytecode has no link placeholders.

Holders keep the ordinary ERC-20 surface: `transfer`, `approve`, `transferFrom`, `allowance`,
`balanceOf`, `totalSupply`, `name`, `symbol`, `decimals`, plus the `Transfer` and `Approval` events.
A holder can send tokens to any non-zero address; nobody else can move or freeze them.

## Assumptions

- **The deployer receives everything.** `msg.sender` of the constructor gets the full supply. At
  the IdentityMD launch that is the ProjectFactory, which then pays it out. If anyone deploys this
  contract some other way, whoever deploys it holds the supply.
- **Supply is final.** There is no mint function. The supply can only shrink if a holder sends
  tokens to an unrecoverable address; the contract itself has no burn.
- **No owner is needed.** The brief asks for a plain token, so there is no owner and nothing for
  an owner to set after launch. The token therefore has no "After launch" settings.
- **Standard ERC-20 semantics.** `transfer` and `transferFrom` return `true` or revert with
  OpenZeppelin's ERC-6093 custom errors (`ERC20InsufficientBalance`, `ERC20InsufficientAllowance`,
  `ERC20InvalidReceiver`, `ERC20InvalidSender`, `ERC20InvalidSpender`). An allowance of
  `type(uint256).max` is treated as infinite and is not decremented.

## Deployment parameters

The launch deploys the token from its built bytecode through the ProjectFactory. The values the
manifest step will record, as given by the launch, are:

| Manifest field | Value |
| --- | --- |
| `token.contract` | `HiveDeskToken` |
| `token.name` | `HiveDesk` |
| `token.symbol` | `HVD` |
| `token.decimals` | `18` |
| `token.constructorArgs` | `[]` |
| `token.totalSupply` | `1000000000000000000000000000` |
| application contracts | none |
| chain | Ethereum (chain id 1) |
| pool pair | IMD, `0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7` |
| pool fee / tick spacing | `12500` (1.25%) / `60` |
| economics | 80% of supply seeds the pool, opening cap 2,500 IMD, remainder to `0x612a9bb008e16ef2d24f41dae9fc661831d93367` |

The launch flows (factory to MerkleDistributor, pool seed through the Uniswap v4 PoolManager,
remainder to the requester, claims, swaps) all run as plain untaxed transfers, so each arrives whole.
Ten percent of the supply goes to the swarm by construction of the launch, not by anything in this
contract.

`launch.json` is written by the manifest step after acceptance. It is intentionally absent here.

### Local rehearsal script

`script/DeployHiveDeskToken.s.sol` exists for review and local rehearsal only. Its `deploy()` function
takes no configuration (the token has no constructor arguments) and is what the tests call. `run()`
wraps it in a broadcast. It is not how the mainnet launch is performed and must not be broadcast
against mainnet by a contributor.

## Operational responsibilities

- **Requester**: holds the remainder address `0x612a9bb008e16ef2d24f41dae9fc661831d93367` and
  whatever reaches it. There are no owner keys to rotate and no settings to maintain, because the
  token has no privileged functions.
- **IdentityMD deployer**: builds the attested source, deploys through the factory, seeds the pool,
  forwards the swarm share and the remainder, and verifies the source on the block explorer with
  `forge verify-contract` after deployment. That step is outside this task.
- **Holders**: are responsible for their own keys and approvals. Grant only the allowance a spender
  needs; an infinite allowance to a compromised contract can drain a wallet.
- **Nobody** can pause, freeze, seize or dilute. If that is ever wanted, it needs a new token.

## Security review

The checklist from the pinned `eth-security` reference was applied. Items that apply to a plain
token and how they are met:

- Access control: there are no privileged functions, so there is nothing to restrict.
- Reentrancy: the contract makes no external calls.
- Decimals: 18, fixed; the supply constant is derived from it and tested against `decimals()`.
- Return values and input validation: inherited from OpenZeppelin ERC20 v5.4.0, which rejects the
  zero address as sender, receiver and spender and reverts on insufficient balance or allowance.
- Events: `Transfer` on mint and every transfer, `Approval` on every approval.
- No proxies, signatures, oracles, swaps or delegatecall, so those items do not apply.
- Runtime opcode scan for DELEGATECALL, CALLCODE and SELFDESTRUCT is part of the test suite.

Tools run: `forge build`, `forge test` (including fuzz tests with the verifier's seed) and
`forge fmt --check`. Slither and Mythril were not available on this machine and did not run. Passing
tests are not an audit. Work that holds other people's funds needs an independent adversarial review
before release; this token holds nothing itself.

## Building and testing

```sh
forge build
forge test
forge fmt --check
```

Dependencies are vendored as ordinary files (no git submodules), so everything builds offline:

- `lib/forge-std` — forge-std v1.11.0 (`src/` only, MIT/Apache-2.0)
- `lib/openzeppelin-contracts` — the OpenZeppelin v5.4.0 files `ERC20` needs (MIT)

Tests read no environment variables and do not depend on the calling address, so they pass in any
order and in parallel. The test suite covers: metadata, a single constructor mint to the deployer,
independence of deployments, absence of every common mint and admin selector from both a stranger
and the deployer, that no privileged call can move or freeze a holder, launch flows arriving whole,
exact transfer amounts and supply conservation (fuzzed), allowance semantics including the infinite
allowance, reverts on insufficient balance, insufficient allowance and zero addresses, rejection of
plain ETH, and the runtime opcode scan.
