# HiveDesk interface

## Overview

HiveDesk is a public, read-only Ethereum token dashboard. The implemented visual idea is a quiet ledger with a honey-colored wallet action. Token details come first; the wallet position sits alongside them on wide screens. Undeployed desk features remain visible as explicit, text-only states. There is no marketing hero or simulated performance chart.

The source of truth is [web/src/styles.css](web/src/styles.css), with markup and state handling in [App.tsx](web/src/App.tsx) and [WalletControl.tsx](web/src/WalletControl.tsx). The light theme is deliberate. A dark theme and localization are not implemented.

## Colors

The CSS uses hex primitives and semantic role tokens. Components consume the semantic tokens.

| Token | Value | Role |
| --- | --- | --- |
| `--color-page` | `#f5f5f0` | Page canvas |
| `--color-surface` | `#fffefa` | Token, metric and activity surfaces; dialog |
| `--color-hover` | `#efefe7` | Neutral control hover |
| `--color-border` | `#dddfd4` | Structural borders and dividers |
| `--color-ink` | `#24271e` | Primary text and icons |
| `--color-muted` | `#686c60` | Labels, explanations and awaiting states |
| `--color-accent` | `#f1cb48` | Primary connect control and brand mark |
| `--color-accent-hover` | `#e5bc30` | Primary control hover |
| `--color-wallet` | `#faf5df` | Wallet panel tint |
| `--color-success` | `#2d684d` | Dot beside the successful read label |
| `--color-error` | `#a33729` | Recoverable wallet and clipboard errors |
| `--color-focus` | `#24271e` | Keyboard focus perimeter |
| `--color-wallet-outline` | `#c5b778` | Decorative wallet circle |
| `--color-empty-outline` | `#9da291` | Decorative empty-history outline |
| `--color-overlay` | `#24271e66` | Modal backdrop |

Status always includes text; the green dot alone never communicates successful reads. The yellow background marks the primary action, while the pale wallet tint groups account information. Vendor wallet marks retain their official colors.

Measured rendered text contrast: primary/page **13.87:1**, primary/surface **15.04:1**, muted/surface **5.33:1**, muted/wallet **4.92:1**, primary/accent **9.67:1**, awaiting/page **4.92:1**. These measurements apply to the named solid color pairs, not to every possible overlay or external wallet screen. See [validation](web/validation/REPORT.md).

## Typography

DM Sans is bundled locally as [dm-sans-latin.woff2](web/src/assets/dm-sans-latin.woff2), with `system-ui, sans-serif` fallbacks and `font-display: swap`. The variable normal face supports weights 100–1000; the interface uses only **400, 500 and 600**. Addresses use `ui-monospace, SFMono-Regular, Consolas, monospace`. There are no remote font requests or italic styles. Browser checks confirmed the local font loaded.

| Size token | At the default root size | Use |
| --- | --- | --- |
| `--text-small` | 14px | Labels, navigation, supporting copy, addresses |
| `--text-body` | 16px | Body copy and metric headings |
| `--text-subheading` | 18px | Panel headings and token units |
| `--text-heading` | 22px | Section titles, brand and desktop wallet prompt |
| `--text-value` | 32px | Wallet amounts and mobile title/supply |
| `--text-display` | 40px | Desktop page title and supply |

Body line height is 1.5; headings are 1.2; supply is 1.25; wallet amounts are 1.3; addresses are 1.7. Display tracking is −0.04em on the title and −0.035em on supply. Smaller headings use −0.015em to −0.025em. Labels and prose have normal tracking and sentence case. No small capital kickers are used.

Headings balance their wraps and supporting copy uses `text-wrap: pretty`. Addresses and exact token amounts wrap with `overflow-wrap: anywhere`. Full addresses remain available in the panel and wallet dialog; only the header wallet control uses the conventional short address. Amounts retain all onchain decimals, use tabular numerals and never pass through JavaScript `Number`.

## Layout

The header and main container are capped at **1280px**, including **40px** desktop inline padding. Footer content aligns at **1200px**. The spacing tokens are **4, 8, 12, 16, 24, 32, 40 and 48px**; compact mobile and metric insets also use **20px**. Related values share 8–16px gaps; major sections have 32–48px separation.

Desktop overview columns use `1.8fr / 1fr`, with 24px between token and wallet panels. Metrics use four equal columns with 16px gaps. The decision log and signers use equal columns. Reading order in the DOM is also the mobile order: token, wallet, performance, decisions, signers.

