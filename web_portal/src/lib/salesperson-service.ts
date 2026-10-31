import { db } from "@/lib/firebase";
import { cachedGetDocs, invalidateFirestoreCache } from "@/lib/firestore-cache";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import { SalesPerson, SalesOrder, Quotation, Customer } from "@/types";

export interface SalespersonPerformanceMetrics {
  salesPersonId: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  region: string;
  states: string[];
  status: "active" | "inactive";
  assignedClientsCount: number;
  activeClientsCount: number;
  // Computed Live Metrics
  todayOrdersCount: number;
  todaySalesAmount: number;
  totalOrdersCount: number;
  totalSalesAmount: number;
  totalQuotationsCount: number;
  recentOrdersCount: number;
  createdAt?: string;
}

export interface SalespersonDetailData {
  salesperson: SalespersonPerformanceMetrics;
  todayOrders: any[];
  allOrders: any[];
  allQuotations: Quotation[];
  assignedClients: Customer[];
}

export interface NewSalespersonInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  /** Optional: auto-generated as "SE IGPL-001" when blank. */
  employeeId?: string;
  /** Optional: auto-generated as "SALES-001" when blank. */
  referralCode?: string;
  region: string;
  states: string[];
}

export const SALESPERSON_EMP_PREFIX = "SE IGPL-";
export const SALESPERSON_REF_PREFIX = "SALES-";
export const DESIGNER_EMP_PREFIX = "DD IGPL-";

const formatSeq = (n: number) => String(n).padStart(3, "0");

/** Parses the numeric suffix of "<prefix>NNN" values; returns null if the value is not in that format. */
const parseSeq = (value: unknown, prefix: string): number | null => {
  const val = String(value || "").trim().toUpperCase();
  if (!val.startsWith(prefix)) return null;
  const rest = val.slice(prefix.length);
  return /^\d+$/.test(rest) ? parseInt(rest, 10) : null;
};

/**
 * Next free sequence number for a collection: highest existing number of the `field` ("<prefix>NNN")
 * + 1, starting at 1. Other values in the collection (older formats) are ignored.
 */
export async function getNextSequence(
  collectionName: string,
  field: string,
  prefix: string
): Promise<{ next: number; docs: any[] }> {
  const snap = await getDocs(collection(db, collectionName));
  const docs = snap.docs.map((d) => d.data());
  let max = 0;
  docs.forEach((data) => {
    const n = parseSeq(data[field], prefix);
    if (n !== null && n > max) max = n;
  });
  return { next: max + 1, docs };
}

/** Next salesperson identifiers, e.g. { employeeId: "SE IGPL-001", referralCode: "SALES-001" }. */
export async function generateSalespersonIdentifiers(): Promise<{ employeeId: string; referralCode: string }> {
  const { next, docs } = await getNextSequence("salesPersons", "employeeId", SALESPERSON_EMP_PREFIX);
  // Keep the referral code unique: skip numbers whose SALES-NNN code is already in use
  const usedRefs = new Set(
    docs.map((d) => parseSeq(d.referralCode, SALESPERSON_REF_PREFIX)).filter((n): n is number => n !== null)
  );
  let seq = next;
  while (usedRefs.has(seq)) seq++;
  const padded = formatSeq(seq);
  return { employeeId: `${SALESPERSON_EMP_PREFIX}${padded}`, referralCode: `${SALESPERSON_REF_PREFIX}${padded}` };
}

/** Next designer employee ID, e.g. "DD IGPL-001". */
export async function generateDesignerEmployeeId(): Promise<string> {
  const { next } = await getNextSequence("Designer", "employeeId", DESIGNER_EMP_PREFIX);
  return `${DESIGNER_EMP_PREFIX}${formatSeq(next)}`;
}

/**
 * Normalizes Indian phone numbers according to canonical app behavior:
 * e.g. 9624818477 -> +919624818477
 */
