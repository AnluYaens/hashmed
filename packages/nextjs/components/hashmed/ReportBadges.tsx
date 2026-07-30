import { reportTypeLabel } from "~~/utils/hashmed/reportMetadata";

/**
 * The report's type code, with the full panel name as a tooltip.
 *
 * Rendered from on-chain text, so an unrecognised code falls through to itself
 * rather than being hidden.
 */
export const ReportTypeBadge = ({ code }: { code: string }) => {
  if (!code) return null;
  return (
    <span className="badge badge-ghost badge-sm font-semibold tracking-wide shrink-0" title={reportTypeLabel(code)}>
      {code}
    </span>
  );
};

/** Per-report marker that the contents are fabricated. */
export const SyntheticBadge = () => (
  <span className="badge badge-warning badge-sm badge-outline shrink-0" title="Fabricated data — not a patient record">
    Synthetic
  </span>
);
