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
  deliveryAddress: "Plot 14, GIDC Vatva Industrial Estate, Phase 2, Ahmedabad, Gujarat",
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
  createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
};

export interface EnrichedSalesPerson {
  salesPersonId: string;
  employeeId: string;
  name: string;
  phone: string;
  email: string;
  region: string;
  states?: string[];
  referralCode?: string;
  status: "active" | "inactive";
  activeQuotesCount?: number;
}

export const DEFAULT_SALESPERSONS: Record<string, EnrichedSalesPerson> = {
  "SP_3210": {
    salesPersonId: "SP_3210",
    employeeId: "EMP-SP3210",
    name: "Kirtan Patel",
    phone: "+91 98250 81229",
    email: "kirtan.patel@itacon.com",
    region: "Ahmedabad & Central Gujarat",
    states: ["GJ"],
    referralCode: "SALES321",
    status: "active",
    activeQuotesCount: 5,
  },
  "SP_101": {
    salesPersonId: "SP_101",
    employeeId: "EMP-SP101",
    name: "Vraj Patel",
    phone: "+91 98765 43210",
    email: "vraj.sales@itacon.com",
    region: "HQ & Western Territory",
    states: ["GJ", "MH"],
    referralCode: "SALES101",
    status: "active",
    activeQuotesCount: 8,
  },
  "sp-1": {
    salesPersonId: "sp-1",
    employeeId: "EMP-SP102",
    name: "Amit Sharma",
    phone: "+91 98980 12345",
    email: "amit.sharma@itacon.com",
    region: "Surat & South Gujarat",
    states: ["GJ"],
    referralCode: "SALES102",
    status: "active",
    activeQuotesCount: 6,
  },
  "sp-2": {
    salesPersonId: "sp-2",
    employeeId: "EMP-SP103",
    name: "Nilesh Mehta",
    phone: "+91 98790 54321",
    email: "nilesh.mehta@itacon.com",
    region: "Morbi & Saurashtra Zone",
    states: ["GJ"],
    referralCode: "SALES103",
    status: "active",
    activeQuotesCount: 4,
  },
  "SP_104": {
    salesPersonId: "SP_104",
    employeeId: "EMP-SP104",
    name: "Rajesh Trivedi",
    phone: "+91 94280 66778",
    email: "rajesh.t@itacon.com",
    region: "Vadodara & North Gujarat",
    states: ["GJ"],
    referralCode: "SALES104",
    status: "active",
    activeQuotesCount: 3,
  },
};

/**
 * Realistic multi-salesperson sample orders for demonstration
 * when Firestore has sparse data.
 */
