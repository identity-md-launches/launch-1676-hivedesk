import { useQuery } from '@tanstack/react-query';
import { formatUnits, type Address } from 'viem';
import { chain, publicClient, token } from './config';

export type TokenSnapshot = {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  blockNumber: bigint;
};

async function checkedBlock() {
  if (!token.address) throw new Error('Token address is unset.');
  const chainId = await publicClient.getChainId();
  if (chainId !== chain.id) throw new Error('RPC returned the wrong network.');
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
  const code = await publicClient.getCode({ address: token.address, blockNumber });
  if (!code || code === '0x') throw new Error('No token contract at the configured address.');
  return blockNumber;
}

async function readToken(): Promise<TokenSnapshot> {
  if (!token.address) throw new Error('Token address is unset.');
  const blockNumber = await checkedBlock();
  const contract = { address: token.address, abi: token.abi, blockNumber };
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: 'name' }),
    publicClient.readContract({ ...contract, functionName: 'symbol' }),
    publicClient.readContract({ ...contract, functionName: 'decimals' }),
    publicClient.readContract({ ...contract, functionName: 'totalSupply' }),
  ]);
  if (typeof name !== 'string' || typeof symbol !== 'string' || typeof decimals !== 'number' ||
    typeof totalSupply !== 'bigint' || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('Unexpected token response.');
  }
  return { name, symbol, decimals, totalSupply, blockNumber };
}

export function useToken() {
  return useQuery({
    queryKey: ['token', chain.id, token.address],
    queryFn: readToken,
    enabled: Boolean(token.address),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useTokenBalance(address: Address | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['token-balance', chain.id, token.address, address],
    queryFn: async () => {
      if (!address || !token.address) throw new Error('Wallet or token address is unset.');
      const blockNumber = await checkedBlock();
      const balance = await publicClient.readContract({
        address: token.address, abi: token.abi, functionName: 'balanceOf', args: [address], blockNumber,
      });
      if (typeof balance !== 'bigint') throw new Error('Unexpected balance response.');
      return { balance, blockNumber };
    },
    enabled: Boolean(address && token.address && enabled),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// Format without converting to Number: keep every onchain decimal, including dust.
export function formatAmount(value: bigint, decimals: number) {
  const [integer, fraction] = formatUnits(value, decimals).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}
