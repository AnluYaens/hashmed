"use client";

import Image from "next/image";
import Link from "next/link";
import { HederaPortalFaucet } from "@scaffold-hbar-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { ArrowUpTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { HederaAddress } from "~~/components/scaffold-hbar";
import { useTargetNetwork } from "~~/hooks/scaffold-hbar";

/** The four steps a paid read goes through, shown on the landing page. */
const PAY_PER_READ_STEPS = [
  { step: "1", title: "Request", body: "A clinic asks for a restricted lab report." },
  { step: "2", title: "402", body: "HashMed answers HTTP 402 with the price in HBAR." },
  { step: "3", title: "Sign", body: "HashPack partially signs; the facilitator co-signs as fee payer." },
  { step: "4", title: "Unlock", body: "Hedera settles in seconds and a one-off link opens the report." },
];

const Home: NextPage = () => {
  const { address: connectedAddress, status } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  const isReconnecting = status === "reconnecting" || status === "connecting";
  const isConnected = status === "connected" && connectedAddress;

  return (
    <>
      <div className="flex items-center flex-col grow">
        <div className="hedera-gradient dark:bg-none dark:bg-hedera-charcoal w-full py-16 px-5">
          <div className="flex flex-col items-center max-w-3xl mx-auto text-center">
            <Image
              src="/Hedera-Icon-White.svg"
              alt="Hedera icon"
              width={64}
              height={64}
              className="mb-6 hidden dark:block"
            />
            <Image src="/Hedera-Icon-Dark.svg" alt="Hedera icon" width={64} height={64} className="mb-6 dark:hidden" />
            <h1 className="text-4xl sm:text-5xl font-bold text-white m-0 mb-3">HashMed</h1>
            <p className="text-lg sm:text-xl text-white/90 m-0 max-w-2xl">
              Pay-per-read medical lab results. A lab publishes a report; a clinic pays a fraction of a cent in HBAR to
              unlock exactly one read.
            </p>
            <span className="mt-5 block text-xs font-medium tracking-widest uppercase text-white/70">
              Settled on Hedera · x402 · Synthetic data only
            </span>
          </div>
        </div>

        <div className="w-full max-w-4xl mx-auto px-5 -mt-8">
          <div className="bg-base-100 rounded-2xl shadow-lg p-8">
            {isReconnecting ? (
              <div className="flex flex-col items-center gap-2">
                <p className="font-semibold text-sm text-base-content/60 uppercase tracking-wider m-0">Connecting…</p>
                <div className="h-8 w-48 rounded bg-base-200 animate-pulse" aria-hidden />
              </div>
            ) : isConnected ? (
              <div className="flex flex-col items-center gap-2">
                <p className="font-semibold text-sm text-base-content/60 uppercase tracking-wider m-0">
                  Connected Address
                </p>
                <HederaAddress address={connectedAddress} chain={targetNetwork} />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="font-semibold text-sm text-base-content/60 uppercase tracking-wider m-0">
                  Connect HashPack to publish or pay for a report
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-4xl mx-auto px-5 mt-8 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-base-100 rounded-2xl shadow-md p-8 text-center flex flex-col items-center hover:shadow-lg transition-shadow border border-base-300">
              <div className="w-14 h-14 rounded-full hedera-gradient flex items-center justify-center mb-4">
                <DocumentTextIcon className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2">Browse lab reports</h3>
              <p className="text-base-content/70 text-sm m-0 mb-6">
                Open-access reports read for free. Restricted reports unlock per read against an x402 HBAR payment.
              </p>
              <Link href="/files" passHref className="btn btn-primary btn-sm">
                Open the exchange
              </Link>
            </div>

            <div className="bg-base-100 rounded-2xl shadow-md p-8 text-center flex flex-col items-center hover:shadow-lg transition-shadow border border-base-300">
              <div className="w-14 h-14 rounded-full hedera-gradient flex items-center justify-center mb-4">
                <ArrowUpTrayIcon className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2">Publish as a lab</h3>
              <p className="text-base-content/70 text-sm m-0 mb-6">
                Register a report on-chain with its price per read; the document itself stays in private storage.
              </p>
              <Link href="/files/upload" passHref className="btn btn-primary btn-sm">
                Publish a report
              </Link>
            </div>
          </div>

          <div className="mt-8 bg-base-100 rounded-2xl shadow-md p-8 border border-base-300">
            <h3 className="font-bold text-lg mb-1 text-center">How one paid read works</h3>
            <p className="text-sm text-base-content/60 text-center m-0 mb-6">
              No account, no subscription — the payment is the access control.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PAY_PER_READ_STEPS.map(({ step, title, body }) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="font-bold text-primary text-lg leading-none mt-0.5">{step}</span>
                  <div>
                    <p className="m-0 font-medium text-sm">{title}</p>
                    <p className="m-0 text-xs text-base-content/60">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 bg-base-100 rounded-2xl shadow-md p-8 border border-base-300">
            <h3 className="font-bold text-lg mb-4 text-center">Run it locally</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <span className="font-bold text-primary text-lg leading-none mt-0.5">1</span>
                <div>
                  <p className="m-0 font-medium">Start local infra</p>
                  <code className="text-xs bg-base-200 px-2 py-1 rounded">yarn infra:up</code>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold text-primary text-lg leading-none mt-0.5">2</span>
                <div>
                  <p className="m-0 font-medium">Deploy FileRegistry</p>
                  <code className="text-xs bg-base-200 px-2 py-1 rounded">
                    yarn hardhat:deploy --network hederaTestnet
                  </code>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold text-primary text-lg leading-none mt-0.5">3</span>
                <div>
                  <p className="m-0 font-medium">Get testnet HBAR</p>
                  <HederaPortalFaucet variant="link" label="portal.hedera.com/faucet" showIcon={false} />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold text-primary text-lg leading-none mt-0.5">4</span>
                <div>
                  <p className="m-0 font-medium">Run the app</p>
                  <code className="text-xs bg-base-200 px-2 py-1 rounded">yarn next:dev</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
