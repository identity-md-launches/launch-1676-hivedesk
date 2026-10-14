# HiveDesk dashboard validation

**Complete for the stated scope.** This is the worker's evidence record, not independent certification. Reviewed on 2026-10-14. The deliverable is the read-only token dashboard, not an undeployed trading-desk integration.

## Scope and assumptions

The existing repository had the deployed ERC-20 and no frontend. Its Solidity sources, dependencies and Foundry configuration were preserved. The interface uses a restrained light theme, locally bundled typography and a compact dashboard layout. Only the supplied HiveDeskToken record is an application read target. No application contract interface, address, transaction, financial return or benchmark was fabricated.

The production export is `dist/`, served under `/preview/` for browser checks. React, TypeScript and Vite source and the npm lockfile live under `web/`. Build-time configuration is preserved under `web/config/`; `.imd/reads/` is not a build dependency. No publishing or onchain deployment was performed.

## Requirement coverage

| Requirement | Result | Evidence |
| --- | --- | --- |
| Token name, symbol, supply, address and Etherscan link | Met | Live RPC reads; `TokenPanel`; `live-read-check.txt` |
| Connected wallet's read-only HVD balance | Met | Account-specific `balanceOf`, exact decimal formatting and source-block link; browser checks |
| Desk NAV, all benchmarks, decisions and signers awaiting deployment without numbers | Met | All `data-awaiting-section` regions checked for explicit state and absence of digits |
| Addresses and ABI from build-time config; missing addresses stay awaiting | Met | JSON imports; separate unset-address build with no RPC requests; `unset-config-result.json` |
| No fabricated data or privileged writes | Met | No write hooks, transaction controls or signing requests; instrumented provider checked requested methods |
| Usable primary interactions and responsive layouts | Met | Chromium and WebKit interaction suite, 320–1440px reflow checks and screenshot inspection |
| Source, lockfile and static export with relative assets | Met | `web/package-lock.json`, `web/src`, `dist`; tested from `/preview/`; asset/package audit |
| Production build and typecheck | Met | `build.txt`, `typecheck.txt`, both successful |
| Better Interface applied, reviewed and documented | Met | Six-domain coverage and fixed findings below; root `DESIGN.md` |
| Product and main action on first screen at 390px | Met | `screenshots/chromium-390.png`, `screenshots/webkit-390.png`; title, Connect and supply within viewport |
| Title, favicon, description, og:title and og:image | Met | HTML inspection, taste share check and successful local PNG request |
| README install/preview/rebuild instructions | Met | Isolated frontend helper commands in root `README.md` |

## Commands and results

