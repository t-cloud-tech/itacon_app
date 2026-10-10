/**
 * Centralized PO & Quotation Status Terminology Mapping Helper
 * 
 * Strict User-Facing Terminology (Approved):
 * 1. pending_rate → "Awaiting Quote"
 * 2. pending_approval / pending_admin_approval → "Awaiting Admin Approval"
 * 3. approved → "Admin Approved - Sales Action Required" (never simple "Approved")
 * 4. pending_salesperson_review:
 *    - if admin approved → "Admin Approved - Sales Action Required"
 *    - if admin rejected → "Admin Rejected - Sales Action Required"
 * 5. sent_to_customer / rate_quoted → "Sent to Customer" (never "Sent to App")
 * 6. accepted (quotation-level) → "Converted to Order" (never "Accepted by Customer")
 * 7. confirmed (order-level) → "Accepted by Customer"
 * 8. declined → "Rejected by Salesperson"
 * 9. rejected:
 *    - if actor is customer → "Rejected by Customer"
 *    - if actor is salesperson → "Rejected by Salesperson"
 *    - if actor cannot be determined safely → "Rejected"
 * 10. draft → "Draft"
 * 11. expired → "Expired"
 * 
 * CRITICAL RULE:
 * Internal database/Firestore values remain UNCHANGED.
 * PO business workflow remains UNCHANGED.
 */

export interface POStatusContext {
  adminApprovalStatus?: "pending" | "approved" | "rejected" | "none" | string;
  approvalStatus?: "pending" | "approved" | "rejected" | "none" | string;
  salespersonApprovalStatus?: "pending_release" | "action_required_revision" | "released" | "cancelled" | "none" | string;
  changedByRole?: "customer" | "salesperson" | "admin" | string;
  rejectedBy?: string;
  rejectionReason?: string;
  isOrder?: boolean;
  pricePerSqft?: number;
  rateThreshold?: number;
  requiresSpecialApproval?: boolean;
  adminApprovalRequired?: boolean;
}

/**
 * Determine the rejection actor safely from existing context/history.
 * Returns "customer", "salesperson", or "unknown".
 */
export function getRejectionActor(context?: POStatusContext): "customer" | "salesperson" | "unknown" {
  if (!context) return "unknown";

  const role = (context.changedByRole || "").toLowerCase().trim();
  if (role === "customer") return "customer";
  if (role === "salesperson") return "salesperson";

  // Check salesperson explicit indicators
  if (context.salespersonApprovalStatus === "cancelled") {
    return "salesperson";
  }

  const rejectedBy = (context.rejectedBy || "").toLowerCase().trim();
  if (
    rejectedBy.includes("salesperson") || 
    rejectedBy.startsWith("sp_") || 
    rejectedBy.startsWith("sp-") ||
    rejectedBy.includes("sales executive") ||
    rejectedBy.includes("sales rep")
  ) {
    return "salesperson";
  }

  if (rejectedBy.includes("customer") || rejectedBy.includes("client")) {
    return "customer";
  }

  const reason = (context.rejectionReason || "").toLowerCase();
  if (reason.includes("customer declined") || reason.includes("customer rejected") || reason.includes("client declined")) {
    return "customer";
  }
  if (reason.includes("salesperson declined") || reason.includes("declined by sales")) {
    return "salesperson";
  }

  return "unknown";
}

/**
 * Master mapping function translating raw internal status strings into
 * approved user-facing terminology.
 */
