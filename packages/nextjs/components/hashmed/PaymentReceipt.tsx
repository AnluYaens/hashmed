import { ArrowTopRightOnSquareIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { getHashScanTransactionLink } from "~~/utils/scaffold-hbar";

type PaymentReceiptProps = {
  /** Native Hedera transaction id returned by the x402 settlement. */
  transactionId: string;
  /** Chain the payment settled on; decides whether a HashScan link exists. */
  chainId: number;
  /** Paying account, when the facilitator reported one. */
  payer?: string;
};

/**
 * Proof that a read was paid for on Hedera, linking out to HashScan.
 *
 * The transaction is the whole point of the pay-per-read flow, so it is shown as a
 * receipt rather than a footnote.
 */
export const PaymentReceipt = ({ transactionId, chainId, payer }: PaymentReceiptProps) => {
  if (!transactionId) return null;

  const hashScanLink = getHashScanTransactionLink(transactionId, chainId);

  return (
    <div className="mt-4 rounded-xl bg-success/10 border border-success/25 px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-success">
        <CheckCircleIcon className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">Settled on Hedera</span>
      </div>

      <p className="m-0 text-xs text-base-content/70">
        Settled · tx <span className="font-mono break-all">{transactionId}</span>
      </p>

      {hashScanLink ? (
        <a
          href={hashScanLink}
          target="_blank"
          rel="noreferrer"
          className="link link-success no-underline hover:underline text-xs font-medium w-fit inline-flex items-center gap-1"
        >
          View on HashScan
          <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className="text-xs text-base-content/50">Explorer link unavailable on this network.</span>
      )}

      {payer && <span className="text-xs text-base-content/50 break-all">Paid by {payer}</span>}
    </div>
  );
};
