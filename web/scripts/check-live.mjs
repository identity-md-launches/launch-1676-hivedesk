import { createPublicClient, http, formatUnits, keccak256 } from 'viem';
import { validateConfig } from './validate-config.mjs';

const { network, token, abi } = await validateConfig();
if (!token?.address) {
  console.log('Token address is unset; no live read attempted.');
} else {
  for (const rpc of network.rpcUrls) {
    const client = createPublicClient({ transport: http(rpc, { timeout: 15000, retryCount: 0 }) });
    try {
      const chainId = await client.getChainId();
      if (chainId !== network.chainId) throw new Error('Wrong RPC chain.');
      const blockNumber = await client.getBlockNumber();
      const code = await client.getCode({ address: token.address, blockNumber });
      if (!code || code === '0x') throw new Error('No deployed code.');
      const contract = { address: token.address, abi, blockNumber };
      const [name, symbol, decimals, supply] = await Promise.all(['name', 'symbol', 'decimals', 'totalSupply'].map((functionName) => client.readContract({ ...contract, functionName })));
      console.log(JSON.stringify({ rpc, chainId, blockNumber: String(blockNumber), codeHash: keccak256(code), name, symbol, decimals, totalSupply: formatUnits(supply, decimals) }, null, 2));
    } catch (error) {
      console.error(`${rpc}: ${error.shortMessage ?? error.message}`);
      process.exitCode = 1;
    }
  }
}
