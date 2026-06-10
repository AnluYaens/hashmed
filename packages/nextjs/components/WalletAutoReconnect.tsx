"use client";

import { useEffect, useRef } from "react";
import { reconnect } from "wagmi/actions";
import { useConfig } from "wagmi";

/** Reconnect persisted WalletConnect sessions on load. */
export const WalletAutoReconnect = () => {
  const config = useConfig();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void reconnect(config);
  }, [config]);

  return null;
};
