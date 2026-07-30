"use client";

import Image from "next/image";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { ArrowUpTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { PAY_PER_READ_STEPS } from "~~/components/hashmed/PayPerReadSteps";
import { HederaAddress } from "~~/components/scaffold-hbar";
import { useTargetNetwork } from "~~/hooks/scaffold-hbar";

const Home: NextPage = () => {
  const { address: connectedAddress, status } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  const isReconnecting = status === "reconnecting" || status === "connecting";
  const isConnected = status === "connected" && connectedAddress;

  return (
    <div className="flex items-center flex-col grow">
      <div className="hedera-gradient dark:bg-none dark:bg-hedera-charcoal w-full px-5 pt-16 pb-24">
        <div className="flex flex-col items-center max-w-3xl mx-auto text-center">
          <Image src="/hashmed-mark.svg" alt="" width={56} height={56} priority className="mb-6 shadow-lg" />
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/70">
            Settled on Hedera · x402 · Synthetic data only
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white m-0 mt-3">HashMed</h1>
          <p className="text-lg sm:text-xl leading-relaxed text-balance text-white/85 m-0 mt-4 max-w-xl">
            A lab publishes a report; a clinic unlocks exactly one read for a fraction of a cent in HBAR.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-8">
            <Link href="/files" className="btn btn-lg border-0 bg-white text-primary hover:bg-white/90">
              Browse the exchange
            </Link>
            <Link
              href="/files/upload"
              className="btn btn-lg border border-white/50 bg-transparent text-white shadow-none hover:border-white hover:bg-white/10"
            >
              Publish a report
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-5 -mt-8">
        <div className="bg-base-100 border border-base-300 rounded-2xl shadow-lg p-6">
          {isReconnecting ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 m-0">Connecting…</p>
              <div className="h-8 w-48 rounded bg-base-200 animate-pulse" aria-hidden />
            </div>
          ) : isConnected ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 m-0">Connected account</p>
              <HederaAddress address={connectedAddress} chain={targetNetwork} />
            </div>
          ) : (
            <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 text-center m-0">
              Connect HashPack to publish or pay for a report
            </p>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-5 mt-10 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-base-100 border border-base-300 rounded-2xl p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <DocumentTextIcon className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-bold text-lg m-0 mb-2">Browse lab reports</h2>
            <p className="text-base-content/70 text-sm leading-relaxed m-0">
              Open-access reports read for free. Pay-per-read reports unlock against an x402 HBAR payment.
            </p>
          </div>

          <div className="bg-base-100 border border-base-300 rounded-2xl p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ArrowUpTrayIcon className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-bold text-lg m-0 mb-2">Publish as a lab</h2>
            <p className="text-base-content/70 text-sm leading-relaxed m-0">
              Register a report on-chain with its price per read; the document itself stays in private storage.
            </p>
          </div>
        </div>

        <div className="mt-5 bg-base-100 border border-base-300 rounded-2xl p-8">
          <h2 className="font-bold text-lg text-center m-0 mb-1">How one paid read works</h2>
          <p className="text-sm text-base-content/60 text-center m-0 mb-6">
            No account, no subscription — the payment is the access control.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PAY_PER_READ_STEPS.map(({ key, title, body }, index) => (
              <div key={key} className="flex items-start gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="m-0 font-medium text-sm">{title}</p>
                  <p className="m-0 text-xs leading-relaxed text-base-content/60">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
