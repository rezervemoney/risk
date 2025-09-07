import { ethers } from "ethers";

export const SONIC_RPC_URL = "https://rpc.soniclabs.com";
export const ETH_RPC_URL = "https://0xrpc.io/eth";

/**
 * Get a provider for the Sonic network
 * @returns ethers.JsonRpcProvider
 */
export function getSonicProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(SONIC_RPC_URL, 146);
}

/**
 * Get a provider for the Ethereum network
 * @returns ethers.JsonRpcProvider
 */
export function getEthereumProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(ETH_RPC_URL, 1);
}

/**
 * Get a contract for the Sonic network
 * @param contractAddress - The address of the contract
 * @param abi - The ABI of the contract
 * @returns ethers.Contract
 */
export function getContract<T = ethers.Contract>(
  contractAddress: string,
  abi: ethers.Interface | ethers.InterfaceAbi,
  chain: "sonic" | "ethereum"
): T {
  const provider =
    chain === "sonic" ? getSonicProvider() : getEthereumProvider();
  return new ethers.Contract(contractAddress, abi, provider) as unknown as T;
}

/**
 * Get a contract for the Sonic network
 * @param contractAddress - The address of the contract
 * @param abi - The ABI of the contract
 * @returns ethers.Contract
 */
export function getSonicContract<T = ethers.Contract>(
  contractAddress: string,
  abi: ethers.Interface | ethers.InterfaceAbi
): T {
  const provider = getSonicProvider();
  return new ethers.Contract(contractAddress, abi, provider) as unknown as T;
}

export function getEthereumContract<T = ethers.Contract>(
  contractAddress: string,
  abi: ethers.Interface | ethers.InterfaceAbi
): T {
  const provider = getEthereumProvider();
  return new ethers.Contract(contractAddress, abi, provider) as unknown as T;
}
