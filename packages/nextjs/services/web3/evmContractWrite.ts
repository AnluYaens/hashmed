import type { Abi, Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { writeContract } from "@wagmi/core";
import type { HederaProvider } from "@hashgraph/hedera-wallet-connect";
import {
  ensureProvidersInitialized,
  getEvmChainIdFromSession,
  wagmiAdapter,
} from "~~/services/web3/appKitHedera";

function toEvmCaipChain(chainId: number): string {
  return `eip155:${chainId}`;
}

/**
 * WalletConnect EVM sub-provider expects a numeric chain string for setDefaultChain.
 * Passing `eip155:296` causes parseInt → NaN and breaks eth_blockNumber RPC routing.
 */
export function ensureEvmChain(provider: HederaProvider, chainId: number): void {
  ensureProvidersInitialized(provider);
  const caipChain = toEvmCaipChain(chainId);

  if (typeof provider.setDefaultChain === "function") {
    provider.setDefaultChain(caipChain);
  }

  const eip155Provider = (provider as unknown as {
    eip155Provider?: { setDefaultChain?: (chain: string, rpcUrl?: string) => void };
  }).eip155Provider;

  eip155Provider?.setDefaultChain?.(String(chainId));
}

function resolveEvmChainId(provider: HederaProvider, fallbackChainId: number): number {
  return getEvmChainIdFromSession(provider) ?? fallbackChainId;
}

/** Send an EVM contract tx via WalletConnect (HashPack signs; viem public client confirms). */
async function sendContractTxViaWalletConnect(args: {
  provider: HederaProvider;
  contractAddress: Address;
  evmAddress: Address;
  chainId: number;
  data: Hex;
}): Promise<Hex> {
  const { provider, contractAddress, evmAddress, chainId, data } = args;
  ensureEvmChain(provider, chainId);

  const hash = await provider.request(
    {
      method: "eth_sendTransaction",
      params: [{ from: evmAddress, to: contractAddress, data }],
    },
    toEvmCaipChain(chainId),
  );

  if (!hash || typeof hash !== "string") {
    throw new Error("Transaction failed — no hash returned from wallet");
  }
  return hash as Hex;
}

/** Register / mutate FileRegistry — wagmi when synced, otherwise WalletConnect EVM session. */
export async function writeContractViaProvider(args: {
  provider: HederaProvider;
  contractAddress: Address;
  evmAddress: Address;
  chainId: number;
  abi: Abi;
  functionName: string;
  fnArgs: readonly unknown[];
  /** When wagmi is connected on the target chain, prefer the supported WagmiAdapter path. */
  wagmiAddress?: Address;
  wagmiChainId?: number;
}): Promise<Hex> {
  const { provider, contractAddress, evmAddress, chainId, abi, functionName, fnArgs, wagmiAddress, wagmiChainId } =
    args;
  const resolvedChainId = resolveEvmChainId(provider, chainId);

  if (wagmiAddress && wagmiChainId === resolvedChainId && wagmiAddress.toLowerCase() === evmAddress.toLowerCase()) {
    return writeContract(wagmiAdapter.wagmiConfig, {
      abi,
      address: contractAddress,
      functionName,
      args: fnArgs as never,
      chainId: resolvedChainId,
      account: wagmiAddress,
    });
  }

  const data = encodeFunctionData({ abi, functionName, args: fnArgs });
  return sendContractTxViaWalletConnect({
    provider,
    contractAddress,
    evmAddress,
    chainId: resolvedChainId,
    data,
  });
}