export const SAMPLE_CLIENT_ORDERS: ClientOrderPO[] = [
  SAMPLE_CLIENT_PO,
  {
    id: "ORD_PO_9812",
    orderReference: "ITC-PO-2026-9812",
    poNumber: "ITC-PO-2026-9812",
    userId: "cust-102",
    customerName: "Rajesh Marble & Infra",
    companyName: "Rajesh Marble & Infra",
    customerPhone: "+91 98241 55678",
    salesPersonId: "sp-1",
    status: "pending_rate",
    orderType: "ready_stock",
    deliveryAddress: "Survey 42, Ring Road Junction, Surat, Gujarat",
    transportRequired: true,
    remarks: "Commercial tower lobby flooring. Need competitive bulk quote for GVT slabs with minimum 6% margin.",
    totalBoxes: 225,
    totalWeightKg: 6525.0,
    totalWeightTons: 6.53,
    items: [
      {
        productId: "prod-1",
        sku: "ITA-STAT-8016",
        productName: "Statuario White Polished GVT",
        size: "800x1600 mm",
        surface: "High Gloss Polished",
        color: "White / Grey Veins",
        quantityBoxes: 140,
        quantitySqFt: 2898.0,
        sqftPerBox: 20.7,
        weightPerBoxKg: 31.0,
        unit: "box",
        basePrice: 680,
        discountPercent: 0,
        unitPrice: null,
        lineTotal: null,
      },
      {
        productId: "prod-2",
        sku: "ITA-ARM-6012",
        productName: "Armani Grey Glossy Porcelain",
        size: "600x1200 mm",
        surface: "Mirror Polished",
        color: "Armani Grey",
        quantityBoxes: 85,
        quantitySqFt: 1317.5,
        sqftPerBox: 15.5,
        weightPerBoxKg: 29.0,
        unit: "box",
        basePrice: 560,
        discountPercent: 0,
        unitPrice: null,
        lineTotal: null,
      }
    ],
    stateCode: "GJ",
    createdAt: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
  },
  {
    id: "ORD_PO_9815",
    orderReference: "ITC-PO-2026-9815",
    poNumber: "ITC-PO-2026-9815",
    userId: "cust-103",
    customerName: "Vikram Patel",
    companyName: "Metro Residency Developers",
    customerPhone: "+91 98791 22334",
    salesPersonId: "SP_101",
    status: "pending_rate",
    orderType: "ready_stock",
    deliveryAddress: "Near Science City, SG Highway, Ahmedabad, Gujarat",
    transportRequired: true,
    remarks: "Sample approved by chief architect. Ready to issue advance payment once special rates finalized.",
    totalBoxes: 210,
    totalWeightKg: 5890.0,
    totalWeightTons: 5.89,
    items: [
      {
        productId: "prod-4",
        sku: "ITA-CALA-8016",
        productName: "Calacatta Gold Bookmatch GVT",
        size: "800x1600 mm",
        surface: "Carving Satin Finish",
        color: "Calacatta Gold",
        quantityBoxes: 120,
        quantitySqFt: 2484.0,
        sqftPerBox: 20.7,
        weightPerBoxKg: 31.0,
        unit: "box",
        basePrice: 720,
        discountPercent: 0,
        unitPrice: null,
        lineTotal: null,
      },
      {
        productId: "prod-5",
        sku: "ITA-CEM-6060",
        productName: "Cementum Antracite Matte Outdoor",
        size: "600x600 mm",
        surface: "Matte Anti-Skid",
        color: "Antracite Grey",
        quantityBoxes: 90,
        quantitySqFt: 1161.0,
        sqftPerBox: 12.9,
        weightPerBoxKg: 24.0,
        unit: "box",
        basePrice: 420,
        discountPercent: 0,
        unitPrice: null,
        lineTotal: null,
      }
    ],
    stateCode: "GJ",
    createdAt: new Date(Date.now() - 1000 * 60 * 270).toISOString(),
  },
  {
    id: "ORD_PO_9818",
    orderReference: "ITC-PO-2026-9818",
    poNumber: "ITC-PO-2026-9818",
    userId: "cust-104",
    customerName: "Hitesh B. Shah",
    companyName: "Morbi Ceramic Gallery",
    customerPhone: "+91 94260 77889",
    salesPersonId: "sp-2",
    status: "pending_rate",
    orderType: "ready_stock",
    deliveryAddress: "Shop 12-14, Ceramic Trade Center, NH 8A, Morbi, Gujarat",
    transportRequired: false,
    remarks: "Dealer showroom display stock replenishment. Customer will arrange own transport from Morbi depot.",
    totalBoxes: 160,
    totalWeightKg: 4640.0,
    totalWeightTons: 4.64,
    items: [
      {
        productId: "prod-6",
        sku: "ITA-RBLK-6012",
        productName: "Royal Black Marble Carving Finish",
        size: "600x1200 mm",
        surface: "Carving Finish",
        color: "Royal Black",
        quantityBoxes: 160,
        quantitySqFt: 2480.0,
        sqftPerBox: 15.5,
        weightPerBoxKg: 29.0,
        unit: "box",
        basePrice: 590,
        discountPercent: 0,
        unitPrice: null,
        lineTotal: null,
      }
    ],
    stateCode: "GJ",
    createdAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
  },
  {
    id: "ORD_PO_9820",
    orderReference: "ITC-PO-2026-9820",
    poNumber: "ITC-PO-2026-9820",
    userId: "cust-105",
    customerName: "Dinesh Choksi",
    companyName: "Shree Ram Ceramic & Sanitary",
    customerPhone: "+91 99090 33445",
    salesPersonId: "SP_104",
    status: "pending_rate",
    orderType: "ready_stock",
    deliveryAddress: "GIDC Phase 1, Naroda, Ahmedabad, Gujarat",
    transportRequired: true,
    remarks: "Customer requesting special project rate for residential society renovation. Needs rate confirmation within 24h.",
    totalBoxes: 110,
    totalWeightKg: 3190.0,
    totalWeightTons: 3.19,
    items: [
      {
        productId: "prod-7",
        sku: "ITA-ONYX-6012",
        productName: "Onyx Crystal Aqua Polished",
        size: "600x1200 mm",
        surface: "Crystal Polished",
        color: "Crystal Aqua",
        quantityBoxes: 110,
        quantitySqFt: 1705.0,
        sqftPerBox: 15.5,
        weightPerBoxKg: 29.0,
        unit: "box",
        basePrice: 620,
        discountPercent: 0,
        unitPrice: null,
        lineTotal: null,
      }
    ],
    stateCode: "GJ",
    createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
  },
  {
    id: "ORD_PO_9808",
    orderReference: "ITC-PO-2026-9808",
    poNumber: "ITC-PO-2026-9808",
    userId: "cust-106",
    customerName: "Sanjay Bhai",
    companyName: "Maruti Tile World",
    customerPhone: "+91 98255 11223",
    salesPersonId: "SP_3210",
    status: "rate_quoted",
    quotationNumber: "QT-2026-104",
    quotationId: "qt-104",
    orderType: "ready_stock",
    deliveryAddress: "Ring Road, Surat, Gujarat",
    transportRequired: true,
    remarks: "Rate quoted ₹513/box. Waiting for client PO confirmation.",
    totalBoxes: 150,
    totalWeightKg: 4350.0,
    totalWeightTons: 4.35,
    items: [
      {
        productId: "prod-3",
        sku: "ITA-TRAV-6012",
        productName: "Travertino Grigio Rustic",
        size: "600x1200 mm",
        surface: "Rustic / Matte",
        color: "Grigio",
        quantityBoxes: 150,
        quantitySqFt: 2325.0,
        sqftPerBox: 15.5,
        weightPerBoxKg: 29.0,
        unit: "box",
        basePrice: 540,
        discountPercent: 5,
        unitPrice: 513,
        lineTotal: 76950,
      }
    ],
    stateCode: "GJ",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "ORD_PO_9801",
    orderReference: "ITC-PO-2026-9801",
    poNumber: "ITC-PO-2026-9801",
    userId: "cust-107",
    customerName: "Kailash Agarwal",
    companyName: "Apex Infra & Builders",
    customerPhone: "+91 98980 99887",
    salesPersonId: "SP_101",
    status: "confirmed",
    quotationNumber: "QT-2026-098",
    quotationId: "qt-098",
    orderType: "ready_stock",
    deliveryAddress: "Skyline Tower, Dumas Road, Surat, Gujarat",
    transportRequired: true,
    remarks: "Order confirmed with 50% advance received. Ready for dispatch.",
    totalBoxes: 320,
    totalWeightKg: 9280.0,
    totalWeightTons: 9.28,
    items: [
      {
        productId: "prod-1",
        sku: "ITA-STAT-8016",
        productName: "Statuario White Polished GVT",
        size: "800x1600 mm",
        surface: "High Gloss Polished",
        color: "White",
        quantityBoxes: 320,
        quantitySqFt: 6624.0,
        sqftPerBox: 20.7,
        weightPerBoxKg: 31.0,
        unit: "box",
        basePrice: 680,
        discountPercent: 8,
        unitPrice: 625,
        lineTotal: 200000,
      }
    ],
    stateCode: "GJ",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "ORD_PO_9790",
    orderReference: "ITC-PO-2026-9790",
    poNumber: "ITC-PO-2026-9790",
    userId: "cust-108",
    customerName: "Mukesh Shah",
    companyName: "Krishna Marble & Sanitary",
    customerPhone: "+91 94270 44556",
    salesPersonId: "sp-2",
    status: "rejected",
    orderType: "ready_stock",
    deliveryAddress: "Subhash Bridge, Ahmedabad, Gujarat",
    transportRequired: false,
    remarks: "Requested rate below minimum viable cost threshold (₹22/sq.ft). Client decided to defer procurement.",
    totalBoxes: 80,
    totalWeightKg: 2320.0,
    totalWeightTons: 2.32,
    items: [
      {
        productId: "prod-5",
        sku: "ITA-CEM-6060",
        productName: "Cementum Antracite Matte Outdoor",
        size: "600x600 mm",
        surface: "Matte Anti-Skid",
        color: "Antracite Grey",
        quantityBoxes: 80,
        quantitySqFt: 1032.0,
        sqftPerBox: 12.9,
        weightPerBoxKg: 24.0,
        unit: "box",
        basePrice: 420,
        discountPercent: 20,
        unitPrice: null,
        lineTotal: null,
      }
    ],
    stateCode: "GJ",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  }
];

