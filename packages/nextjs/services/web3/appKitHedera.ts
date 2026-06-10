import {
  HederaAdapter,
  HederaChainDefinition,
  HederaProvider,
  hederaNamespace,
} from "@hashgraph/hedera-wallet-connect";
import { createAppKit } from "@reown/appkit/react";
import type UniversalProvider from "@walletconnect/universal-provider";
import scaffoldConfig from "~~/scaffold.config";

const projectId = scaffoldConfig.walletConnectProjectId;

const metadata = {
  name: "Scaffold-HBAR",
  description: "x402 pay-per-use file marketplace on Hedera",
  url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  icons: [typeof window !== "undefined" ? `${window.location.origin}/logo.svg` : "http://localhost:3000/logo.svg"],
};

export const nativeNetworks = [HederaChainDefinition.Native.Testnet, HederaChainDefinition.Native.Mainnet] as const;

const hederaNativeAdapter = new HederaAdapter({
  projectId,
  networks: [...nativeNetworks],
  namespace: hederaNamespace,
});

let _provider: HederaProvider | null = null;

export async function getHederaProvider(): Promise<HederaProvider> {
  if (_provider) {
    ensureProvidersInitialized(_provider);
    return _provider;
  }
  _provider = (await HederaProvider.init({ projectId, metadata })) as HederaProvider;
  ensureProvidersInitialized(_provider);
  return _provider;
}

function ensureProvidersInitialized(provider: HederaProvider): void {
  const providerInternals = provider as unknown as {
    session?: { namespaces?: Record<string, unknown> };
    namespaces?: Record<string, unknown>;
    nativeProvider?: unknown;
    initProviders?: () => void;
  };

  if (!providerInternals.session?.namespaces) return;

  const sessionNamespaceKeys = Object.keys(providerInternals.session.namespaces);
  const currentNamespaceKeys = Object.keys(providerInternals.namespaces ?? {});

  if (providerInternals.nativeProvider) return;

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

let _appKit: ReturnType<typeof createAppKit> | null = null;

export async function initAppKit() {
  if (_appKit) return _appKit;

  const universalProvider = await getHederaProvider();

  _appKit = createAppKit({
    adapters: [hederaNativeAdapter],
    universalProvider: universalProvider as unknown as UniversalProvider,
    projectId,
    metadata,
    networks: [...nativeNetworks],
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
}