export function normalizePhone(phoneNumber: string): string {
  if (!phoneNumber) return "";
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (phoneNumber.trim().startsWith("+")) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : phoneNumber.trim();
}

/**
 * Computes SHA-256("${salt}:${password}") matching functions/staffAuthEngine.js
 */
export async function hashStaffPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a random hexadecimal salt
 */
export function generateSaltHex(length: number = 16): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Baseline fallback salespersons if database is being initialized
 */
const BASELINE_SALESPERSONS: Record<string, Partial<SalespersonPerformanceMetrics>> = {
  "SP_101": {
    salesPersonId: "SP_101",
    employeeId: "EMP-SP101",
    name: "Vraj Patel",
    email: "vraj.sales@itacon.com",
    phone: "+91 98765 43210",
    referralCode: "SALES101",
    region: "HQ & Western Territory",
    states: ["GJ", "MH"],
    status: "active",
    assignedClientsCount: 12,
  },
  "SP_3210": {
    salesPersonId: "SP_3210",
    employeeId: "EMP-SP3210",
    name: "Kirtan Patel",
    email: "kirtan.patel@itacon.com",
    phone: "+91 98250 81229",
    referralCode: "SALES321",
    region: "Ahmedabad & Central Gujarat",
    states: ["GJ"],
    status: "active",
    assignedClientsCount: 8,
  },
  "sp-1": {
    salesPersonId: "sp-1",
    employeeId: "EMP-SP102",
    name: "Amit Sharma",
    email: "amit.sharma@itacon.com",
    phone: "+91 98980 12345",
    referralCode: "SALES102",
    region: "Surat & South Gujarat",
    states: ["GJ"],
    status: "active",
    assignedClientsCount: 6,
  },
};

/**
 * Checks if a given timestamp represents today (local time)
 */
