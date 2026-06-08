"use client";

import { useEffect, useRef } from "react";
import { reconnect } from "@wagmi/core";
import { useConfig } from "wagmi";

const BURNER_WALLET_CONNECTOR_ID = "burnerWallet";

/**
 * Reconnect persisted wallets on load, but never auto-connect the Burner Wallet.
 * The burner connector reports itself as always authorized, which would otherwise
 * hijack the session on every refresh.
 */
export const WalletAutoReconnect = () => {
  const config = useConfig();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const connectors = config.connectors.filter(connector => connector.id !== BURNER_WALLET_CONNECTOR_ID);
    if (connectors.length === 0) return;

    void reconnect(config, { connectors });
  }, [config]);

  return null;
};
