import { db } from "@/lib/firebase";
import { invalidateFirestoreCache } from "@/lib/firestore-cache";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { Lead, LeadSource, LeadStatus } from "@/types";

export interface DeleteLeadResult {
  success: boolean;
  error?: string;
  deletedLeadId?: string;
  deletedFollowUpsCount?: number;
  deletedOpportunitiesCount?: number;
}

/**
 * Permanently deletes a lead as an admin:
 * 1. Backs up the full lead document (and associated follow-ups) to `deletedLeadsLog`
 *    with deletedBy, deletedAt, and reason: "admin delete" before deleting.
 * 2. Deletes the lead doc and its follow-ups.
 * 3. Does NOT delete or change: customer created from converted lead, quotations, sales orders, orders.
 * 4. If an opportunity is linked ONLY to this lead and has NO quotations, deletes it;
 *    otherwise keeps it and removes the lead link.
 */
export async function deleteLeadAsAdmin(
  lead: Lead,
  deletedBy: { uid: string; name?: string; role?: string }
): Promise<DeleteLeadResult> {
  try {
    const leadId = lead.id;
    if (!leadId) {
      return { success: false, error: "Lead ID is required." };
    }

    // 1. Fetch live lead data from Firestore if present
    const leadRef = doc(db, "leads", leadId);
    let liveLeadData: Record<string, any> = { ...lead };
    try {
      const snap = await getDoc(leadRef);
      if (snap.exists()) {
        liveLeadData = { id: snap.id, ...snap.data() };
      }
    } catch (e) {
      console.warn("Could not read lead doc before delete:", e);
    }

    // 2. Fetch associated follow-ups
    const followUpsToDelete: { id: string; data: Record<string, any>; ref: any }[] = [];
    try {
      // Query 1: followUps where targetId == leadId
      const q1 = query(collection(db, "followUps"), where("targetId", "==", leadId));
      const snap1 = await getDocs(q1);
      snap1.docs.forEach((d) => {
        followUpsToDelete.push({ id: d.id, data: d.data(), ref: d.ref });
      });

      // Query 2: followUps where leadId == leadId
      const q2 = query(collection(db, "followUps"), where("leadId", "==", leadId));
      const snap2 = await getDocs(q2);
      snap2.docs.forEach((d) => {
        if (!followUpsToDelete.some((f) => f.id === d.id)) {
          followUpsToDelete.push({ id: d.id, data: d.data(), ref: d.ref });
        }
      });

      // Subcollection check: leads/{leadId}/followUps
      try {
        const subSnap = await getDocs(collection(db, "leads", leadId, "followUps"));
        subSnap.docs.forEach((d) => {
          if (!followUpsToDelete.some((f) => f.id === d.id)) {
            followUpsToDelete.push({ id: d.id, data: d.data(), ref: d.ref });
          }
        });
      } catch (_) {}
    } catch (e) {
      console.warn("Could not query follow-ups for lead:", e);
    }

    // 3. Inspect linked opportunities
    let deletedOppsCount = 0;
    const oppsToDelete: { id: string; ref: any }[] = [];
    const oppsToUnlink: { id: string; ref: any }[] = [];

    try {
      const oppsQuery = query(collection(db, "opportunities"), where("leadId", "==", leadId));
      const oppsSnap = await getDocs(oppsQuery);

      for (const oppDoc of oppsSnap.docs) {
        const oppId = oppDoc.id;

        // Check if this opportunity has quotations
        let hasQuotations = false;
        try {
          const qSnap = await getDocs(
            query(collection(db, "quotations"), where("opportunityId", "==", oppId))
          );
          if (!qSnap.empty) {
            hasQuotations = true;
          }
        } catch (_) {}

        if (!hasQuotations) {
          // If linked ONLY to this lead and has NO quotations, delete it
          oppsToDelete.push({ id: oppId, ref: oppDoc.ref });
        } else {
          // Has quotations: keep the opportunity, only remove the lead link
          oppsToUnlink.push({ id: oppId, ref: oppDoc.ref });
        }
      }
    } catch (e) {
      console.warn("Could not query opportunities for lead:", e);
    }

    // 4. Write full copy to `deletedLeadsLog`
    try {
      await addDoc(collection(db, "deletedLeadsLog"), {
        leadId,
        leadNumber: liveLeadData.leadNumber || lead.leadNumber || `LD-${leadId}`,
        leadName: liveLeadData.name || lead.name || "Lead",
        leadData: liveLeadData,
        followUps: followUpsToDelete.map((f) => ({ id: f.id, ...f.data })),
        followUpsCount: followUpsToDelete.length,
        deletedBy: deletedBy.uid,
        deletedByName: deletedBy.name || "Admin",
        deletedByRole: deletedBy.role || "admin",
        deletedAt: serverTimestamp(),
        deletedAtIso: new Date().toISOString(),
        reason: "admin delete",
      });
    } catch (logErr: any) {
      console.error("Failed to write to deletedLeadsLog:", logErr);
      return {
        success: false,
        error: `Permission denied or error saving audit copy: ${logErr?.message || logErr}`,
      };
    }

    // 5. Delete follow-ups
    for (const f of followUpsToDelete) {
      try {
        await deleteDoc(f.ref);
      } catch (err) {
        console.warn(`Failed to delete follow-up ${f.id}:`, err);
      }
    }

    // 6. Delete or unlink opportunities
    for (const opp of oppsToDelete) {
      try {
        await deleteDoc(opp.ref);
        deletedOppsCount++;
      } catch (err) {
        console.warn(`Failed to delete opportunity ${opp.id}:`, err);
      }
    }
    for (const opp of oppsToUnlink) {
      try {
        await updateDoc(opp.ref, {
          leadId: deleteField(),
          leadNumber: deleteField(),
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn(`Failed to unlink opportunity ${opp.id}:`, err);
      }
    }

    // 7. Delete lead doc
    try {
      await deleteDoc(leadRef);
    } catch (err: any) {
      console.error("Failed to delete lead document:", err);
      return {
        success: false,
        error: err?.message || "Failed to delete lead from Firestore.",
      };
    }

    // 8. Invalidate cache
    try {
      invalidateFirestoreCache();
    } catch (_) {}

    return {
      success: true,
      deletedLeadId: leadId,
      deletedFollowUpsCount: followUpsToDelete.length,
      deletedOpportunitiesCount: deletedOppsCount,
    };
  } catch (err: any) {
    console.error("Error in deleteLeadAsAdmin:", err);
    return {
      success: false,
      error: err?.message || "Unexpected error while deleting lead.",
    };
  }
}

export interface UpdateLeadInput {
  leadId: string;
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  city: string;
  state: string;
  source: LeadSource;
  status: LeadStatus;
  assignedSalespersonId: string;
  assignedSalespersonName?: string;
  requirementNotes?: string;
  updatedBy: string;
  updatedByName?: string;
  updatedByRole?: string;
}

export interface UpdateLeadResult {
  success: boolean;
  error?: string;
  updatedLead?: Lead;
}

/**
 * Updates a lead as an admin:
 * 1. Validates required fields, 10-digit Indian mobile, email format, and salesperson.
 * 2. Writes audit entry to `leadEditLogs` with full field diffs (old -> new), updatedBy, and timestamp.
 * 3. Updates the lead doc in `leads/{leadId}` with the exact same fields the portal reads.
 * 4. If assigned salesperson changed: updates assignedSalespersonId/Name and sets reassignedBy & reassignedAt.
 * 5. Does NOT change customer, opportunity, quotation, or follow-up.
 */
export async function updateLeadAsAdmin(
  input: UpdateLeadInput
): Promise<UpdateLeadResult> {
  try {
    const { leadId } = input;
    if (!leadId) return { success: false, error: "Lead ID is required." };

    const name = input.name.trim();
    if (!name) return { success: false, error: "Contact Person Name is required." };

    // Validate 10-digit mobile
    const digitsOnly = input.phone.replace(/\D/g, "");
    let cleanPhone = input.phone.trim();
    if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
      cleanPhone = digitsOnly;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith("91") && /^[6-9]\d{9}$/.test(digitsOnly.slice(2))) {
      cleanPhone = digitsOnly.slice(2);
    } else {
      return { success: false, error: "Enter a valid 10-digit Indian mobile number." };
    }

    // Validate email if present
    const email = (input.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "Enter a valid email address format." };
    }

    if (!input.assignedSalespersonId) {
      return { success: false, error: "Please select an assigned salesperson." };
    }

    // 1. Fetch current lead data
    const leadRef = doc(db, "leads", leadId);
    let oldData: Record<string, any> = {};
    try {
      const snap = await getDoc(leadRef);
      if (snap.exists()) {
        oldData = snap.data() || {};
      }
    } catch (e) {
      console.warn("Could not read current lead doc from Firestore:", e);
    }

    // Check converted restriction
    const wasConverted = oldData.status === "converted";
    if (wasConverted && input.status !== "converted") {
      return { success: false, error: "Lead is converted. Status cannot be changed back from Converted." };
    }

    const isReassigned = String(oldData.assignedSalespersonId || "").trim() !== String(input.assignedSalespersonId).trim();

    // 2. Prepare updated data
    const updatePayload: Record<string, any> = {
      name,
      companyName: (input.companyName || "").trim() || null,
      phone: cleanPhone,
      email: email || null,
      city: (input.city || "Ahmedabad").trim(),
      state: (input.state || "Gujarat").trim(),
      source: input.source,
      status: input.status,
      assignedSalespersonId: input.assignedSalespersonId,
      assignedSalespersonName: input.assignedSalespersonName || "Sales Executive",
      requirementNotes: (input.requirementNotes || "").trim() || null,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy,
      timestamp: serverTimestamp(),
    };

    if (isReassigned) {
      updatePayload.reassignedBy = input.updatedBy;
      updatePayload.reassignedAt = new Date().toISOString();
    }

    // 3. Compute audit diff
    const trackKeys = [
      "name",
      "companyName",
      "phone",
      "email",
      "city",
      "state",
      "source",
      "status",
      "assignedSalespersonId",
      "assignedSalespersonName",
      "requirementNotes",
    ] as const;

    const changes: Record<string, { old: any; new: any }> = {};
    for (const k of trackKeys) {
      const oVal = oldData[k] ?? "";
      const nVal = updatePayload[k] ?? "";
      if (String(oVal).trim() !== String(nVal).trim()) {
        changes[k] = { old: oVal, new: nVal };
      }
    }

    // 4. Save audit log to `leadEditLogs`
    try {
      await addDoc(collection(db, "leadEditLogs"), {
        leadId,
        leadNumber: oldData.leadNumber || input.leadId,
        leadName: name,
        changes,
        isReassigned,
        updatedBy: input.updatedBy,
        updatedByName: input.updatedByName || "Admin",
        updatedByRole: input.updatedByRole || "admin",
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
        reason: "admin edit",
      });
    } catch (logErr: any) {
      console.warn("Failed to write to leadEditLogs audit collection:", logErr);
    }

    // 5. Update Firestore lead doc
    await setDoc(leadRef, updatePayload, { merge: true });

    // 6. Invalidate cache
    try {
      invalidateFirestoreCache();
    } catch (_) {}

    const updatedLead: Lead = {
      id: leadId,
      leadNumber: oldData.leadNumber || input.leadId,
      name,
      companyName: updatePayload.companyName || undefined,
      phone: cleanPhone,
      email: email || undefined,
      city: updatePayload.city,
      state: updatePayload.state,
      source: input.source,
      status: input.status,
      assignedSalespersonId: input.assignedSalespersonId,
      assignedSalespersonName: updatePayload.assignedSalespersonName,
      assignedBy: oldData.assignedBy,
      assignedAt: oldData.assignedAt,
      requirementNotes: updatePayload.requirementNotes || undefined,
      convertedCustomerId: oldData.convertedCustomerId,
      createdAt: oldData.createdAt || new Date().toISOString(),
      updatedAt: updatePayload.updatedAt,
    };

    return {
      success: true,
      updatedLead,
    };
  } catch (err: any) {
    console.error("Error in updateLeadAsAdmin:", err);
    return {
      success: false,
      error: err?.message || "Unexpected error while updating lead.",
    };
  }
}


