import { CheckCircleIcon } from "@heroicons/react/24/outline";

/**
 * The four stages of one paid read, in display order.
 *
 * Shared by the landing page and the in-flow stepper so the story judges read and
 * the story they watch cannot drift apart.
 */
export const PAY_PER_READ_STEPS = [
  { key: "challenge", title: "402", body: "HashMed answers HTTP 402 with the price in HBAR." },
  { key: "signing", title: "Sign", body: "HashPack partially signs the HBAR transfer." },
  { key: "settling", title: "Settle", body: "The facilitator co-signs as fee payer and submits." },
  { key: "unlocked", title: "Unlock", body: "Settlement succeeds and a one-off link opens the report." },
] as const;

/**
 * The payment client reports no intermediate progress, so a payment in flight is
 * only known to be somewhere in the first three stages — they light up as one band.
 */
const IN_FLIGHT_STAGES = 3;

type PayPerReadStepsProps = {
  state: "idle" | "paying" | "unlocked";
};

/** Compact 402 → pay → unlock strip, shown on a pay-per-read report. */
export const PayPerReadSteps = ({ state }: PayPerReadStepsProps) => (
  <div className="rounded-xl border border-base-300 bg-base-200/40 px-4 py-3 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      {state === "paying" && <span className="loading loading-spinner loading-xs text-primary" />}
      {state === "unlocked" && <CheckCircleIcon className="h-4 w-4 text-success shrink-0" />}
      <span className="text-xs font-medium uppercase tracking-wide text-base-content/60">
        {state === "idle" && "How this unlock works"}
        {state === "paying" && "Waiting for HashPack and the facilitator…"}
        {state === "unlocked" && "Read unlocked"}
      </span>
    </div>

    <ol className="flex flex-wrap items-center gap-1.5 m-0 p-0 list-none">
      {PAY_PER_READ_STEPS.map(({ key, title, body }, index) => {
        const isDone = state === "unlocked";
        const isActive = state === "paying" && index < IN_FLIGHT_STAGES;

        return (
          <li key={key} className="flex items-center gap-1.5">
            <span
              title={body}
              className={`badge badge-sm gap-1 whitespace-nowrap ${
                isDone ? "badge-success" : isActive ? "badge-primary" : "badge-ghost text-base-content/50"
              }`}
            >
              {isDone ? <CheckCircleIcon className="h-3 w-3 shrink-0" /> : <span>{index + 1}</span>}
              {title}
            </span>
            {index < PAY_PER_READ_STEPS.length - 1 && <span className="text-base-content/30 text-xs">→</span>}
          </li>
        );
      })}
    </ol>
  </div>
);
