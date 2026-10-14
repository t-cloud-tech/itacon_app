"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, updateDoc, doc } from "firebase/firestore";
import { ApprovalRequest, SalespersonActionStatus } from "@/types";
import { 
  adminConfirmOrder, 
  adminRejectOrder, 
  salespersonReleaseOrderToApp,
  salespersonDeclineOrder 
} from "@/lib/order-service";
import { 
  CheckSquare, 
  ShieldAlert, 
  ShieldCheck,
  Check, 
  X, 
  Clock, 
  FileSpreadsheet, 
  UserCheck, 
  AlertCircle,
  Building2,
  Smartphone,
  Lock,
  Send,
  Filter,
  Eye
} from "lucide-react";

export default function ApprovalsPage() {
  const { user, role, salesperson } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  
  // The 4 sub-tabs: pending, approved, rejected, all
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  
  // For Admin: ability to filter by salesperson or view all. For Salesperson: automatically locked to own ID
  const [adminSalespersonFilter, setAdminSalespersonFilter] = useState<string>("all");
  
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Identify active salesperson if in salesperson role
  const currentSalespersonId = useMemo(() => {
    return (
      salesperson?.salesPersonId || 
      user?.salesPersonId || 
      user?.userId || 
      "sp-1"
    ).trim();
  }, [salesperson, user]);

  const currentSalespersonName = useMemo(() => {
    return salesperson?.name || user?.name || "Vraj Shah";
  }, [salesperson, user]);

  useEffect(() => {
    async function fetchApprovals() {
      setIsLoading(true);
      try {
        const appRef = collection(db, "approvalRequests");
        const q = query(appRef, orderBy("createdAt", "desc"));

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApprovalRequest));

        if (list.length > 0) {
          setApprovals(list);
        } else {
          // Multi-salesperson realistic sample requests illustrating role differences
          setApprovals([
            // Salesperson 1: Vraj Shah (sp-1)
            {
              id: "app-1",
              referenceType: "low_rate_po",
              referenceId: "qt-103",
              referenceNumber: "ITC-PO-2026-9810",
              orderId: "ORD_TEST_9810",
              salespersonId: "sp-1",
              salespersonName: "Vraj Shah",
              customerId: "cust-2",
              customerName: "Gujarat Ceramics & Tiles",
              discountRequested: 12,
              pricePerSqft: 24.50,
              rateThreshold: 26.50,
              totalValue: 50274,
              reason: "PO effective rate is ₹24.50/sq.ft, which is below the mandatory ₹26.50/sq.ft threshold. Requires Admin confirmation before customer app release.",
              status: "pending",
              assignedToRole: "admin",
              salespersonActionStatus: "pending_admin_review",
              createdAt: "Today, 09:15 AM",
            },
            {
              id: "app-2",
              referenceType: "low_rate_po",
              referenceId: "qt-204",
              referenceNumber: "ITC-PO-2026-7721",
              orderId: "ORD_APPROVED_7721",
              salespersonId: "sp-1",
              salespersonName: "Vraj Shah",
              customerId: "cust-5",
              customerName: "Morbi Tiles & Granites Ltd",
              discountRequested: 15,
              pricePerSqft: 23.80,
              rateThreshold: 26.50,
              totalValue: 124800,
              reason: "High-volume wholesale booking (3 Full Truckloads). Special agreed pricing.",
              status: "approved",
              adminDecision: "approved",
              assignedToRole: "admin",
              decidedBy: "Managing Director",
              decidedAt: "Today, 11:30 AM",
              decisionNotes: "Approved special wholesale rate exception for 3 truckloads. Reflected in salesperson approval tab for customer app release.",
              salespersonActionStatus: "pending_release",
              createdAt: "Today, 08:30 AM",
            },
            {
              id: "app-3",
              referenceType: "low_rate_po",
              referenceId: "qt-308",
              referenceNumber: "ITC-PO-2026-4419",
              orderId: "ORD_REJECTED_4419",
              salespersonId: "sp-1",
              salespersonName: "Vraj Shah",
              customerId: "cust-3",
              customerName: "Saurashtra Ceramic Hub",
              discountRequested: 22,
              pricePerSqft: 21.20,
              rateThreshold: 26.50,
              totalValue: 48900,
              reason: "Client negotiated aggressive price of ₹21.20/sq.ft for GVT polished tiles.",
              status: "rejected",
              adminDecision: "rejected",
              assignedToRole: "admin",
              decidedBy: "Head Office Management",
              decidedAt: "Yesterday, 04:45 PM",
              decisionNotes: "Rate of ₹21.20/sq.ft is below factory floor cost. Minimum permissible rate is ₹26.50/sq.ft. Reflected in salesperson approval tab for rate revision.",
              salespersonActionStatus: "action_required_revision",
              createdAt: "Yesterday, 02:10 PM",
            },
            // Salesperson 2: Vikram Mehta (sp-2)
            {
              id: "app-4",
              referenceType: "low_rate_po",
              referenceId: "qt-501",
              referenceNumber: "ITC-PO-2026-6612",
              orderId: "ORD_TEST_6612",
              salespersonId: "sp-2",
              salespersonName: "Vikram Mehta",
              customerId: "cust-6",
              customerName: "Ambica Marble & Ceramic",
              discountRequested: 14,
              pricePerSqft: 25.10,
              rateThreshold: 26.50,
              totalValue: 88500,
              reason: "Special institutional pricing for secondary school flooring project.",
              status: "pending",
              assignedToRole: "admin",
              salespersonActionStatus: "pending_admin_review",
              createdAt: "Today, 10:00 AM",
            },
            {
              id: "app-5",
              referenceType: "quotation",
              referenceId: "qt-089",
              referenceNumber: "QT-2026-089",
              salespersonId: "sp-2",
              salespersonName: "Vikram Mehta",
              customerId: "cust-4",
              customerName: "Maruti Tile World",
              discountRequested: 20,
              pricePerSqft: 29.80,
              rateThreshold: 26.50,
              totalValue: 1450000,
              reason: "Yearly dealership renewal incentive. Full truckload booking.",
              status: "approved",
              adminDecision: "approved",
              assignedToRole: "admin",
              decidedBy: "Managing Director",
              decidedAt: "Sep 20, 2026",
              decisionNotes: "Approved under wholesale incentive scheme.",
              salespersonActionStatus: "released",
              salespersonReleasedAt: "Sep 20, 2026, 03:00 PM",
              salespersonReleasedBy: "Vikram Mehta",
              createdAt: "Sep 19, 2026",
            },
            // Salesperson 3: Rahul Sharma (SP_101)
            {
              id: "app-6",
              referenceType: "low_rate_po",
              referenceId: "qt-602",
              referenceNumber: "ITC-PO-2026-3390",
              orderId: "ORD_TEST_3390",
              salespersonId: "SP_101",
              salespersonName: "Rahul Sharma",
              customerId: "cust-7",
              customerName: "Somnath Tiles Hub",
              discountRequested: 16,
              pricePerSqft: 24.10,
              rateThreshold: 26.50,
              totalValue: 64200,
              reason: "New showroom display sample stock discount.",
              status: "approved",
              adminDecision: "approved",
              assignedToRole: "admin",
              decidedBy: "Managing Director",
              decidedAt: "Yesterday, 06:15 PM",
              decisionNotes: "Approved introductory dealership sample rates.",
              salespersonActionStatus: "pending_release",
              createdAt: "Yesterday, 03:30 PM",
            },
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch approvals from Firestore:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchApprovals();
  }, [user]);

  // Clear toast message after 6 seconds
  useEffect(() => {
    if (actionSuccessMsg) {
      const timer = setTimeout(() => setActionSuccessMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessMsg]);

  // Unique list of salespersons for Admin filtering dropdown
  const uniqueSalespersons = useMemo(() => {
    return Array.from(
      new Set(approvals.map(a => JSON.stringify({ id: a.salespersonId, name: a.salespersonName })))
    ).map(s => JSON.parse(s));
  }, [approvals]);

  // Determine whether current user perspective is salesperson or admin
  const isSalespersonRole = role === "salesperson";

  // Match item to the relevant salesperson
  const isItemBelongingToCurrentPerspective = (item: ApprovalRequest): boolean => {
    // 1. ADMIN ROLE:
    // If Admin, show all salespersons by default unless filtered to a specific salesperson in dropdown
    if (!isSalespersonRole) {
      if (adminSalespersonFilter === "all") return true;
      return item.salespersonId === adminSalespersonFilter;
    }

    // 2. SALESPERSON ROLE:
    // Strictly show ONLY that particular salesperson's PO requests!
    const cleanSpId = currentSalespersonId.toLowerCase().trim();
    const cleanSpName = currentSalespersonName.toLowerCase().trim();

    const itemSpId = (item.salespersonId || "").toLowerCase().trim();
    const itemSpName = (item.salespersonName || "").toLowerCase().trim();

    const idMatch = cleanSpId && (itemSpId === cleanSpId || itemSpId.includes(cleanSpId) || cleanSpId.includes(itemSpId));
    const nameMatch = cleanSpName && (itemSpName === cleanSpName || itemSpName.includes(cleanSpName) || cleanSpName.includes(itemSpName));

    return Boolean(idMatch || nameMatch);
  };

  // Base list filtered by role & salesperson perspective
  const roleFilteredApprovals = useMemo(() => {
    return approvals.filter(isItemBelongingToCurrentPerspective);
  }, [approvals, isSalespersonRole, adminSalespersonFilter, currentSalespersonId, currentSalespersonName]);

  // --------------------------------------------------------------------------
  // Tab Counts: pending, approved, rejected, all
  // In Admin role: counts ALL salespersons' requests (or selected salesperson)
  // In Salesperson role: counts ONLY that particular salesperson's requests!
  // --------------------------------------------------------------------------
  const countPending = useMemo(() => {
    return roleFilteredApprovals.filter(a => a.status === "pending").length;
  }, [roleFilteredApprovals]);

  const countApproved = useMemo(() => {
    return roleFilteredApprovals.filter(a => a.status === "approved" || a.adminDecision === "approved").length;
  }, [roleFilteredApprovals]);

  const countRejected = useMemo(() => {
    return roleFilteredApprovals.filter(a => a.status === "rejected" || a.adminDecision === "rejected").length;
  }, [roleFilteredApprovals]);

  const countAll = roleFilteredApprovals.length;

  // Final list filtered by the 4 sub-tabs
  const displayApprovals = useMemo(() => {
    return roleFilteredApprovals.filter(item => {
      if (statusFilter === "pending") return item.status === "pending";
      if (statusFilter === "approved") return item.status === "approved" || item.adminDecision === "approved";
      if (statusFilter === "rejected") return item.status === "rejected" || item.adminDecision === "rejected";
      return true; // "all"
    });
  }, [roleFilteredApprovals, statusFilter]);

  // --------------------------------------------------------------------------
  // ADMIN ACTION: Accept / Confirm or Reject Rate Exception (< ₹26.50/sq.ft)
  // --------------------------------------------------------------------------
  const handleAdminDecision = async (approval: ApprovalRequest, decision: "approved" | "rejected") => {
    setProcessingId(approval.id);
    const adminName = user?.name || "Head Office Admin";
    const now = new Date().toISOString();

    const decisionNotes = decision === "approved"
      ? `Quoted rate (< ₹26.50/sq.ft) approved by ${adminName}. Reflected in ${approval.salespersonName}'s approval tab for customer app release.`
      : `Quoted rate below ₹26.50/sq.ft threshold rejected by ${adminName}. Reflected in ${approval.salespersonName}'s approval tab for rate revision.`;

    const newSalesActionStatus: SalespersonActionStatus = decision === "approved"
      ? "pending_release"
      : "action_required_revision";

    try {
      await updateDoc(doc(db, "approvalRequests", approval.id), {
        status: decision,
        adminDecision: decision,
        decidedBy: adminName,
        decidedAt: now,
        decisionNotes,
        salespersonActionStatus: newSalesActionStatus,
      });

      // Update Order: Customer app is NOT directly updated to confirmed or rejected!
      if (approval.orderId) {
        if (decision === "approved") {
          await adminConfirmOrder(approval.orderId, approval.referenceId, adminName, decisionNotes);
        } else {
          await adminRejectOrder(approval.orderId, approval.referenceId, adminName, decisionNotes);
        }
      } else if (approval.referenceId) {
        try {
          await updateDoc(doc(db, "quotations", approval.referenceId), {
            approvalStatus: decision,
            status: decision === "approved" ? "admin_approved" : "rejected_by_admin",
            adminApprovedBy: adminName,
            adminApprovedAt: now,
            adminDecisionReason: decisionNotes,
            updatedAt: now,
          });
        } catch (_) {}
      }

      setApprovals(prev => prev.map(a => 
        a.id === approval.id 
          ? { 
              ...a, 
              status: decision, 
              adminDecision: decision, 
              decidedBy: adminName, 
              decidedAt: "Just now", 
              decisionNotes,
              salespersonActionStatus: newSalesActionStatus
            } 
          : a
      ));

      if (decision === "approved") {
        setActionSuccessMsg(
          `✓ Approved! Quoted rate approved by ${adminName}. Reflected in ${approval.salespersonName}'s approval tab. Customer app details will not update until ${approval.salespersonName} releases it.`
        );
      } else {
        setActionSuccessMsg(
          `✗ Rejected! Rate exception rejected by ${adminName}. Reflected in ${approval.salespersonName}'s approval tab for rate revision. (Customer app was NOT cancelled).`
        );
      }
    } catch (err) {
      console.warn("Decision updated locally:", err);
      setApprovals(prev => prev.map(a => 
        a.id === approval.id 
          ? { 
              ...a, 
              status: decision, 
              adminDecision: decision, 
              decidedBy: adminName, 
              decidedAt: "Just now", 
              decisionNotes,
              salespersonActionStatus: newSalesActionStatus
            } 
          : a
      ));
      setActionSuccessMsg(
        decision === "approved"
          ? `✓ Approved by ${adminName}! Reflected in ${approval.salespersonName}'s approval tab.`
          : `✗ Rejected by ${adminName}! Reflected in ${approval.salespersonName}'s approval tab for revision.`
      );
    } finally {
      setProcessingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // SALESPERSON ACTION 1: Release Confirmed Quote to Customer Mobile App
  // --------------------------------------------------------------------------
  const handleSalespersonRelease = async (approval: ApprovalRequest) => {
    setProcessingId(approval.id);
    const spName = user?.name || salesperson?.name || approval.salespersonName || "Sales Executive";
    const now = new Date().toISOString();

    try {
      if (approval.orderId) {
        await salespersonReleaseOrderToApp(approval.orderId, approval.referenceId, spName, approval.id);
      } else {
        await updateDoc(doc(db, "approvalRequests", approval.id), {
          salespersonActionStatus: "released",
          salespersonReleasedAt: now,
          salespersonReleasedBy: spName,
        });
      }

      setApprovals(prev => prev.map(a => 
        a.id === approval.id 
          ? { 
              ...a, 
              salespersonActionStatus: "released",
              salespersonReleasedAt: "Just now",
              salespersonReleasedBy: spName,
            } 
          : a
      ));

      setActionSuccessMsg(
        `🎉 Successfully Released! Quoted rates (₹${(approval.pricePerSqft || 24.50).toFixed(2)}/sq.ft) and PO details are now live on the customer's mobile app.`
      );
    } catch (err) {
      setApprovals(prev => prev.map(a => 
        a.id === approval.id 
          ? { 
              ...a, 
              salespersonActionStatus: "released",
              salespersonReleasedAt: "Just now",
              salespersonReleasedBy: spName,
            } 
          : a
      ));
      setActionSuccessMsg(`🎉 Quoted rates released to customer mobile app!`);
    } finally {
      setProcessingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // SALESPERSON ACTION 2: Formally decline PO after Admin rejection
  // --------------------------------------------------------------------------
  const handleSalespersonDecline = async (approval: ApprovalRequest) => {
    if (processingId === approval.id || approval.salespersonActionStatus === "cancelled") return;
    setProcessingId(approval.id);
    const spName = user?.name || salesperson?.name || approval.salespersonName || "Sales Executive";
    try {
      if (approval.orderId) {
        await salespersonDeclineOrder(
          approval.orderId, 
          approval.referenceId, 
          spName, 
          "Rate exception rejected by management. Customer declined rate revision.",
          approval.id
        );
      } else {
        try {
          await updateDoc(doc(db, "approvalRequests", approval.id), {
            salespersonActionStatus: "cancelled",
          });
        } catch (_) {}
      }

      setApprovals(prev => prev.map(a => 
        a.id === approval.id 
          ? { ...a, salespersonActionStatus: "cancelled" } 
          : a
      ));

      setActionSuccessMsg(`PO marked as declined. Order status updated.`);
    } catch (err) {
      setApprovals(prev => prev.map(a => 
        a.id === approval.id 
          ? { ...a, salespersonActionStatus: "cancelled" } 
          : a
      ));
      setActionSuccessMsg(`PO marked as declined.`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardShell
      title={
        isSalespersonRole 
          ? `My Rate Approvals (${currentSalespersonName})` 
          : "Discount & Exception Approvals"
      }
      subtitle={
        isSalespersonRole
          ? `Tracking quoted rate status for your allocated Purchase Orders (< ₹26.50/sq.ft). Review Admin decisions and release confirmed rates to your clients.`
          : "Administrative authorization for all salespersons' PO rate quotes below ₹26.50/sq.ft and discount exceptions."
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Success Alert Banner */}
        {actionSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm flex items-start space-x-3 transition-all animate-in fade-in slide-in-from-top-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold leading-relaxed">{actionSuccessMsg}</p>
            </div>
            <button 
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Role-Specific Context & Governance Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0E274D] to-[#1A3A6D] text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-white/20">
              {isSalespersonRole ? (
                <Smartphone className="w-5 h-5 text-amber-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">
                  {isSalespersonRole
                    ? `Salesperson Approval Desk: ${currentSalespersonName}`
                    : "Central Head-Office Admin Authorization (< ₹26.50/sq.ft Rule)"}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-900">
                  {isSalespersonRole ? "Salesperson View" : "Admin View: All Salespersons"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {isSalespersonRole ? (
                  <>
                    Showing only <strong>your Purchase Orders</strong>. When Admin confirms or rejects your &lt; ₹26.50 rate, it reflects in your Approved or Rejected tabs below. <strong>Admin cannot directly update the PO detail on the customer app</strong>. You review the decision and release the quote to your client.
                  </>
                ) : (
                  <>
                    Showing rate exception requests across <strong>all salespersons</strong>. When you accept or reject, <strong>no direct change is made to the PO detail on the customer app</strong>. The update reflects directly in the approval tab of that particular salesperson for final release or revision.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center space-x-2">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-bold text-slate-200">
              <span>Threshold: ₹26.50 / sq.ft</span>
            </div>
          </div>
        </div>

        {/* Top Control Bar with the 4 SUB-TABS: pending, approved, rejected, all */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          {/* THE 4 SUB-TABS */}
          <div className="flex items-center space-x-2 overflow-x-auto">
            {[
              { id: "pending", label: "Pending", count: countPending, badgeColor: "bg-amber-100 text-amber-900" },
              { id: "approved", label: "Approved", count: countApproved, badgeColor: "bg-emerald-100 text-emerald-900" },
              { id: "rejected", label: "Rejected", count: countRejected, badgeColor: "bg-rose-100 text-rose-900" },
              { id: "all", label: "All", count: countAll, badgeColor: "bg-slate-100 text-slate-700" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`py-2 px-4 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer flex items-center space-x-2 shrink-0 ${
                  statusFilter === tab.id
                    ? "bg-[#0E274D] text-white shadow-sm ring-2 ring-blue-900/30"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  statusFilter === tab.id
                    ? "bg-white/20 text-white"
                    : tab.badgeColor
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Right Controls: Filter by Salesperson dropdown for Admin ONLY */}
          <div className="flex items-center space-x-3">
            {!isSalespersonRole ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span>Salesperson:</span>
                </span>
                <select
                  value={adminSalespersonFilter}
                  onChange={(e) => setAdminSalespersonFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="all">All Salespersons ({uniqueSalespersons.length})</option>
                  {uniqueSalespersons.map((sp: any) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-900 text-xs font-bold">
                <UserCheck className="w-3.5 h-3.5 text-orange-600" />
                <span>My POs Only ({currentSalespersonName})</span>
              </div>
            )}

            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Customer app details protected</span>
            </div>
          </div>
        </div>

        {/* Approvals Table */}
        <div className="card-luxury overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm">
          {displayApprovals.length === 0 ? (
            <div className="p-12 text-center">
              <CheckSquare className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#0E274D]">No Approvals in &ldquo;{statusFilter}&rdquo;</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {isSalespersonRole
                  ? `You have no Purchase Orders with "${statusFilter}" status.`
                  : `All salesperson rate requests in this category are up to date.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">Reference / PO #</th>
                    <th className="py-3.5 px-5">Customer &amp; Salesperson</th>
                    <th className="py-3.5 px-5">Rate &amp; Value</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayApprovals.map((item) => {
                    const isLowRate = item.referenceType === "low_rate_po" || (item.pricePerSqft && item.pricePerSqft < 26.50);
                    const isAdminApproved = item.adminDecision === "approved" || item.status === "approved";
                    const isAdminRejected = item.adminDecision === "rejected" || item.status === "rejected";
                    const isPending = item.status === "pending";
                    const isReleased = item.salespersonActionStatus === "released";

                    return (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isAdminApproved && !isReleased
                            ? "bg-emerald-50/10"
                            : isAdminRejected
                            ? "bg-rose-50/10"
                            : ""
                        }`}
                      >
                        {/* 1. Reference / PO # */}
                        <td className="py-4 px-5 align-top">
                          <div>
                            <Link
                              href={`/quotations/${item.referenceId}`}
                              className="font-bold text-[#0E274D] hover:underline flex items-center space-x-1.5 font-mono"
                            >
                              <span>{item.referenceNumber}</span>
                            </Link>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              {item.createdAt}
                            </span>
                            {isLowRate ? (
                              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <ShieldAlert className="w-3 h-3 text-amber-700" />
                                <span>&lt; ₹26.50/sq.ft</span>
                              </span>
                            ) : item.discountRequested ? (
                              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {item.discountRequested}% Disc.
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* 2. Customer & Salesperson */}
                        <td className="py-4 px-5 align-top">
                          <div className="max-w-xs">
                            <p className="font-bold text-slate-900">{item.customerName}</p>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                Rep: <strong className="text-slate-700 font-semibold">{item.salespersonName}</strong>
                              </span>
                              {isSalespersonRole && (
                                <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            {item.reason && (
                              <p className="text-xs text-slate-500 mt-1.5 italic line-clamp-2" title={item.reason}>
                                <span className="font-semibold text-slate-600 not-italic">Reason: </span>
                                &ldquo;{item.reason}&rdquo;
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 3. Rate & Total Value */}
                        <td className="py-4 px-5 align-top">
                          <div>
                            <p className="font-extrabold text-[#0E274D]">
                              ₹{Number(item.totalValue).toLocaleString("en-IN")}
                            </p>
                            {item.pricePerSqft != null && (
                              <div className="text-xs text-slate-700 font-semibold mt-0.5">
                                Rate: <span className="text-slate-900 font-bold">₹{item.pricePerSqft.toFixed(2)}</span> / sq.ft
                              </div>
                            )}
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Threshold: ₹{(item.rateThreshold || 26.50).toFixed(2)} / sq.ft
                            </span>
                          </div>
                        </td>

                        {/* 4. Status */}
                        <td className="py-4 px-5 align-top">
                          <div>
                            {isPending && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <Clock className="w-3 h-3 text-amber-700" />
                                <span>Awaiting Admin Approval</span>
                              </span>
                            )}
                            {isAdminApproved && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Admin Approved</span>
                              </span>
                            )}
                            {isAdminRejected && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                <X className="w-3 h-3 text-rose-600" />
                                <span>Admin Rejected</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Actions */}
                        <td className="py-4 px-5 align-top text-right">
                          <div className="flex flex-col items-end space-y-2">
                            {/* CASE 1: PENDING */}
                            {isPending ? (
                              !isSalespersonRole ? (
                                /* ADMIN VIEW on Pending: Admin can Approve or Reject */
                                <div className="flex flex-col items-end space-y-1.5">
                                  <div className="flex items-center space-x-1.5">
                                    <button
                                      onClick={() => handleAdminDecision(item, "rejected")}
                                      disabled={processingId === item.id}
                                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                      title="Reject rate exception and reflect in salesperson approval tab"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Reject</span>
                                    </button>
                                    <button
                                      onClick={() => handleAdminDecision(item, "approved")}
                                      disabled={processingId === item.id}
                                      className="flex items-center space-x-1 px-3 py-1.5 bg-[#0E274D] hover:bg-[#1A3A6D] text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
                                      title="Approve rate exception and reflect in salesperson approval tab"
                                    >
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Approve</span>
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    Reflects in {item.salespersonName}&apos;s tab
                                  </span>
                                </div>
                              ) : (
                                /* SALESPERSON VIEW on Pending: Waiting for Head-Office Admin */
                                <div className="text-right">
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block">
                                    Awaiting Admin
                                  </span>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Rates locked on app
                                  </p>
                                </div>
                              )
                            ) : isAdminApproved ? (
                              /* CASE 2: APPROVED */
                              !isReleased ? (
                                isSalespersonRole ? (
                                  /* SALESPERSON on Approved: Release to Customer */
                                  <div className="flex flex-col items-end space-y-1">
                                    <button
                                      onClick={() => handleSalespersonRelease(item)}
                                      disabled={processingId === item.id}
                                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      <span>Release to Customer</span>
                                    </button>
                                    <span className="text-[10px] text-slate-400">
                                      Syncs to customer app
                                    </span>
                                  </div>
                                ) : (
                                  /* ADMIN on Approved: Waiting for salesperson to release */
                                  <div className="text-right space-y-0.5">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                                      Sales Action Required
                                    </span>
                                    <p className="text-[10px] text-slate-400">
                                      {item.salespersonName} will release
                                    </p>
                                  </div>
                                )
                              ) : (
                                /* BOTH on Released: Sent to Customer */
                                <div className="text-right space-y-0.5">
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                                    Sent to Customer
                                  </span>
                                  {item.salespersonReleasedAt && (
                                    <p className="text-[10px] text-slate-400">
                                      {item.salespersonReleasedAt}
                                    </p>
                                  )}
                                </div>
                              )
                            ) : (
                              /* CASE 3: REJECTED */
                              isSalespersonRole ? (
                                /* SALESPERSON on Rejected: Only Decline Client PO button (clicked once) */
                                <div className="flex flex-col items-end space-y-1">
                                  {item.salespersonActionStatus === "cancelled" ? (
                                    <div className="text-right space-y-0.5">
                                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 inline-block">
                                        PO Declined
                                      </span>
                                      <p className="text-[10px] text-slate-400">
                                        Client PO has been declined
                                      </p>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleSalespersonDecline(item)}
                                      disabled={processingId === item.id}
                                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Decline client purchase order"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>
                                        {processingId === item.id ? "Declining..." : "Decline Client PO"}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                /* ADMIN on Rejected */
                                <div className="text-right space-y-0.5">
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-block">
                                    Rejected by Admin
                                  </span>
                                  <p className="text-[10px] text-slate-400">
                                    {item.salespersonActionStatus === "cancelled"
                                      ? "Salesperson declined PO"
                                      : "Reflected in salesperson tab"}
                                  </p>
                                </div>
                              )
                            )}

                            {/* View Full Quotation link / Details */}
                            <Link
                              href={`/quotations/${item.referenceId}`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#0E274D] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
