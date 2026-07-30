import { BeakerIcon } from "@heroicons/react/24/outline";

/**
 * Site-wide reminder that every report in HashMed is fabricated.
 *
 * Deliberately always visible and not dismissible: the app looks like a real
 * medical marketplace, so nothing in it should ever be mistaken for a patient
 * record.
 */
export const SyntheticDataBanner = () => (
  <div className="bg-warning/10 border-b border-warning/25 px-4 py-2 flex items-center justify-center gap-2 text-center">
    <BeakerIcon className="h-4 w-4 shrink-0 text-warning" />
    <p className="text-xs sm:text-sm m-0 text-base-content/80">
      <span className="font-semibold">Demo only.</span> Every lab report here is synthetic. No real patient data, no
      PHI, not for clinical use.
    </p>
  </div>
);
