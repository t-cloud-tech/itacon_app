export type UserRole = "customer" | "salesperson" | "manager" | "admin";

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  companyName?: string;
  userCategory?: string;
  salesPersonId?: string;
  referralCode?: string;
  city?: string;
  state?: string;
  region?: string;
  pincode?: string;
  gstNumber?: string;
  avatarUrl?: string;
  profilePhotoUrl?: string;
  status: "active" | "inactive" | "blocked";
  passwordHash?: string;
  passwordSalt?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface SalesPerson {
  salesPersonId: string;
  employeeId: string;
  name: string;
  phone: string;
  email: string;
  referralCode: string;
  region: string;
  states: string[];
  status: "active" | "inactive";
  assignedClientsCount: number;
  activeClientsCount: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type LeadSource = "customer_app" | "manual" | "referral" | "website" | "trade_fair";
export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "dropped";

export interface Lead {
  id: string;
  leadNumber: string;
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  city: string;
  state: string;
  source: LeadSource;
  status: LeadStatus;
  assignedSalespersonId: string;
  requirementNotes?: string;
  designRequestId?: string;
  convertedCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  customerNumber: string;
  userId?: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  address?: string;
  pincode?: string;
  gstNumber?: string;
  category: "Dealer" | "Wholesaler" | "Retailer" | "Contractor" | "Architect" | "Builder";
  priceTier: "A" | "B" | "C";
  creditLimit: number;
  paymentTerms: string;
  assignedSalespersonId: string;
  status: "active" | "inactive" | "blocked";
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStage = "requirement" | "quotation" | "negotiation" | "approved" | "won" | "lost";

export interface Opportunity {
  id: string;
  oppNumber: string;
  customerId: string;
  customerName: string;
  title: string;
  stage: OpportunityStage;
  estimatedValue: number;
  probability: number;
  expectedCloseDate: string;
  assignedSalespersonId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FollowUpStatus = "scheduled" | "completed" | "cancelled" | "missed";
export type FollowUpType = "call" | "visit" | "whatsapp" | "email";

export interface FollowUp {
  id: string;
  targetType: "lead" | "customer" | "opportunity";
  targetId: string;
  targetName: string;
  type: FollowUpType;
  dueDate: string;
  dueTime?: string;
  status: FollowUpStatus;
  notes?: string;
  outcome?: string;
  salespersonId: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  productId: string;
  productName: string;
  sku: string;
  category?: string;
  size?: string;
  finish?: string;
  quantityBoxes: number;
  sqftPerBox: number;
  totalSqft: number;
  weightKg: number;
  unitPrice: number;
  discountPercent: number;
  effectivePrice: number;
  lineTotal: number;
}

export type QuotationStatus = 
  | "draft" 
  | "pending_approval" 
  | "approved" 
  | "rejected" 
  | "sent_to_customer" 
  | "accepted" 
  | "declined" 
  | "expired";

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  opportunityId?: string;
  salespersonId: string;
  salespersonName: string;
  status: QuotationStatus;
  items: QuotationItem[];
  subtotal: number;
  discountTotal: number;
  taxPercent: number;
  taxAmount: number;
  shippingCharge: number;
  grandTotal: number;
  totalBoxes: number;
  totalWeightTons: number;
  paymentTerms: string;
  validityDays: number;
  expiryDate: string;
  requiresSpecialApproval: boolean;
  approvalStatus?: "none" | "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  approvalRemarks?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  referenceType: "quotation" | "price_exception" | "credit_limit";
  referenceId: string;
  referenceNumber: string;
  salespersonId: string;
  salespersonName: string;
  customerId: string;
  customerName: string;
  discountRequested: number;
  totalValue: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  assignedToRole: "admin";
  decidedBy?: string;
  decisionNotes?: string;
  decidedAt?: string;
  createdAt: string;
}

export type OrderStatus = "draft" | "submitted" | "confirmed" | "in_production" | "dispatched" | "delivered" | "cancelled";

export interface SalesOrder {
  id: string;
  orderNumber: string;
  quotationId?: string;
  customerId: string;
  customerName: string;
  salespersonId: string;
  status: OrderStatus;
  items: QuotationItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  shippingAddress: string;
  paymentTerms: string;
  advancePaid?: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  dispatchDate?: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TileProduct {
  id: string;
  productId: string;
  name: string;
  category: string;
  finish: string;
  size: string;
  thicknessMm?: number;
  sqftPerBox: number;
  piecesPerBox: number;
  weightPerBoxKg: number;
  basePrice: number;
  stockBoxes: number;
  images: string[];
  status: "active" | "discontinued";
}