function isDateToday(dateVal: any): boolean {
  if (!dateVal) return false;
  let d: Date;
  if (typeof dateVal === "string") {
    d = new Date(dateVal);
  } else if (dateVal.seconds) {
    d = new Date(dateVal.seconds * 1000);
  } else if (dateVal instanceof Date) {
    d = dateVal;
  } else {
    return false;
  }

  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

/**
 * Fetches all salespersons along with computed metrics:
 * - Today's Orders & Today's Sales (₹)
 * - Lifetime Orders & Sales (₹)
 * - Total Quotations
 * - Assigned Clients
 */
export async function fetchLiveSalespersonsWithMetrics(): Promise<SalespersonPerformanceMetrics[]> {
  const spMap = new Map<string, SalespersonPerformanceMetrics>();

  // Start every independent collection read up front so they run in parallel;
  // the sequential steps below then resolve from the shared in-flight promises.
  [
    collection(db, "salesPersons"),
    query(collection(db, "users"), where("role", "==", "salesperson")),
    collection(db, "orders"),
    collection(db, "salesOrders"),
    collection(db, "quotations"),
    collection(db, "users"),
  ].forEach((q) => cachedGetDocs(q).catch(() => {}));

  // 1. Fetch salespersons from 'salesPersons' collection
  try {
    const spSnap = await cachedGetDocs(collection(db, "salesPersons"));
    spSnap.docs.forEach((d) => {
      const data = d.data();
      const id = d.id;
      spMap.set(id, {
        salesPersonId: id,
        employeeId: data.employeeId || `EMP-${id.slice(-4).toUpperCase()}`,
        name: data.name || data.fullName || "Salesperson",
        email: data.email || "",
        phone: data.phone || data.phoneNumber || "",
        referralCode: data.referralCode || "",
        region: data.region || "Western Region",
        states: Array.isArray(data.states) ? data.states : ["GJ"],
        status: data.status === "inactive" || data.isActive === false ? "inactive" : "active",
        assignedClientsCount: Number(data.assignedClientsCount) || 0,
        activeClientsCount: Number(data.activeClientsCount) || 0,
        todayOrdersCount: 0,
        todaySalesAmount: 0,
        totalOrdersCount: 0,
        totalSalesAmount: 0,
        totalQuotationsCount: 0,
        recentOrdersCount: 0,
        createdAt: data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : (typeof data.createdAt === "string" ? data.createdAt : undefined),
      });
    });
  } catch (err) {
    console.warn("Could not query salesPersons collection:", err);
  }

  // 2. Fetch users with role == 'salesperson' from 'users' collection to capture any new staff
  try {
    const usersSnap = await cachedGetDocs(query(collection(db, "users"), where("role", "==", "salesperson")));
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      const spId = (data.salesPersonId || d.id).toString().trim();
      if (!spMap.has(spId)) {
        spMap.set(spId, {
          salesPersonId: spId,
          employeeId: data.employeeId || `EMP-${spId.slice(-4).toUpperCase()}`,
          name: data.name || data.fullName || "Salesperson",
          email: data.email || "",
          phone: data.phone || data.phoneNumber || "",
          referralCode: data.referralCode || "",
          region: data.region || "Western Region",
          states: Array.isArray(data.states) ? data.states : ["GJ"],
          status: data.status === "inactive" || data.isActive === false ? "inactive" : "active",
          assignedClientsCount: Number(data.assignedClientsCount) || 0,
          activeClientsCount: Number(data.activeClientsCount) || 0,
          todayOrdersCount: 0,
          todaySalesAmount: 0,
          totalOrdersCount: 0,
          totalSalesAmount: 0,
          totalQuotationsCount: 0,
          recentOrdersCount: 0,
          createdAt: data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : (typeof data.createdAt === "string" ? data.createdAt : undefined),
        });
      }
    });
  } catch (err) {
    console.warn("Could not query users collection for salespersons:", err);
  }

  // 3. Fallback to baseline default salespersons if database is completely empty
  if (spMap.size === 0) {
    Object.entries(BASELINE_SALESPERSONS).forEach(([id, base]) => {
      spMap.set(id, {
        salesPersonId: id,
        employeeId: base.employeeId || "EMP-SP101",
        name: base.name || "Salesperson",
        email: base.email || "",
        phone: base.phone || "",
        referralCode: base.referralCode || "",
        region: base.region || "Western Region",
        states: base.states || ["GJ"],
        status: (base.status as "active" | "inactive") || "active",
        assignedClientsCount: base.assignedClientsCount || 5,
        activeClientsCount: 3,
        todayOrdersCount: 0,
        todaySalesAmount: 0,
        totalOrdersCount: 0,
        totalSalesAmount: 0,
        totalQuotationsCount: 0,
        recentOrdersCount: 0,
      });
    });
  }

  // 4. Load all orders & salesOrders to attribute sales & metrics
  try {
    const ordersSnap = await cachedGetDocs(collection(db, "orders"));
    const salesOrdersSnap = await cachedGetDocs(collection(db, "salesOrders"));

    const combinedOrders: any[] = [];
    ordersSnap.docs.forEach((d) => combinedOrders.push({ id: d.id, ...d.data() }));
    salesOrdersSnap.docs.forEach((d) => combinedOrders.push({ id: d.id, ...d.data() }));

    // Attribute each order to its corresponding salesperson
    combinedOrders.forEach((ord) => {
      const orderSpId = (ord.salesPersonId || ord.salespersonId || "").toString().trim();
      const orderRefCode = (ord.salespersonReferralCode || ord.referralCode || "").toString().trim().toUpperCase();

      let targetSp = spMap.get(orderSpId);
      if (!targetSp && orderRefCode) {
        for (const sp of spMap.values()) {
          if (sp.referralCode && sp.referralCode.toUpperCase() === orderRefCode) {
            targetSp = sp;
            break;
          }
        }
      }

      if (targetSp) {
        const orderTotal = Number(ord.grandTotal || ord.totalAmount || ord.subtotal || 0);
        targetSp.totalOrdersCount += 1;
        targetSp.totalSalesAmount += orderTotal;

        const isToday = isDateToday(ord.createdAt || ord.updatedAt || ord.date);
        if (isToday) {
          targetSp.todayOrdersCount += 1;
          targetSp.todaySalesAmount += orderTotal;
        }
      }
    });
  } catch (err) {
    console.warn("Could not calculate live orders metrics:", err);
  }

  // 5. Load quotations count
  try {
    const quotesSnap = await cachedGetDocs(collection(db, "quotations"));
    quotesSnap.docs.forEach((d) => {
      const qData = d.data();
      const qSpId = (qData.salespersonId || qData.salesPersonId || "").toString().trim();
      const targetSp = spMap.get(qSpId);
      if (targetSp) {
        targetSp.totalQuotationsCount += 1;
      }
    });
  } catch (err) {
    console.warn("Could not calculate quotations metrics:", err);
  }

  // 6. Calculate assigned clients count from users collection
  try {
    const usersSnap = await cachedGetDocs(collection(db, "users"));
    usersSnap.docs.forEach((d) => {
      const uData = d.data();
      if (uData.role === "salesperson" || uData.role === "admin") return;

      const uSpId = (uData.salesPersonId || uData.assignedSalespersonId || "").toString().trim();
      const uRefCode = (uData.salespersonReferralCode || "").toString().trim().toUpperCase();

      let targetSp = spMap.get(uSpId);
      if (!targetSp && uRefCode) {
        for (const sp of spMap.values()) {
          if (sp.referralCode && sp.referralCode.toUpperCase() === uRefCode) {
            targetSp = sp;
            break;
          }
        }
      }

      if (targetSp) {
        targetSp.assignedClientsCount = (targetSp.assignedClientsCount || 0) + 1;
        if (uData.status === "active" || uData.isActive === true) {
          targetSp.activeClientsCount = (targetSp.activeClientsCount || 0) + 1;
        }
      }
    });
  } catch (err) {
    console.warn("Could not tally assigned clients:", err);
  }

  return Array.from(spMap.values());
}

