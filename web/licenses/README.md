# Attribution

- Interface guidance: Jakub Krehel, **Better Interface**, MIT, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. [Upstream](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface). The assignment's adapted guide was used for design and review.
- Documentation guidance: Paul Bakaus, **Impeccable**, Apache-2.0, copyright 2025 Paul Bakaus, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. [Upstream documentation method](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md). The final design documentation was written for this implementation using the assignment's adapted method. Both guidance licenses are retained in `Design-guidance.txt`.
- **DM Sans** Latin variable normal font from `@fontsource-variable/dm-sans`; SIL Open Font License retained in `DM-Sans-OFL.txt`.
- MetaMask, Rabby and Phantom SVG marks from **RainbowKit 2.2.11**; MIT notice retained in `RainbowKit-MIT.txt`. Coinbase mark comes from the pinned wallet guide. Wallet trademarks remain their respective owners'.
- Runtime dependency notices and the font/artwork licenses are also bundled in `web/public/third-party-notices.txt` and copied into `dist/`.

Implementation references checked while building: [wagmi configuration](https://wagmi.sh/react/api/createConfig), [Coinbase connector](https://wagmi.sh/react/api/connectors/coinbaseWallet), and [Rabby's mobile universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts). No external fonts, icon CDN or analytics are required by the dashboard.
