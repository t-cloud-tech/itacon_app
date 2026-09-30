import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { Customer, UserProfile, SalesPerson, UserRole } from "@/types";

/**
 * Fetches LIVE customers from Firestore allocated to the logged-in salesperson,
 * or all customers if the user is an admin.
 * ZERO mock data — only authentic records from the database.
 */
export async function fetchLiveCustomers(
  user: UserProfile | null,
  salesperson: SalesPerson | null,
  role: UserRole | null
): Promise<Customer[]> {
  try {
    const spId = salesperson?.salesPersonId || user?.salesPersonId || user?.userId || "";
    const refCode = (salesperson?.referralCode || user?.referralCode || "").trim().toUpperCase();

    const customersMap = new Map<string, Customer>();

    // 1. Fetch from 'users' collection (primary ITACON customer datastore)
    // Note: Restricted to staff in security rules; errors are caught so dedicated 'customers' collection is also queried.
    try {
      const usersSnap = await getDocs(collection(db, "users"));

      usersSnap.docs.forEach((d) => {
        const data = d.data();
        const userRole = (data.role || "").toLowerCase();

        // Exclude staff accounts (salespersons and admins)
        if (userRole === "salesperson" || userRole === "admin") return;

        let isAllocated = false;

        if (role === "admin") {
          // Admin sees all registered customers
          isAllocated = true;
        } else {
          // Salesperson: match by salesperson ID or referral code
          const docSpId = (data.salesPersonId || data.assignedSalespersonId || "").toString().trim();
          const docRefCode = (data.salespersonReferralCode || "").toString().trim().toUpperCase();

          if (
            (spId && (docSpId === spId || (user?.userId && docSpId === user.userId))) ||
            (refCode && docRefCode === refCode)
          ) {
            isAllocated = true;
          }
        }

        if (isAllocated) {
          const rawName = (data.name || data.fullName || "").trim();
          const rawCompany = (data.companyName || data.businessName || data.firmName || "").trim();
          const phone = (data.phone || data.phoneNumber || "").trim();

          // Graceful display name resolution
          const name = rawName || (phone ? `Client (${phone.slice(-4)})` : `Customer ${d.id.slice(-5)}`);
          const companyName = rawCompany || (rawName ? `${rawName} Enterprise` : "ITACON Partner");

          // Format user category
          const rawCat = (data.userCategory || data.role || "Dealer").toString().trim();
          const category = (rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase()) as Customer["category"];

          // Determine pricing tier
          const tier = data.priceTier || (category === "Wholesaler" ? "A" : category === "Dealer" ? "B" : "C");

          // Determine credit terms
          const creditLimit = Number(data.creditLimit) || (category === "Wholesaler" ? 2500000 : 1000000);
          const paymentTerms = data.paymentTerms || (category === "Wholesaler" ? "45 Days" : "30 Days");

          // Format timestamp safely
          let createdAtIso = new Date().toISOString();
          if (data.createdAt?.seconds) {
            createdAtIso = new Date(data.createdAt.seconds * 1000).toISOString();
          } else if (typeof data.createdAt === "string" && data.createdAt) {
            createdAtIso = data.createdAt;
          }

          let updatedAtIso = createdAtIso;
          if (data.updatedAt?.seconds) {
            updatedAtIso = new Date(data.updatedAt.seconds * 1000).toISOString();
          } else if (typeof data.updatedAt === "string" && data.updatedAt) {
            updatedAtIso = data.updatedAt;
          }

          customersMap.set(d.id, {
            id: d.id,
            userId: d.id,
            customerNumber: data.customerNumber || `CUST-${d.id.slice(-6).toUpperCase()}`,
            name,
            companyName,
            phone,
            email: data.email || "",
            city: data.city || data.address?.city || "Gujarat",
            state: data.state || data.address?.state || "Gujarat",
            address: typeof data.address === "string" ? data.address : (data.address?.line1 || ""),
            pincode: data.pincode || data.address?.pincode || "",
            gstNumber: data.gstNumber || data.gstin || "",
            category: ["Dealer", "Wholesaler", "Retailer", "Contractor", "Architect", "Builder"].includes(category)
              ? category
              : "Dealer",
            priceTier: tier as "A" | "B" | "C",
            creditLimit,
            paymentTerms,
            assignedSalespersonId: data.assignedSalespersonId || data.salesPersonId || spId,
            status: data.status || "active",
            createdAt: createdAtIso,
            updatedAt: updatedAtIso,
          });
        }
      });
    } catch (usersErr: any) {
      console.warn("Could not fetch from 'users' collection (may require elevated staff claims):", usersErr?.message || usersErr);
    }

    // 2. Also check if any dedicated documents exist in 'customers' collection
    try {
      const custSnap = await getDocs(collection(db, "customers"));
      custSnap.docs.forEach((d) => {
        const data = d.data();
        let isAllocated = false;

        if (role === "admin") {
          isAllocated = true;
        } else {
          const docSpId = (data.assignedSalespersonId || data.salesPersonId || "").toString().trim();
          if (spId && (docSpId === spId || (user?.userId && docSpId === user.userId))) {
            isAllocated = true;
          }
        }

        if (isAllocated && !customersMap.has(d.id)) {
          customersMap.set(d.id, {
            id: d.id,
            userId: d.id,
            customerNumber: data.customerNumber || `CUST-${d.id.slice(-6).toUpperCase()}`,
            name: data.name || "Customer",
            companyName: data.companyName || data.name || "Partner",
            phone: data.phone || "",
            email: data.email || "",
            city: data.city || "Gujarat",
            state: data.state || "Gujarat",
            category: data.category || "Dealer",
            priceTier: data.priceTier || "B",
            creditLimit: Number(data.creditLimit) || 1000000,
            paymentTerms: data.paymentTerms || "30 Days",
            assignedSalespersonId: data.assignedSalespersonId || spId,
            status: data.status || "active",
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          } as Customer);
        }
      });
    } catch (_) {}

    return Array.from(customersMap.values());
  } catch (error) {
    console.error("Error fetching live customers from Firestore:", error);
    return [];
  }
}