/**
 * Fetches all salespersons across the platform from Firestore
 * and falls back to enriched default profiles.
 */
export async function fetchSalesPersonsMap(): Promise<Record<string, EnrichedSalesPerson>> {
  const map: Record<string, EnrichedSalesPerson> = { ...DEFAULT_SALESPERSONS };

  try {
    const snap = await getDocs(collection(db, "salesPersons"));
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      map[id] = {
        salesPersonId: id,
        employeeId: data.employeeId || `EMP-${id.slice(-4)}`,
        name: data.name || data.fullName || "Salesperson",
        phone: data.phone || data.phoneNumber || "",
        email: data.email || "",
        region: data.region || "Western Region",
        states: data.states || ["GJ"],
        referralCode: data.referralCode || "",
        status: data.status || "active",
        activeQuotesCount: data.assignedClientsCount || 2,
      };
    });

    const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "salesperson")));
    usersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const spId = (data.salesPersonId || docSnap.id).toString().trim();
      if (!map[spId] || !map[spId].name) {
        map[spId] = {
          salesPersonId: spId,
          employeeId: data.employeeId || `EMP-${spId.slice(-4)}`,
          name: data.name || data.fullName || "Salesperson",
          phone: data.phone || data.phoneNumber || "",
          email: data.email || "",
          region: data.region || "Western Region",
          states: data.states || ["GJ"],
          referralCode: data.referralCode || "",
          status: data.status || "active",
          activeQuotesCount: data.assignedClientsCount || 2,
        };
      }
    });
  } catch (err) {
    console.warn("Using baseline salespersons directory:", err);
  }

  return map;
}

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