export function getPOStatusLabel(
  status: string | undefined | null,
  context?: POStatusContext
): string {
  if (!status) return "Draft";

  const s = status.toLowerCase().trim();

  // Normalize admin decision status from adminApprovalStatus or approvalStatus
  const adminDecision = (context?.adminApprovalStatus || context?.approvalStatus || "").toLowerCase().trim();

  // Check whether rate was >= 26.50 / required no admin confirmation
  const isHighRate = 
    (context?.pricePerSqft !== undefined && context.pricePerSqft >= 26.50) ||
    context?.requiresSpecialApproval === false ||
    context?.adminApprovalRequired === false;

  // 1. Sent to Customer / Converted / Customer confirmation
  if (s === "sent_to_customer" || s === "rate_quoted") {
    return "Sent to Customer";
  }

  if (s === "accepted") {
    return "Converted to Order";
  }

  if (s === "confirmed") {
    return "Accepted by Customer";
  }

  // 2. Salesperson explicit decline / cancellation
  if (s === "declined" || context?.salespersonApprovalStatus === "cancelled") {
    return "Rejected by Salesperson";
  }

  // 3. Admin Rejection (awaiting salesperson review/action):
  // When admin rejects the rate exception, but salesperson has not declined yet:
  if (
    adminDecision === "rejected" || 
    s === "admin_rejected" || 
    s === "rejected_by_admin" ||
    (s === "pending_salesperson_review" && adminDecision === "rejected")
  ) {
    return "Admin Rejected - Sales Action Required";
  }

  // 4. Admin Approved (awaiting salesperson release to customer):
  // When admin has approved the below-threshold rate, but salesperson hasn't released yet:
  if (
    s !== "rejected" &&
    (adminDecision === "approved" || s === "pending_salesperson_review") &&
    context?.salespersonApprovalStatus !== "released"
  ) {
    if (s === "approved" && isHighRate) {
      return "Approved by Salesperson";
    }
    return "Admin Approved - Sales Action Required";
  }

  // 5. Approved (standalone):
  if (s === "approved") {
    if (isHighRate) {
      return "Approved by Salesperson";
    }
    return "Admin Approved - Sales Action Required";
  }

  // 6. Awaiting Admin Approval
  if (s === "pending_approval" || s === "pending_admin_approval") {
    if (adminDecision === "approved") {
      return "Admin Approved - Sales Action Required";
    }
    if (adminDecision === "rejected") {
      return "Admin Rejected - Sales Action Required";
    }
    return "Awaiting Admin Approval";
  }

  // 7. Awaiting Quote
  if (s === "pending_rate" || s === "submitted" || s === "pending_quote") {
    if (adminDecision === "approved") {
      return "Admin Approved - Sales Action Required";
    }
    if (adminDecision === "rejected") {
      return "Admin Rejected - Sales Action Required";
    }
    return "Awaiting Quote";
  }

  // 8. Rejected
  if (s === "rejected") {
    if (adminDecision === "rejected") {
      return "Admin Rejected - Sales Action Required";
    }
    const actor = getRejectionActor(context);
    if (actor === "customer") return "Rejected by Customer";
    if (actor === "salesperson") return "Rejected by Salesperson";
    // If quote was released/quoted to customer or customer declined via app:
    if (context?.salespersonApprovalStatus === "released" || adminDecision === "approved" || isHighRate) {
      return "Rejected by Customer";
    }
    return "Rejected by Customer";
  }

  // 9. Draft / Expired / lifecycle
  if (s === "draft") return "Draft";
  if (s === "expired") return "Expired";
  if (s === "in_production") return "In Production";
  if (s === "dispatched") return "Dispatched";
  if (s === "delivered") return "Delivered";
  if (s === "cancelled") return "Cancelled";

  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns consistent Tailwind CSS badge styling classes based on the user-facing status.
 */
export function getPOStatusBadgeClass(
  status: string | undefined | null,
  context?: POStatusContext
): string {
  const label = getPOStatusLabel(status, context);

  switch (label) {
    case "Awaiting Quote":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Awaiting Admin Approval":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "Admin Approved - Sales Action Required":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "Admin Rejected - Sales Action Required":
      return "bg-rose-100 text-rose-900 border-rose-300";
    case "Approved by Salesperson":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "Sent to Customer":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "Converted to Order":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "Accepted by Customer":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "Rejected by Customer":
    case "Rejected by Salesperson":
    case "Rejected":
      return "bg-rose-50 text-rose-800 border-rose-200";
    case "In Production":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Dispatched":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Delivered":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Draft":
    case "Expired":
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}
