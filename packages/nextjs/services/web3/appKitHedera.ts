import {
  HederaAdapter,
  HederaChainDefinition,
  HederaProvider,
  createNamespaces,
  hederaNamespace,
} from "@hashgraph/hedera-wallet-connect";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import type UniversalProvider from "@walletconnect/universal-provider";
import { reconnect } from "@wagmi/core";
import type { Address } from "viem";
import scaffoldConfig from "~~/scaffold.config";

const projectId = scaffoldConfig.walletConnectProjectId;

const metadata = {
  name: "Scaffold-HBAR",
  description: "x402 pay-per-use file marketplace on Hedera",
  url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  icons: [typeof window !== "undefined" ? `${window.location.origin}/logo.svg` : "http://localhost:3000/logo.svg"],
};

export const evmNetworks = [HederaChainDefinition.EVM.Testnet, HederaChainDefinition.EVM.Mainnet] as const;
export const nativeNetworks = [HederaChainDefinition.Native.Testnet, HederaChainDefinition.Native.Mainnet] as const;

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [...evmNetworks],
});

const hederaNativeAdapter = new HederaAdapter({
  projectId,
  networks: [...nativeNetworks],
  namespace: hederaNamespace,
});

let _provider: HederaProvider | null = null;
let _connectPatched = false;

/** Always request native Hedera + EVM in one WalletConnect approval (HashPack supports both). */
function patchProviderConnect(provider: HederaProvider): void {
  if (_connectPatched) return;
  _connectPatched = true;

  const originalConnect = provider.connect.bind(provider);
  provider.connect = async params => {
    const chainId = scaffoldConfig.targetNetworks[0].id;
    const optionalNamespaces = createNamespaces(connectNetworksForChainId(chainId));
    return originalConnect({ ...params, optionalNamespaces });
  };
}

export async function getHederaProvider(): Promise<HederaProvider> {
  if (_provider) {
    ensureProvidersInitialized(_provider);
    return _provider;
  }
  _provider = (await HederaProvider.init({ projectId, metadata })) as HederaProvider;
  patchProviderConnect(_provider);
  ensureProvidersInitialized(_provider);
  return _provider;
}

/** EVM address from the WalletConnect `eip155` namespace (e.g. `eip155:296:0x…`). */
export function getEvmAddressFromSession(provider: HederaProvider | null): Address | null {
  if (!provider) return null;
  ensureProvidersInitialized(provider);
  const session = (provider as unknown as { session?: { namespaces?: Record<string, { accounts?: string[] }> } })
    .session;
  const account = session?.namespaces?.eip155?.accounts?.[0];
  if (!account) return null;
  const evm = account.split(":")[2];
  if (!evm?.startsWith("0x")) return null;
  return evm as Address;
}

/** EVM chain id from the WalletConnect session (e.g. `eip155:296:0x…` → 296). */
function readEvmChainIdFromSession(provider: HederaProvider): number | null {
  const session = (provider as unknown as { session?: { namespaces?: Record<string, { accounts?: string[] }> } })
    .session;
  const account = session?.namespaces?.eip155?.accounts?.[0];
  const chainPart = account?.split(":")[1];
  if (!chainPart) return null;
  const chainId = Number.parseInt(chainPart, 10);
  return Number.isFinite(chainId) ? chainId : null;
}

export function getEvmChainIdFromSession(provider: HederaProvider | null): number | null {
  if (!provider) return null;
  ensureProvidersInitialized(provider);
  return readEvmChainIdFromSession(provider);
}

export function hasEvmSession(provider: HederaProvider | null): boolean {
  return getEvmAddressFromSession(provider) !== null;
}

/** Hedera account id from the WalletConnect `hedera` namespace (e.g. `hedera:testnet:0.0.x`). */
export function getHederaAccountIdFromSession(provider: HederaProvider | null): string | null {
  if (!provider) return null;
  ensureProvidersInitialized(provider);
  const session = (provider as unknown as { session?: { namespaces?: Record<string, { accounts?: string[] }> } })
    .session;
  const account = session?.namespaces?.hedera?.accounts?.[0];
  if (!account) return null;
  const accountId = account.split(":")[2];
  return accountId && /^\d+\.\d+\.\d+$/.test(accountId) ? accountId : null;
}

