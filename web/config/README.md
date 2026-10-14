# Dashboard configuration

`deployment.json` and `network.json` are byte-for-byte copies of the assignment's pinned inputs. They must remain available after `.imd/reads/` is removed. The frontend imports these at build time; it never fetches configuration from a remote host.

Only `contracts` from the deployment is imported by the application. Manifest token supply and descriptive notes are provenance, never data fallbacks. The application's token name, symbol, supply, decimals and wallet balance all come from `eth_call`.

`abis/HiveDeskToken.json` was generated from `src/HiveDeskToken.sol` at source commit `53a05f5f5a21936fa280dcfd2930b99af4aa109c` using:

```sh
forge inspect src/HiveDeskToken.sol:HiveDeskToken abi --json
```

Every production build validates the full ABI against the pinned `abiHash`. Canonicalization preserves array order, sorts object keys recursively and serializes compact JSON; keccak256 is computed over its UTF-8 bytes. The resulting hash is `653a910baac1f277442ac4ff542927b5d40e82a40b904b1130f1fd39656d391e`. The runtime receives only `view` functions; it has no write-contract UI or transaction path.

An empty, null or absent token address leaves token details and wallet position in **Awaiting deployment**. The build rejects malformed nonempty addresses. Removing the token contract record is also supported. No zero or guessed fallback address is used.

There are no supplied application contracts or ABIs. Desk NAV, benchmarks, decision log and oracle signers therefore always render explicit awaiting states without numbers. The dependency names in `src/App.tsx` describe what is missing; they do not create contract interfaces. Future activation requires a new verified deployment pin, exact ABIs and a separately implemented read adapter. Merely inserting an address does not turn invented metrics on.

Reads use the configured Ethereum RPCs in order, with the second as a fallback. They confirm the chain ID and contract code presence, pin each snapshot's calls to one fetched block, and expose that block's explorer link. They time out, show an actionable error and hide amounts if both endpoints fail. There is no cached manifest value, API price feed, sample chart, backend or transaction sender.
