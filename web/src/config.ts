import { createConfig } from 'wagmi';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { createPublicClient, defineChain, fallback, getAddress, http, type Abi } from 'viem';
import { contracts as deployedContracts } from '../config/deployment.json';
import networkConfig from '../config/network.json';
import tokenAbi from '../config/abis/HiveDeskToken.json';

// Build-time imports. No runtime address discovery or fallback addresses.
export const network = networkConfig.network;
export const walletAddChain = networkConfig.walletAddChain;
export const chain = defineChain({
  id: network.chainId,
  name: network.name,
  nativeCurrency: network.nativeCurrency,
  rpcUrls: { default: { http: network.rpcUrls } },
  blockExplorers: { default: { name: 'Etherscan', url: network.explorer } },
  testnet: network.testnet,
});

export const contractRecords: ReadonlyArray<{ name: string; address?: string | null }> = deployedContracts;
const tokenRecord = contractRecords.find((contract) => contract.name === 'HiveDeskToken');
export const token = {
  address: tokenRecord?.address ? getAddress(tokenRecord.address) : undefined,
  // Keep the attested full ABI in config; the application receives only read methods.
  abi: tokenAbi.filter((entry) => entry.type === 'function' && entry.stateMutability === 'view') as Abi,
};

const transport = () => fallback(
  network.rpcUrls.map((url) => http(url, { timeout: 8_000, retryCount: 0 })),
  { retryCount: 0 },
);

export const publicClient = createPublicClient({ chain, transport: transport() });
export const walletConfig = createConfig({
  chains: [chain],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'HiveDesk',
      appLogoUrl: new URL('./favicon.svg', document.baseURI).href,
      preference: { options: 'smartWalletOnly' },
    }),
  ],
  transports: { [chain.id]: transport() },
});

export const explorerAddress = (address: string) => `${network.explorer}/address/${address}`;
export const explorerBlock = (block: bigint) => `${network.explorer}/block/${block}`;
