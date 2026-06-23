"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  clearWalletStorage,
  getHederaAccountIdFromSession,
  getHederaProvider,
  hasHederaSession,
  initAppKit,
  resetAppKitSession,
} from "./appKitHedera";
import type { HederaProvider } from "@hashgraph/hedera-wallet-connect";
import { hederaNamespace } from "@hashgraph/hedera-wallet-connect";
import { useAppKitAccount, useDisconnect } from "@reown/appkit/react";
import { parseHederaAccountId } from "~~/utils/scaffold-hbar/hederaAccountId";

type HederaWalletConnectContextValue = {
  provider: HederaProvider | null;
  /** Native Hedera account id from the WalletConnect session. */
  hederaAccountId: string | null;
  /** Alias of `hederaAccountId` for display components. */
  accountId: string | null;
  hasHederaSession: boolean;
  isConnected: boolean;
  isInitializing: boolean;
  isBusy: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
};

const HederaWalletConnectContext = createContext<HederaWalletConnectContextValue | undefined>(undefined);

let _initPromise: Promise<HederaProvider> | null = null;

function ensureInit(): Promise<HederaProvider> {
  if (!_initPromise) {
    _initPromise = initAppKit().then(() => getHederaProvider());
  }
  return _initPromise;
}

export const HederaWalletConnectProvider = ({ children }: { children: React.ReactNode }) => {
  const { disconnect } = useDisconnect();
  const [provider, setProvider] = useState<HederaProvider | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [forceDisconnected, setForceDisconnected] = useState(false);
  const [sessionTick, setSessionTick] = useState(0);
  const { address: appKitHederaAddress, isConnected: appKitHederaConnected } = useAppKitAccount({
    namespace: hederaNamespace,
  });
  const prevSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void ensureInit()
      .then(hp => {
        if (mounted) setProvider(hp);
      })
      .catch(err => console.error("HederaWalletConnect init failed", err))
      .finally(() => {
        if (mounted) setIsInitializing(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!provider) return;
    const bump = () => setSessionTick(t => t + 1);
    const providerWithEvents = provider as unknown as {
      on?: (event: string, cb: () => void) => void;
      off?: (event: string, cb: () => void) => void;
    };
    const onConnected = () => {
      bump();
      setForceDisconnected(false);
    };

    if (typeof providerWithEvents.on === "function") {
      providerWithEvents.on("session_update", onConnected);
      providerWithEvents.on("session_delete", bump);
      providerWithEvents.on("connect", onConnected);
      providerWithEvents.on("disconnect", bump);
    }
    return () => {
      if (typeof providerWithEvents.off === "function") {
        providerWithEvents.off("session_update", onConnected);
        providerWithEvents.off("session_delete", bump);
        providerWithEvents.off("connect", onConnected);
        providerWithEvents.off("disconnect", bump);
      }
    };
  }, [provider]);

  const connectWallet = useCallback(async () => Promise.resolve(), []);

  const disconnectWallet = useCallback(async () => {
    if (isBusy) return;
    const sessionKeyWhenDisconnecting = prevSessionKeyRef.current;
    setIsBusy(true);
    try {
      try {
        await disconnect({ namespace: hederaNamespace });
      } catch {
        // Continue to global disconnect fallback.
      }
      try {
        await disconnect();
      } catch {
        // Continue to provider-level fallback.
      }
      const providerWithDisconnect = provider as unknown as {
        disconnect?: (params?: unknown) => Promise<unknown>;
      };
      if (typeof providerWithDisconnect.disconnect === "function") {
        try {
          await providerWithDisconnect.disconnect({ namespace: hederaNamespace });
        } catch {
          try {
            await providerWithDisconnect.disconnect();
          } catch (error) {
            console.warn("Provider disconnect fallback failed", error);
          }
        }
      }

      clearWalletStorage();
      await resetAppKitSession();
      _initPromise = null;
      prevSessionKeyRef.current = sessionKeyWhenDisconnecting;
      setForceDisconnected(true);

      try {
        const hp = await ensureInit();
        setProvider(hp);
      } catch (err) {
        console.error("HederaWalletConnect re-init after disconnect failed", err);
      }
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, disconnect, provider]);

  const providerHasSession = Boolean(
    sessionTick >= 0 && provider && (provider as unknown as { session?: unknown }).session,
  );

  const sessionBlocked = forceDisconnected || !providerHasSession;
  const sessionHederaAccountId = sessionBlocked ? null : getHederaAccountIdFromSession(provider);
  const appKitHederaAccountId =
    !sessionBlocked && appKitHederaConnected && appKitHederaAddress ? parseHederaAccountId(appKitHederaAddress) : null;
  const hederaAccountId = sessionHederaAccountId ?? appKitHederaAccountId;
  const hederaSessionReady = sessionBlocked ? false : hasHederaSession(provider);

  useEffect(() => {
    if (sessionBlocked) return;
    const sessionKey = JSON.stringify({ hedera: sessionHederaAccountId });
    if (forceDisconnected && sessionKey !== prevSessionKeyRef.current && sessionKey !== '{"hedera":null}') {
      setForceDisconnected(false);
    }
    if (sessionKey !== '{"hedera":null}') {
      prevSessionKeyRef.current = sessionKey;
    }
  }, [sessionBlocked, forceDisconnected, sessionHederaAccountId]);

  const isConnected = Boolean(providerHasSession && !forceDisconnected && hederaSessionReady && !!hederaAccountId);

  const value = useMemo<HederaWalletConnectContextValue>(
    () => ({
      provider,
      hederaAccountId,
      accountId: hederaAccountId,
      hasHederaSession: hederaSessionReady,
      isConnected,
      isInitializing,
      isBusy,
      connectWallet,
      disconnectWallet,
    }),
    [
      provider,
      hederaAccountId,
      hederaSessionReady,
      isConnected,
      isInitializing,
      isBusy,
      connectWallet,
      disconnectWallet,
    ],
  );

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return <HederaWalletConnectContext.Provider value={value}>{children}</HederaWalletConnectContext.Provider>;
};

export const useHederaWalletConnect = () => {
  const ctx = useContext(HederaWalletConnectContext);
  if (!ctx) throw new Error("useHederaWalletConnect must be used inside HederaWalletConnectProvider");
  return ctx;
};