/**
 * Fetches detailed performance data for a single salesperson:
 * - Today's orders
 * - All historical orders
 * - All quotations
 * - Assigned client roster
 */
export async function fetchSalespersonDetailedActivity(
  sp: SalespersonPerformanceMetrics
): Promise<SalespersonDetailData> {
  const spId = sp.salesPersonId;
  const refCode = (sp.referralCode || "").trim().toUpperCase();

  // 1. Orders
  const allOrders: any[] = [];
  const todayOrders: any[] = [];

  try {
    const ordersSnap = await cachedGetDocs(collection(db, "orders"));
    const salesOrdersSnap = await cachedGetDocs(collection(db, "salesOrders"));

    const combined: any[] = [];
    ordersSnap.docs.forEach((d) => combined.push({ id: d.id, ...d.data() }));
    salesOrdersSnap.docs.forEach((d) => combined.push({ id: d.id, ...d.data() }));

    combined.forEach((ord) => {
      const docSpId = (ord.salesPersonId || ord.salespersonId || "").toString().trim();
      const docRefCode = (ord.salespersonReferralCode || ord.referralCode || "").toString().trim().toUpperCase();

      if (docSpId === spId || (refCode && docRefCode === refCode)) {
        allOrders.push(ord);
        if (isDateToday(ord.createdAt || ord.updatedAt || ord.date)) {
          todayOrders.push(ord);
        }
      }
    });
  } catch (err) {
    console.warn("Could not fetch detailed orders:", err);
  }

  // 2. Quotations
  const allQuotations: Quotation[] = [];
  try {
    const quotesSnap = await cachedGetDocs(collection(db, "quotations"));
    quotesSnap.docs.forEach((d) => {
      const data = d.data();
      const docSpId = (data.salespersonId || data.salesPersonId || "").toString().trim();
      if (docSpId === spId) {
        allQuotations.push({ id: d.id, ...data } as Quotation);
      }
    });
  } catch (err) {
    console.warn("Could not fetch detailed quotations:", err);
  }

  // 3. Assigned Customers
  const assignedClients: Customer[] = [];
  try {
    const usersSnap = await cachedGetDocs(collection(db, "users"));
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.role === "salesperson" || data.role === "admin") return;

      const docSpId = (data.salesPersonId || data.assignedSalespersonId || "").toString().trim();
      const docRefCode = (data.salespersonReferralCode || "").toString().trim().toUpperCase();

      if (docSpId === spId || (refCode && docRefCode === refCode)) {
        const rawName = (data.name || data.fullName || "").trim();
        const rawCompany = (data.companyName || data.businessName || "").trim();
        const phone = (data.phone || data.phoneNumber || "").trim();

        assignedClients.push({
          id: d.id,
          userId: d.id,
          customerNumber: data.customerNumber || `CUST-${d.id.slice(-6).toUpperCase()}`,
          name: rawName || `Client (${phone.slice(-4)})`,
          companyName: rawCompany || "Partner Dealer",
          phone,
          email: data.email || "",
          city: data.city || data.address?.city || "Gujarat",
          state: data.state || data.address?.state || "GJ",
          category: data.userCategory || data.category || "Dealer",
          priceTier: data.priceTier || "B",
          creditLimit: Number(data.creditLimit) || 1000000,
          paymentTerms: data.paymentTerms || "30 Days",
          assignedSalespersonId: spId,
          status: data.status || "active",
          createdAt: data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt?.seconds ? new Date(data.updatedAt.seconds * 1000).toISOString() : new Date().toISOString(),
        });
      }
    });
  } catch (err) {
    console.warn("Could not fetch assigned customers:", err);
  }

  return {
    salesperson: sp,
    todayOrders,
    allOrders,
    allQuotations,
    assignedClients,
  };
}