| Command | Actual result |
| --- | --- |
| `forge inspect src/HiveDeskToken.sol:HiveDeskToken abi --json` | Succeeded; generated the delivered ABI from source commit `53a05f5f5a21936fa280dcfd2930b99af4aa109c` |
| `forge inspect src/HiveDeskToken.sol:HiveDeskToken deployedBytecode` | Succeeded; local runtime keccak256 matches the code hash below |
| `node web/scripts/site.mjs install` | Succeeded using the lockfile; dependencies and cache installed outside the repository |
| `node web/scripts/site.mjs typecheck` | Passed, exit 0; TypeScript `tsc --noEmit` |
| `node web/scripts/site.mjs build` | Passed, exit 0; config/ABI validation then production Vite build; complete root export replaced |
| `node web/scripts/site.mjs check:live` | Passed, exit 0; both configured RPCs returned the correct chain, code and metadata |
| `node web/scripts/site.mjs check:ui` with the temporary browser environment below | Passed, exit 0; 30 grouped checks across Chromium and WebKit |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` with `IMD_PLAYWRIGHT` and `PLAYWRIGHT_BROWSERS_PATH` pointing to the temporary installation | Passed, exit 0; all 16 taste@1 checks |
| Unset-address variant, built only in `/tmp/hivedesk-unset/`, then `node test/scratch/check-unset.mjs` | Passed; token/wallet awaiting, no displayed amount/address, no RPC request, Connect picker usable |
| Altered ABI in the temporary variant, then `validate-config.mjs` | Correctly rejected with exit 1 and an attested ABI mismatch; original ABI restored |

The main bundle has a Vite advisory for exceeding its default 500 kB chunk threshold. This is not a build failure. The complete export is under 1 MiB before compression. Required chunks and assets remain included. Exact file sizes and hashes are in `submission-audit.json`.

### Chain verification

- ABI canonical keccak256: `653a910baac1f277442ac4ff542927b5d40e82a40b904b1130f1fd39656d391e`, equal to the pinned `abiHash`.
- Runtime bytecode keccak256: `0xd71bbeee0d13450a38a323a7d2a13b18a590ac73440d86777293145e39ffd45c`, equal for the local compiled runtime and both configured endpoints.
- The recorded live endpoint check was at Ethereum block `26188074`; both endpoints returned HiveDesk / HVD, decimals 18 and total supply `1000000000` whole tokens. These are validation observations, not frontend fallback values.
- The browser application imports only the deployment's contract records. Supply text and manifest prose are absent from the production application bundle. No data falls back to those static values.

### Interaction evidence

`interaction-results.json` records each grouped check and its browser. The suite exercised:

- Public metadata/supply reads and exact explorer targets, without connecting a wallet.
- Layout at 320, 390, 768, 1024 and 1440px; main action/product at 390px; CSS text enlarged to 200%.
- Hash navigation; copied-address feedback and denied-clipboard recovery.
- No-extension message, modal keyboard cycle, Escape/backdrop dismissal and focus restoration.
- Primary RPC failure with secondary fallback; total outage, amount removal and successful retry.
- Phone bottom sheet, local wallet marks, four deep links retaining the full page subpath, Coinbase Smart Wallet row and no generic injected row on a phone without a provider.
- Multiple named EIP-6963 providers with generic-row suppression; rejected connection, pending row and successful connection.
- Real `balanceOf` reads for addresses present in the supplied deployment; account changes replace the position, including an actual zero balance when returned by the contract.
- Failed balance refresh removes the old amount; Retry restores the live result.
- Unsupported wallet network removes the balance; rejected switch remains recoverable; unknown-chain fallback sends the pinned add-chain parameters.
- Stored reconnect after reload; disconnect clears the position; no signing or transaction method requested.
- Automated axe checks of the loaded dashboard and mobile dialog; no violations under the selected WCAG A/AA tags. No unexpected page exceptions or missing local resources.

Wallet **authorization was simulated**, using an explicit test-only EIP-6963 provider. It used real supplied account addresses and real RPC balance reads, not a user's extension, key or fabricated balance. It is in the validation script only and is not part of the static site. The suite records the block from which its independent expected values were read.

### Browser environment

Chromium and WebKit came from Playwright 1.64.0. Browser binaries were installed under `/tmp/hivedesk-browsers`; npm dependencies and caches were also outside the repository. WebKit initially could not start because system libraries were absent, then could not read HTTPS because the GIO TLS module was absent. These were environment failures, repaired with Ubuntu library packages extracted under `/tmp/hivedesk-system-libs/root`.

The successful WebKit run used `LD_LIBRARY_PATH`, `GIO_EXTRA_MODULES`, `GSETTINGS_SCHEMA_DIR`, `LIBGL_DRIVERS_PATH` and `__EGL_VENDOR_LIBRARY_FILENAMES` pointing into that temporary directory, plus software rendering and a temporary Mesa shader cache. Its temporary MiniBrowser wrapper was adjusted to preserve the supplied library search path. Browser-internal sandbox and standard-location dependency preflight were disabled for this restricted test environment; the actual browser and HTTPS reads then ran successfully. No machine-specific libraries, browser binaries, package archives or wrapper changes are in this repository.

The final production export was also inspected through the provided browser tool: desktop and 390px screenshots, the no-extension wallet picker, keyboard dismissal/focus return, rendered colors, font loading, console and local resources. Temporary tool output was removed after inspection. The durable screenshots are the suite's final export captures in `artifacts/screenshots/`.

## Better Interface review

The pinned guide's workflow, all six core domains and the documentation method were read and applied. Review covered the dashboard, missing-deployment states, wallet picker/account dialog and loading/error/recovery states.

| Domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native links/buttons/dialog, landmarks, accessible names, skip link, 44px controls, keyboard cycle/focus restoration, reduced motion, automated axe scans. No manual screen-reader session or physical assistive device. |
| Layout | Checked | Actual screenshots and overflow measurements at five widths; 200% CSS text enlargement; wrapping addresses/amounts and modal scroll containment. No native zoom, translated-string or RTL-mirror test. |
| Writing | Checked | Consistent sentence case, verb-led actions, inline recovery, explicit awaiting state with no invented numbers; no “live desk” claim. English only. |
| Typography | Checked | Local DM Sans loaded, two families, three used weights and six defined sizes; tabular exact amounts; full selectable addresses; heading roles reviewed. No native OS font rendering comparison. |
| Colors | Checked | Semantic token inventory, rendered solid-background text contrast and taste/axe checks; primary/accent 9.67:1, muted/wallet 4.92:1, muted/surface 5.33:1. Light theme only; external wallet screens excluded. |
| UI | Checked | Hover/focus/press/disabled styling, pending/rejected/connected/disconnected states, empty/error/retry, restrained 120ms transitions, no page-load or endless motion, one shadowed modal. Animation-panel playback at 10% speed not performed. |

The visual idea is a quiet ledger with the useful token data first and a single honey-colored wallet action. The final taste probe reports no overflow, text overlap, hidden clipping, undersized crowded controls, contrast failure, excess type scale, repeated prose, nested cards, border-plus-shadow surfaces or endless motion. At 390px and 1440px the actual page uses five type sizes; the system defines six across variants.

### Findings, fixes and rechecks

| Severity / domain | Source and observed problem | Fix and recheck |
| --- | --- | --- |
| High / accessibility | `web/src/WalletControl.tsx:112`: relying solely on native dialog behavior let repeated Tab leave the modal's element cycle in Chromium. | Added explicit first/last Tab and Shift+Tab wrap while retaining native modal semantics and focus return. Both browser suites pass modal cycling, Escape and backdrop dismissal. |
| High / layout | `web/src/styles.css:103` and `:117`: at 390px with root text enlarged to 32px, nonwrapping navigation and token header extended document width to 530px. | Enabled flex wrapping for both groups. 200% CSS text enlargement now has no horizontal overflow in Chromium or WebKit. Normal-width screenshots retained their alignment. |
| Low / UI | `web/src/styles.css:245`: the mobile read-footer flex basis did not reserve its gap, pushing Refresh to the block row. | Reserved the button plus gap in the flex basis. Final 390px screenshots show Refresh beside the read status, with the source block below. |
| Low / typography and semantics | `web/src/App.tsx:70`: the wallet prompt used a larger `h3` beneath the smaller panel `h2`. | Changed the prompt to emphasized instructional prose, keeping the intended size and layout; section headings now retain their hierarchy. Rebuilt and repeated rendered checks. |
| Low / colors | `web/src/styles.css:33`: decorative outlines and overlay/shadow colors were literal component values. | Named existing values as semantic tokens without changing their appearance; documented the final tokens in `DESIGN.md`. |

No unresolved implementation finding remains in the requested scope. The final review's copy findings are resolved; the share card is a real local PNG with its editable HTML source retained.

## Remaining limitations

- Real wallet-extension permission screens, native phone handoff and Coinbase passkey account creation/authorization were not completed. Mobile links were checked structurally; browser-provider states were simulated and disclosed.
- Headless WebKit is useful Safari-engine coverage, not a physical iPhone test.
- No manual screen-reader session, native browser zoom, RTL/translation, forced-colors device session or slowed animation-panel inspection was performed. Light-theme contrast was measured; there is no dark theme to test.
- Public RPC availability and wallet-vendor services remain external dependencies. The site exposes read failures and retry controls. Data is a block-labeled snapshot, updated on manual refresh/reconnection rather than continuous polling.
- OG URLs are relative because the hosting address is assigned after this task. The share image asset resolves under the tested subpath; actual social-network unfurl behavior after publishing was not tested.
- The supplied desk contracts do not exist in the pin. This dashboard intentionally cannot display their values until a later verified integration.

## Submission hygiene

The final audit checks unchanged protected tracked files, complete static assets, matching pinned configuration, absence of symlinks/submodules/dependency caches and the complete candidate file budget. `submission-audit.json` records exact sizes and export hashes. No ignore file was changed. No dependency cache, `node_modules`, vendored registry, package archive or temporary browser output is submitted. `test/scratch/` contains disposable checks and is excluded by the assignment. Because the workspace also excludes `artifacts/` from Git, the report and durable evidence are copied to `web/validation/`; no ignore rule was changed.