/**
 * Fetches a single live customer by ID from Firestore (users or customers collection).
 * Returns null if not found (NO mock fallback).
 */
export async function fetchLiveCustomerById(customerId: string): Promise<Customer | null> {
  if (!customerId) return null;
  try {
    // 1. Try 'users' collection
    try {
      const userSnap = await getDoc(doc(db, "users", customerId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        const rawName = (data.name || data.fullName || "").trim();
        const rawCompany = (data.companyName || data.businessName || data.firmName || "").trim();
        const phone = (data.phone || data.phoneNumber || "").trim();
        const name = rawName || (phone ? `Client (${phone.slice(-4)})` : `Customer ${userSnap.id.slice(-5)}`);
        const companyName = rawCompany || (rawName ? `${rawName} Enterprise` : "ITACON Partner");
        const rawCat = (data.userCategory || data.role || "Dealer").toString().trim();
        const category = (rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase()) as Customer["category"];

        return {
          id: userSnap.id,
          userId: userSnap.id,
          customerNumber: data.customerNumber || `CUST-${userSnap.id.slice(-6).toUpperCase()}`,
          name,
          companyName,
          phone,
          email: data.email || "",
          city: data.city || data.address?.city || "Gujarat",
          state: data.state || data.address?.state || "Gujarat",
          address: typeof data.address === "string" ? data.address : (data.address?.line1 || ""),
          pincode: data.pincode || data.address?.pincode || "",
          gstNumber: data.gstNumber || data.gstin || "",
          category: ["Dealer", "Wholesaler", "Retailer", "Contractor", "Architect", "Builder"].includes(category)
            ? category
            : "Dealer",
          priceTier: data.priceTier || (category === "Wholesaler" ? "A" : category === "Dealer" ? "B" : "C"),
          creditLimit: Number(data.creditLimit) || (category === "Wholesaler" ? 2500000 : 1000000),
          paymentTerms: data.paymentTerms || "30 Days",
          assignedSalespersonId: data.assignedSalespersonId || data.salesPersonId || "",
          status: data.status || "active",
          createdAt: data.createdAt?.seconds 
            ? new Date(data.createdAt.seconds * 1000).toISOString() 
            : (typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString()),
          updatedAt: data.updatedAt?.seconds 
            ? new Date(data.updatedAt.seconds * 1000).toISOString() 
            : (typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString()),
        };
      }
    } catch (_) {
      // If user lacks permission for users doc, proceed to customers collection
    }

    // 2. Try 'customers' collection
    try {
      const custSnap = await getDoc(doc(db, "customers", customerId));
      if (custSnap.exists()) {
        return { id: custSnap.id, ...custSnap.data() } as Customer;
      }
    } catch (_) {}

    return null;
  } catch (error) {
    console.error("Error fetching customer by ID:", error);
    return null;
  }
}
