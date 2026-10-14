import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAddress, keccak256, toBytes } from 'viem';

const configDir = new URL('../config/', import.meta.url);
export async function readConfig(name) {
  return JSON.parse(await readFile(new URL(name, configDir), 'utf8'));
}
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export async function validateConfig() {
  const deployment = await readConfig('deployment.json');
  const { network, walletAddChain } = await readConfig('network.json');
  const abi = await readConfig('abis/HiveDeskToken.json');
  if (deployment.chainId !== network.chainId || Number(walletAddChain.chainId) !== network.chainId) throw new Error('Configured chains do not match.');
  if (!network.rpcUrls.length || network.rpcUrls.some((url) => new URL(url).protocol !== 'https:')) throw new Error('Use the pinned HTTPS RPCs.');
  const seen = new Set();
  for (const contract of deployment.contracts) {
    if (seen.has(contract.name)) throw new Error(`Duplicate contract record: ${contract.name}`);
    seen.add(contract.name);
    if (contract.address && (!isAddress(contract.address, { strict: false }) || /^0x0{40}$/i.test(contract.address))) throw new Error(`Invalid address for ${contract.name}`);
  }
  const token = deployment.contracts.find((contract) => contract.name === 'HiveDeskToken');
  const abiHash = keccak256(toBytes(JSON.stringify(canonical(abi)))).slice(2);
  if (token && abiHash !== token.abiHash.replace(/^0x/, '')) throw new Error('HiveDeskToken ABI does not match the attested abiHash.');
  for (const name of ['name', 'symbol', 'totalSupply', 'decimals', 'balanceOf']) {
    if (!abi.some((entry) => entry.type === 'function' && entry.name === name && entry.stateMutability === 'view')) throw new Error(`Missing read method: ${name}`);
  }
  console.log(`Config valid. HiveDeskToken canonical ABI keccak256: ${abiHash}`);
  console.log(token?.address ? `Token address: ${token.address}. Application contracts remain awaiting verified integration.` : 'Token address unset: token and wallet sections stay awaiting deployment.');
  return { deployment, network, token, abi };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await validateConfig();