/**
 * Creates a brand new Salesperson Account:
 * 1. Registers the user in Firebase Auth via Identity Toolkit REST API
 *    (preventing the admin from being signed out on client side).
 * 2. Hashes password using SHA-256("${salt}:${password}") for staffAuthEngine.js Path A.
 * 3. Saves canonical 'users/{uid}' document.
 * 4. Saves 'salesPersons/{uid}' document.
 */
export async function createSalespersonAccount(
  input: NewSalespersonInput
): Promise<{ success: boolean; uid: string; employeeId?: string; referralCode?: string; error?: string }> {
  try {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanPhone = normalizePhone(input.phone);
    const cleanName = input.name.trim();
    const generated = await generateSalespersonIdentifiers();
    // Employee ID and referral code are always issued as a pair so they share the same number
    const providedEmpId = (input.employeeId || "").trim().toUpperCase();
    const providedRefCode = (input.referralCode || "").trim().toUpperCase();
    const usePair = providedEmpId && providedRefCode;
    const cleanEmpId = usePair ? providedEmpId : generated.employeeId;
    const cleanRefCode = usePair ? providedRefCode : generated.referralCode;
    const cleanRegion = input.region.trim();
    const cleanPassword = input.password;

    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error("Please enter a valid phone number (10 digits).");
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }
    if (!cleanName) {
      throw new Error("Please enter the salesperson's full name.");
    }
    if (!cleanRefCode) {
      throw new Error("Please enter a unique referral code (e.g., SALES104).");
    }

    // 1. Generate salt and hash for constant-time staffAuthEngine authentication
    const salt = generateSaltHex(16);
    const passwordHash = await hashStaffPassword(cleanPassword, salt);

    // 2. Register Firebase Auth account via Google Identity Toolkit REST API
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ";
    let authedUid = "";

    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          returnSecureToken: true,
        }),
      });

      const resData = await res.json();
      if (resData.error) {
        if (resData.error.message?.includes("EMAIL_EXISTS")) {
          // If email already exists, look up existing user doc in users collection to link
          const userQuerySnap = await getDocs(query(collection(db, "users"), where("email", "==", cleanEmail)));
          if (!userQuerySnap.empty) {
            authedUid = userQuerySnap.docs[0].id;
          } else {
            authedUid = `SP_${cleanPhone.slice(-4) || Date.now().toString().slice(-4)}`;
          }
        } else {
          throw new Error(resData.error.message || "Failed to create Firebase Auth user.");
        }
      } else {
        authedUid = resData.localId;
      }
    } catch (authErr: any) {
      if (!authedUid) {
        // Fallback: check if doc exists by email
        try {
          const userQuerySnap = await getDocs(query(collection(db, "users"), where("email", "==", cleanEmail)));
          if (!userQuerySnap.empty) {
            authedUid = userQuerySnap.docs[0].id;
          }
        } catch (_) {}
        if (!authedUid) {
          authedUid = `SP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }
      }
    }

    const nowIso = new Date().toISOString();

    // 3. Create authoritative users/{uid} document
    invalidateFirestoreCache();
    await setDoc(doc(db, "users", authedUid), {
      userId: authedUid,
      uid: authedUid,
      name: cleanName,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      phoneNumber: cleanPhone,
      role: "salesperson",
      userCategory: "salesperson",
      salesPersonId: authedUid,
      referralCode: cleanRefCode,
      region: cleanRegion,
      employeeId: cleanEmpId,
      status: "active",
      isActive: true,
      passwordHash,
      passwordSalt: salt,
      createdAt: nowIso,
      updatedAt: nowIso,
    }, { merge: true });

    // 4. Create authoritative salesPersons/{uid} document
    invalidateFirestoreCache();
    await setDoc(doc(db, "salesPersons", authedUid), {
      salesPersonId: authedUid,
      employeeId: cleanEmpId,
      name: cleanName,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      phoneNumber: cleanPhone,
      referralCode: cleanRefCode,
      region: cleanRegion,
      states: input.states && input.states.length > 0 ? input.states : ["GJ"],
      status: "active",
      isActive: true,
      assignedClientsCount: 0,
      activeClientsCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    }, { merge: true });

    return { success: true, uid: authedUid, employeeId: cleanEmpId, referralCode: cleanRefCode };
  } catch (err: any) {
    console.error("createSalespersonAccount error:", err);
    return { success: false, uid: "", error: err.message || "Failed to create salesperson profile." };
  }
}

/**
 * Resets or updates a salesperson's login password in Firestore
 * allowing instant login with the new credentials.
 */
export async function resetSalespersonPassword(
  salesPersonId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }
    const salt = generateSaltHex(16);
    const passwordHash = await hashStaffPassword(newPassword, salt);
    const nowIso = new Date().toISOString();

    invalidateFirestoreCache();
    await updateDoc(doc(db, "users", salesPersonId), {
      passwordHash,
      passwordSalt: salt,
      updatedAt: nowIso,
    });

    return { success: true };
  } catch (err: any) {
    console.error("resetSalespersonPassword error:", err);
    return { success: false, error: err.message || "Failed to update password." };
  }
}

/**
 * Toggles a salesperson's active/inactive status across both collections
 */
export async function toggleSalespersonStatus(
  salesPersonId: string,
  newStatus: "active" | "inactive"
): Promise<boolean> {
  try {
    const isActive = newStatus === "active";
    const nowIso = new Date().toISOString();

    // Update salesPersons doc
    try {
      invalidateFirestoreCache();
      await updateDoc(doc(db, "salesPersons", salesPersonId), {
        status: newStatus,
        isActive,
        updatedAt: nowIso,
      });
    } catch (_) {}

    // Update users doc
    try {
      invalidateFirestoreCache();
      await updateDoc(doc(db, "users", salesPersonId), {
        status: newStatus,
        isActive,
        updatedAt: nowIso,
      });
    } catch (_) {}

    return true;
  } catch (err) {
    console.error("toggleSalespersonStatus error:", err);
    return false;
  }
}
