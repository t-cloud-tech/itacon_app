import { db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  onSnapshot,
  serverTimestamp 
} from "firebase/firestore";
import { UserProfile, SalesPerson, UserRole } from "@/types";
import { fetchLiveCustomers } from "@/lib/customer-service";

export interface ClientOrderItem {
  productId: string;
  sku: string;
  productName: string;
  size: string;
  surface?: string;
  color?: string;
  quantityBoxes: number;
  quantitySqFt: number;
  sqftPerBox: number;
  weightPerBoxKg?: number;
  unit?: string;
  basePrice: number;
  discountPercent?: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
}

export const MIN_RATE_PER_SQFT = 26.50;

export interface ClientOrderPO {
  id: string;
  orderReference: string;
  poNumber: string;
  userId: string;
  customerName: string;
  companyName: string;
  customerPhone: string;
  salesPersonId: string;
  status: "pending_rate" | "rate_quoted" | "confirmed" | "rejected" | "submitted" | "pending_quote" | "pending_admin_approval";
  orderType: string;
  deliveryAddress: string;
  transportRequired: boolean;
  remarks: string;
  totalBoxes: number;
  totalWeightKg: number;
  totalWeightTons: number;
  items: ClientOrderItem[];
  stateCode?: string;
  quotationId?: string;
  quotationNumber?: string;
  pricePerSqft?: number;
  adminApprovalRequired?: boolean;
  adminApprovalStatus?: "pending" | "approved" | "rejected" | "none";
  adminApprovedAt?: string;
  adminApprovedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// Baseline starter PO (Travertino Grigio Rustic from user's screenshot)
// used if Firestore rules block read until user publishes rules in console
export const SAMPLE_CLIENT_PO: ClientOrderPO = {
  id: "ORD_TEST_9810",
  orderReference: "ITC-PO-2026-9810",
  poNumber: "ITC-PO-2026-9810",
  userId: "Rl1n2Uqp4aOnKw0o1XRnsPl3q0K2",
  customerName: "Kirtan j Patel",
  companyName: "Gujarat Ceramics & Tiles",
  customerPhone: "+918128081229",
  salesPersonId: "SP_3210",
  status: "pending_rate",
  orderType: "ready_stock",
  deliveryAddress: "Plot 14, GIDC Vatva Industrial Estate, Phase 2, Ahmedabad",
  transportRequired: true,
  remarks: "Urgent project delivery required by end of month. Please provide best rate.",
  totalBoxes: 98,
  totalWeightKg: 2842.0,
  totalWeightTons: 2.84,
  items: [
    {
      productId: "prod-3",
      sku: "ITA-TRAV-6012",
      productName: "Travertino Grigio Rustic",
      size: "600x1200 mm",
      surface: "Rustic / Matte",
      color: "Grigio",
      quantityBoxes: 98,
      quantitySqFt: 1519.0,
      sqftPerBox: 15.5,
      weightPerBoxKg: 29.0,
      unit: "box",
      basePrice: 540,
      discountPercent: 5,
      unitPrice: null,
      lineTotal: null,
    }
  ],
  stateCode: "GJ",
  createdAt: new Date().toISOString(),
};

/**
 * Parses a Firestore document into a typed ClientOrderPO
 */
export function parseClientOrderDoc(d: { id: string; data: () => any }): ClientOrderPO {
  const data = d.data();
  const rawItems = Array.isArray(data.items) ? data.items : (Array.isArray(data.orderItems) ? data.orderItems : []);
  const items: ClientOrderItem[] = rawItems.map((item: any) => {
    const qtyBoxes = Number(item.quantityBoxes || item.quantity || 1);
    const sqftPerBox = Number(item.sqftPerBox) || 15.5;
    const totalSqft = Number(item.quantitySqFt || (qtyBoxes * sqftPerBox));
    const weightKg = Number(item.weightKg || (qtyBoxes * (item.weightPerBoxKg || 29.0)));

    return {
      productId: item.productId || item.tileId || "prod-item",
      sku: item.sku || "ITA-SKU-001",
      productName: item.productName || item.tileName || "Tile Product",
      size: item.size || "600x1200 mm",
      surface: item.surface || "Polished",
      color: item.color || "Standard",
      quantityBoxes: qtyBoxes,
      quantitySqFt: totalSqft,
      sqftPerBox: sqftPerBox,
      weightPerBoxKg: Number(item.weightPerBoxKg) || 29.0,
      unit: item.unit || "box",
      basePrice: Number(item.basePrice || item.unitPrice || 540),
      discountPercent: Number(item.discountPercent || 0),
      unitPrice: item.unitPrice !== undefined ? item.unitPrice : null,
      lineTotal: item.lineTotal !== undefined ? item.lineTotal : null,
    };
  });

  return {
    id: d.id,
    orderReference: data.orderReference || data.poNumber || `ITC-PO-${d.id.slice(-4)}`,
    poNumber: data.poNumber || data.orderReference || `ITC-PO-${d.id.slice(-4)}`,
    userId: data.userId || "",
    customerName: data.customerName || data.name || data.userName || "Valued Client",
    companyName: data.companyName || data.customerName || "Client Enterprise",
    customerPhone: data.customerPhone || data.phone || "",
    salesPersonId: (data.salesPersonId || data.salespersonId || "").toString().trim(),
    status: (data.status || "pending_rate").toLowerCase() as any,
    orderType: data.orderType || "ready_stock",
    deliveryAddress: data.deliveryLocation?.address || data.deliveryAddress || "",
    transportRequired: data.transportRequired !== false,
    remarks: data.remarks || "",
    totalBoxes: Number(data.totalBoxes) || items.reduce((s, i) => s + i.quantityBoxes, 0),
    totalWeightKg: Number(data.totalWeightKg) || 0,
    totalWeightTons: Number(data.totalWeightTons) || 0,
    items,
    stateCode: data.stateCode || "GJ",
    quotationId: data.quotationId,
    quotationNumber: data.quotationNumber,
    pricePerSqft: Number(data.pricePerSqft || 0),
    adminApprovalRequired: data.adminApprovalRequired || false,
    adminApprovalStatus: data.adminApprovalStatus || "none",
    adminApprovedAt: data.adminApprovedAt,
    adminApprovedBy: data.adminApprovedBy,
    createdAt: data.createdAt?.seconds 
      ? new Date(data.createdAt.seconds * 1000).toISOString()
      : (typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString()),
  };
}

/**
 * Checks if an order belongs to the given salesperson or admin
 */
export function shouldIncludeOrderForSalesperson(
  order: ClientOrderPO,
  user: UserProfile | null,
  salesperson: SalesPerson | null,
  role: UserRole | null,
  allocatedCustomerIds?: Set<string>
): boolean {
  if (role === "admin") return true;

  const spId = (salesperson?.salesPersonId || user?.salesPersonId || user?.userId || "").trim();
  const orderSpId = (order.salesPersonId || "").trim();

  // 1. Direct match on salesperson ID or user ID
  if (spId && (orderSpId === spId || orderSpId === user?.userId)) {
    return true;
  }

  // 2. Customer ID matches one of the salesperson's allocated customers
  if (allocatedCustomerIds && order.userId && allocatedCustomerIds.has(order.userId)) {
    return true;
  }

  // 3. Fallback: unassigned orders (no salesperson explicitly tagged yet)
  if (!orderSpId) {
    return true;
  }

  return false;
}

/**
 * Subscribes to real-time incoming client PO requests using Firestore onSnapshot.
 * Fires instantly whenever a customer in the mobile app submits a PO!
 */
export function subscribeClientPORequests(
  user: UserProfile | null,
  salesperson: SalesPerson | null,
  role: UserRole | null,
  callback: (orders: ClientOrderPO[]) => void
): () => void {
  let allocatedIds = new Set<string>();

  // Fetch allocated customers in background for accurate fallback mapping
  fetchLiveCustomers(user, salesperson, role)
    .then((custs) => {
      allocatedIds = new Set(custs.map((c) => c.id));
    })
    .catch(() => {});

  const ordersRef = collection(db, "orders");

  const unsubscribe = onSnapshot(
    ordersRef,
    (snapshot) => {
      const ordersList: ClientOrderPO[] = [];

      snapshot.docs.forEach((d) => {
        const order = parseClientOrderDoc(d);
        const isPending = 
          order.status === "pending_rate" || 
          order.status === "submitted" || 
          order.status === "pending_quote" || 
          order.status === "pending_admin_approval";
        if (!isPending) return;

        if (shouldIncludeOrderForSalesperson(order, user, salesperson, role, allocatedIds)) {
          ordersList.push(order);
        }
      });

      // Sort newest orders first
      ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (ordersList.length === 0) {
        ordersList.push(SAMPLE_CLIENT_PO);
      }

      callback(ordersList);
    },
    (err) => {
      console.warn("Real-time onSnapshot orders subscription error:", err);
      callback([SAMPLE_CLIENT_PO]);
    }
  );

  return unsubscribe;
}

/**
 * Subscribes to ALL real-time orders (for the Orders page)
 */
export function subscribeAllOrders(
  user: UserProfile | null,
  salesperson: SalesPerson | null,
  role: UserRole | null,
  callback: (orders: ClientOrderPO[]) => void
): () => void {
  const ordersRef = collection(db, "orders");

  return onSnapshot(
    ordersRef,
    (snapshot) => {
      const allOrders: ClientOrderPO[] = [];
      snapshot.docs.forEach((d) => {
        const order = parseClientOrderDoc(d);
        if (role === "admin" || shouldIncludeOrderForSalesperson(order, user, salesperson, role)) {
          allOrders.push(order);
        }
      });

      allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(allOrders);
    },
    (err) => {
      console.warn("Real-time all orders subscription error:", err);
    }
  );
}

/**
 * Fetches all pending client POs submitted from the mobile app
 * that require salesperson quotation (one-time fetch helper).
 */
export async function fetchClientPORequests(
  user: UserProfile | null,
  salesperson: SalesPerson | null,
  role: UserRole | null
): Promise<ClientOrderPO[]> {
  const ordersList: ClientOrderPO[] = [];

  try {
    let allocatedIds = new Set<string>();
    try {
      const custs = await fetchLiveCustomers(user, salesperson, role);
      allocatedIds = new Set(custs.map((c) => c.id));
    } catch (_) {}

    const ordersSnap = await getDocs(collection(db, "orders"));

    ordersSnap.docs.forEach((d) => {
      const order = parseClientOrderDoc(d);
      const isPendingQuote = 
        order.status === "pending_rate" || 
        order.status === "submitted" || 
        order.status === "pending_quote" ||
        order.status === "pending_admin_approval";
      if (!isPendingQuote) return;

      if (shouldIncludeOrderForSalesperson(order, user, salesperson, role, allocatedIds)) {
        ordersList.push(order);
      }
    });
  } catch (err) {
    console.warn("Could not read orders collection (check Firestore security rules):", err);
  }

  ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (ordersList.length === 0) {
    ordersList.push(SAMPLE_CLIENT_PO);
  }

  return ordersList;
}

/**
 * Fetches an individual client PO by order ID.
 */
export async function fetchOrderById(orderId: string): Promise<ClientOrderPO | null> {
  if (!orderId) return null;
  if (orderId === SAMPLE_CLIENT_PO.id) return SAMPLE_CLIENT_PO;

  try {
    const orderDoc = await getDoc(doc(db, "orders", orderId));
    if (orderDoc.exists()) {
      return parseClientOrderDoc(orderDoc);
    }
  } catch (err) {
    console.error("Error fetching order by ID:", err);
  }

  return null;
}

/**
 * Updates a client order in Firestore when a quotation is generated by the salesperson.
 * If the rate is below MIN_RATE_PER_SQFT (₹26.50/sq.ft), status is set to 'pending_admin_approval'.
 * Otherwise, status is set to 'rate_quoted' (or confirmed) and made directly available to customer app.
 */
export async function linkQuotationToOrder(
  orderId: string,
  quotationId: string,
  quotationNumber: string,
  quotedItems: any[],
  subtotal: number,
  discountTotal: number,
  grandTotal: number,
  options?: {
    requiresAdminConfirmation?: boolean;
    pricePerSqft?: number;
    salespersonName?: string;
  }
): Promise<void> {
  try {
    const orderRef = doc(db, "orders", orderId);
    const requiresAdmin = options?.requiresAdminConfirmation ?? false;
    const pricePerSqft = options?.pricePerSqft ?? 0;

    // If cost < ₹26.50/sq ft, order is locked in pending_admin_approval until Admin confirms
    const status = requiresAdmin ? "pending_admin_approval" : "rate_quoted";

    await setDoc(
      orderRef,
      {
        status,
        quotationId,
        quotationNumber,
        quotedItems,
        subtotal,
        discount: discountTotal,
        totalAmount: grandTotal,
        pricePerSqft,
        minRateThreshold: MIN_RATE_PER_SQFT,
        adminApprovalRequired: requiresAdmin,
        adminApprovalStatus: requiresAdmin ? "pending" : "approved",
        rateQuotedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Could not sync quotation link to order document:", err);
  }
}

/**
 * Admin confirms the PO whose rate was below ₹26.50/sq.ft.
 * Releases the confirmed PO directly to the customer mobile app!
 */
export async function adminConfirmOrder(
  orderId: string,
  quotationId?: string,
  adminName: string = "Admin"
): Promise<void> {
  const orderRef = doc(db, "orders", orderId);
  const now = new Date().toISOString();

  // Status transitions to 'confirmed' (or 'rate_quoted' for customer visibility)
  await updateDoc(orderRef, {
    status: "confirmed",
    adminApprovalStatus: "approved",
    adminApprovedAt: now,
    adminApprovedBy: adminName,
    confirmedAt: now,
    updatedAt: now,
  });

  if (quotationId) {
    try {
      const quoteRef = doc(db, "quotations", quotationId);
      await updateDoc(quoteRef, {
        status: "approved",
        approvalStatus: "approved",
        approvedBy: adminName,
        approvedAt: now,
        updatedAt: now,
      });
    } catch (_) {}
  }
}

/**
 * Admin rejects the low rate PO exception.
 */
export async function adminRejectOrder(
  orderId: string,
  quotationId?: string,
  adminName: string = "Admin",
  reason: string = "Quoted rate below ₹26.50/sq.ft threshold rejected by management"
): Promise<void> {
  const orderRef = doc(db, "orders", orderId);
  const now = new Date().toISOString();

  await updateDoc(orderRef, {
    status: "rejected",
    adminApprovalStatus: "rejected",
    adminDecisionReason: reason,
    adminApprovedBy: adminName,
    updatedAt: now,
  });

  if (quotationId) {
    try {
      const quoteRef = doc(db, "quotations", quotationId);
      await updateDoc(quoteRef, {
        status: "rejected",
        approvalStatus: "rejected",
        adminDecisionReason: reason,
        updatedAt: now,
      });
    } catch (_) {}
  }
}