| Breakpoint | Implemented behavior |
| --- | --- |
| At or below 74rem / 1184px | Header network label is omitted; overview ratio becomes `1.5fr / 1fr`; metric padding tightens |
| At or below 58rem / 928px | Navigation wraps to its own row; token and wallet stack; metrics become two columns; decorative wallet circle is omitted |
| At or below 40rem / 640px | 20px page margins; 32px title/supply; metrics and activity stack; read footer wraps; wallet picker becomes a bottom sheet |
| At or below 23rem / 368px | Brand becomes 18px and the redundant token-header network label is omitted |

Navigation and panel headers wrap when text grows. Text containers grow with their content. There are no fixed or sticky controls overlaying content. The modal accounts for the bottom safe area and scrolls within the viewport. Reflow was checked at **320, 390, 768, 1024 and 1440px**, plus 200% CSS text enlargement at 390px. CSS text enlargement is not a native browser zoom test.

## Elevation & Depth

The dashboard is flat: a 1px border defines each surface and there are no panel shadows or nested cards. The wallet panel uses a tonal background. The modal alone uses `--shadow-dialog: 0 24px 80px #24271e33`, with no border, above a `#24271e66` backdrop. The native modal makes background content inert.

## Shapes

Controls use `--radius-control: .5rem` (8px); panels use `--radius-panel: .875rem` (14px). The dialog has 16px corners; its bottom-sheet variant rounds only the top. The section status pill uses a 2rem radius. Small circular marks distinguish read status and empty history. The brand uses a compact, angular hive mark from [icons.tsx](web/src/icons.tsx) and [favicon.svg](web/public/favicon.svg).

## Components

| Component/pattern | Source | Behavior |
| --- | --- | --- |
| `TokenPanel` | `web/src/App.tsx` | Reads name, symbol, decimals and supply; full address, copy action, explorer and source block; loading, error/retry and address-unset states |
| `WalletPanel` | `web/src/App.tsx` | Disconnected guidance, wrong-network guidance, exact balance and source block; account-scoped reads; refresh/error/retry; unset token state |
| `WalletControl` | `web/src/WalletControl.tsx` | Single primary control, EIP-6963 discovery, mobile deep links and Coinbase; connection pending/rejection, account details, network switch and disconnect |
| `Awaiting` | `web/src/App.tsx` | Clock icon and explicit “Awaiting deployment” label; no numeric substitute |
| Metric / activity surface | `web/src/App.tsx` | Same heading, description and awaiting pattern for each missing capability; no disabled fake controls |
| `CopyAddress` | `web/src/App.tsx` | “Copied” confirmation; persistent manual-selection advice when clipboard access fails |
| `ExternalLink` | `web/src/App.tsx` | External-link icon, accessible new-tab description and `rel="noreferrer"` |
| Buttons | `web/src/styles.css` | Primary filled, secondary bordered, quiet text, and 44px icon buttons; visible hover, press, disabled and focus states |

The wallet dialog has a heading, description, named wallet rows and a close control. Desktop width is at most 440px. Rows are at least 56px, including on mobile. Tab and Shift+Tab cycle within the modal; Escape, backdrop and Close dismiss it; focus returns to Connect. Full connected addresses wrap. Pending rows disable other wallet choices while leaving Close usable. Errors stay next to the choices in a polite status region.

Focus uses a 2px perimeter with a 4px offset, and forced-colors mode uses the system `Highlight` color. Transitions name only background color and transform, last 120ms, and press feedback scales to 0.96. Reduced motion removes the scale and reduces durations. Nothing animates on page load or loops indefinitely. Icons use `currentColor` with a 1.6px stroke; logos and wallet marks are artwork.

## Do's and Don'ts

- Reuse the page container, type tokens, button variants and surface patterns before adding styles.
- Keep the primary wallet action near the product on the first mobile screen.
- Render contract-derived values only after a successful read. Include their source block and an explicit retry on failure.
- Keep unknown metrics in the awaiting pattern. Do not draw estimated curves, numeric placeholders, fake activity or future contract interfaces.
- Preserve exact amounts and complete addresses through wrapping, rather than clipping or rounding them.
- Keep future pages in the same hash-navigation/static-export model. Add verified read adapters only when their deployment and ABI are supplied.

Design guidance was reviewed across all six pinned Better Interface domains. Attribution and license records are in [web/licenses](web/licenses/README.md); findings and unperformed checks are in [the validation report](web/validation/REPORT.md).