export function hasHederaSession(provider: HederaProvider | null): boolean {
  return getHederaAccountIdFromSession(provider) !== null;
}

function connectNetworksForChainId(chainId: number) {
  if (chainId === HederaChainDefinition.EVM.Mainnet.id) {
    return [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.EVM.Mainnet];
  }
  return [HederaChainDefinition.Native.Testnet, HederaChainDefinition.EVM.Testnet];
}

/** Sync wagmi after a WalletConnect session is established (AppKit handles pairing UI). */
export async function syncWagmiAfterConnect(): Promise<void> {
  const provider = await getHederaProvider();
  ensureProvidersInitialized(provider);
  if (hasEvmSession(provider)) {
    await reconnect(wagmiAdapter.wagmiConfig);
  }
}

export function ensureProvidersInitialized(provider: HederaProvider): void {
  const providerInternals = provider as unknown as {
    session?: { namespaces?: Record<string, unknown> };
    namespaces?: Record<string, unknown>;
    nativeProvider?: unknown;
    eip155Provider?: unknown;
    initProviders?: () => void;
  };

  if (!providerInternals.session?.namespaces) return;

  const needsInit = !(providerInternals.nativeProvider && providerInternals.eip155Provider);

  if (needsInit) {
    const sessionNamespaceKeys = Object.keys(providerInternals.session.namespaces);
    const currentNamespaceKeys = Object.keys(providerInternals.namespaces ?? {});

    if (sessionNamespaceKeys.length > 0 && currentNamespaceKeys.length === 0) {
      providerInternals.namespaces = { ...providerInternals.session.namespaces };
    }

    if (typeof providerInternals.initProviders === "function") {
      try {
        providerInternals.initProviders();
      } catch (err) {
        console.warn("ensureProvidersInitialized: initProviders() failed", err);
      }
    }
  }

  if ("eip155" in providerInternals.session.namespaces) {
    const evmChainId = readEvmChainIdFromSession(provider) ?? scaffoldConfig.targetNetworks[0].id;
    if (typeof provider.setDefaultChain === "function") {
      provider.setDefaultChain(`eip155:${evmChainId}`);
    }
    const eip155Provider = providerInternals.eip155Provider as
      | { setDefaultChain?: (chain: string) => void }
      | undefined;
    eip155Provider?.setDefaultChain?.(String(evmChainId));
  }
}

let _appKit: ReturnType<typeof createAppKit> | null = null;

export async function initAppKit() {
  if (_appKit) return _appKit;

  const universalProvider = await getHederaProvider();
  await wagmiAdapter.setUniversalProvider(universalProvider as never);
  await wagmiAdapter.syncConnectors();

  _appKit = createAppKit({
    adapters: [wagmiAdapter, hederaNativeAdapter],
    universalProvider: universalProvider as unknown as UniversalProvider,
    projectId,
    metadata,
    networks: [...nativeNetworks, ...evmNetworks],
    defaultNetwork: nativeNetworks[0],
  });

  return _appKit;
}

export function clearWalletStorage(): void {
  if (typeof window === "undefined") return;

  const appKitPrefix = "@appkit/";
  const extraKeys = new Set(["WALLETCONNECT_DEEPLINK_CHOICE", "wc_storage_version"]);

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;
    const lower = key.toLowerCase();
    const isWcLegacy =
      lower.includes("wc@") ||
      lower.includes("walletconnect") ||
      lower.includes("wc_") ||
      lower.includes("wallet_connect");
    if (key.startsWith(appKitPrefix) || extraKeys.has(key) || isWcLegacy) {
      localStorage.removeItem(key);
    }
  }

  try {
    const request = indexedDB.deleteDatabase("WALLET_CONNECT_V2_INDEXED_DB");
    request.onerror = () => {
      console.warn("Failed to clear WalletConnect IndexedDB");
    };
  } catch {
    // IndexedDB may not be available (SSR, private mode, etc.)
  }
}

export async function resetAppKitSession() {
  _appKit = null;
  _provider = null;
  _connectPatched = false;
}
