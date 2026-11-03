/**
 * Payment Terms Configuration and Display Label Mapping
 *
 * Requirements:
 * - Immediate / 100% Advance
 * - 50% Advance, 50% Before Dispatch
 * - 30 Days Net (Requires Credit Check)
 * - 45 Days Net (Requires Credit Check)
 * - 60 Days Net (Requires Credit Check)
 *
 * Internal stored values are preserved for backwards compatibility:
 * - "Immediate / Advance"
 * - "50% Advance, 50% Before Dispatch"
 * - "30 Days Net"
 * - "45 Days Net"
 * - "60 Days Net (Requires Credit Check)"
 */

export interface PaymentTermOption {
  value: string;
  label: string;
}

export const PAYMENT_TERM_OPTIONS: readonly PaymentTermOption[] = [
  { value: "Immediate / Advance", label: "Immediate / 100% Advance" },
  { value: "50% Advance, 50% Before Dispatch", label: "50% Advance, 50% Before Dispatch" },
  { value: "30 Days Net", label: "30 Days Net (Requires Credit Check)" },
  { value: "45 Days Net", label: "45 Days Net (Requires Credit Check)" },
  { value: "60 Days Net (Requires Credit Check)", label: "60 Days Net (Requires Credit Check)" },
];

/**
 * Maps any stored or legacy payment terms value to its formatted display label.
 * If no mapping exists (e.g. legacy custom values like "15 Days Net"), returns the raw value unchanged.
 */
export function formatPaymentTerms(terms?: string | null): string {
  if (!terms) return "";
  const trimmed = terms.trim();

  switch (trimmed) {
    case "Immediate / Advance":
    case "Immediate / 100% Advance":
    case "Immediate":
    case "100% Advance":
    case "100% advance on PO confirmation":
      return "Immediate / 100% Advance";

    case "50% Advance, 50% Before Dispatch":
    case "50% advance, balance against BL/dispatch":
    case "50% Advance":
      return "50% Advance, 50% Before Dispatch";

    case "30 Days Net":
    case "30 Days Net (Requires Credit Check)":
    case "net30":
    case "NET30":
      return "30 Days Net (Requires Credit Check)";

    case "45 Days Net":
    case "45 Days Net (Requires Credit Check)":
    case "net45":
    case "NET45":
      return "45 Days Net (Requires Credit Check)";

    case "60 Days Net":
    case "60 Days Net (Requires Credit Check)":
    case "net60":
    case "NET60":
      return "60 Days Net (Requires Credit Check)";

    default:
      return terms;
  }
}

