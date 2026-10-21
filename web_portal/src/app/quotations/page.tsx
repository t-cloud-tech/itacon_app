"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Quotation, SalesOrder } from "@/types";
import { 
  subscribeClientPORequests, 
  subscribeAllOrders, 
  ClientOrderPO, 
  EnrichedSalesPerson, 
  DEFAULT_SALESPERSONS, 
  SAMPLE_CLIENT_ORDERS, 
  fetchSalesPersonsMap,
  getPOStatusLabel,
  getPOStatusBadgeClass
} from "@/lib/order-service";
import { 
  FileSpreadsheet, 
  PlusCircle, 
  Search, 
  Smartphone, 
  Clock, 
  Eye, 
  Layers, 
  ShoppingBag, 
  Inbox, 
  ShieldAlert,
  Check,
  X
} from "lucide-react";

export type OrderStatusKey = "pending_rate" | "rate_quoted" | "confirmed" | "rejected";

import { BASELINE_QUOTATIONS } from "@/lib/baseline-quotations";

function QuotationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, role, salesperson } = useAuth();

  const paramTab = searchParams.get("tab");
  const paramStatus = searchParams.get("status") as OrderStatusKey | null;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [poRequests, setPoRequests] = useState<ClientOrderPO[]>([]);
  const [allOrders, setAllOrders] = useState<ClientOrderPO[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "pending_po">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [salesPersonsMap, setSalesPersonsMap] = useState<Record<string, EnrichedSalesPerson>>(DEFAULT_SALESPERSONS);

  // Sync tab and status if search parameters change
  useEffect(() => {
    if (paramTab === "pending_po") {
      setActiveTab("pending_po");
    } else {
      setActiveTab("all");
    }

    if (paramTab === "status_orders" || paramTab === "all") {
      if (paramStatus === "pending_rate") setStatusFilter("pending_approval");
      else if (paramStatus === "rate_quoted") setStatusFilter("sent_to_customer");
      else if (paramStatus === "confirmed") setStatusFilter("accepted");
      else if (paramStatus === "rejected") setStatusFilter("rejected");
    }
  }, [paramTab, paramStatus]);

  // Load salespersons directory
  useEffect(() => {
    let isMounted = true;
    fetchSalesPersonsMap().then((map) => {
      if (isMounted && Object.keys(map).length > 0) {
        setSalesPersonsMap(map);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // 1. Real-time live quotations listener
    const quotesRef = collection(db, "quotations");
    let q = query(quotesRef, orderBy("createdAt", "desc"));

    // If salesperson, only fetch quotations created by this salesperson
    if (role === "salesperson" && user?.userId) {
      q = query(quotesRef, where("salespersonId", "==", user.userId));
    }

    const unsubQuotes = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Quotation));
        setQuotations(list);
      },
      (err) => {
        console.warn("Real-time quotations listener warning:", err);
      }
    );

    // 2. Real-time live client PO listener
    const unsubPOs = subscribeClientPORequests(user, salesperson, role, (livePOs) => {
      setPoRequests(livePOs);
    });

    // 3. Real-time live all orders listener
    const unsubAllOrders = subscribeAllOrders(user, salesperson, role, (liveOrders) => {
      setAllOrders(liveOrders);
    });

    // 4. Real-time live sales orders listener
    const unsubSalesOrders = onSnapshot(
      collection(db, "salesOrders"),
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SalesOrder));
        setSalesOrders(list);
      },
      (err) => {
        console.warn("Real-time sales orders warning in quotations:", err);
      }
    );

    return () => {
      unsubQuotes();
      unsubPOs();
      unsubAllOrders();
      unsubSalesOrders();
    };
  }, [user, salesperson, role]);

  // Merge all orders with baseline sample orders (ONLY for admin when database is empty)
  const allMergedOrders = useMemo(() => {
    const list: ClientOrderPO[] = [...(allOrders || [])];
    if (role === "admin" && list.length === 0) {
      SAMPLE_CLIENT_ORDERS.forEach((sample) => {
        if (!list.some((o) => o.id === sample.id || (o.poNumber && o.poNumber === sample.poNumber))) {
          list.push(sample);
        }
      });
    }
    return list;
  }, [allOrders, role]);

  // Merge live quotations with baseline quotations (ONLY for admin fallback preview)
  const mergedQuotations = useMemo(() => {
    // 1. Process base quotations and check if linked sales order or mobile order is paid
    const list: Quotation[] = quotations.map((q) => {
      const matchingSO = salesOrders.find(
        (so) =>
          (q.id && (so.quotationId === q.id || so.id === q.id || so.orderId === q.id)) ||
          (q.orderId && (so.orderId === q.orderId || so.id === q.orderId)) ||
          (q.quotationNumber && (so.quotationNumber === q.quotationNumber || so.orderNumber === q.quotationNumber.replace(/^QT-/, "ORD-"))) ||
          (q.poNumber && (so.poNumber === q.poNumber || so.orderNumber === q.poNumber.replace(/^ITC-PO-/, "ORD-")))
      );

      const matchingOrder = allMergedOrders.find(
        (o) =>
          (q.orderId && o.id === q.orderId) ||
          (q.id && o.quotationId === q.id) ||
          (q.quotationNumber && (o.quotationNumber === q.quotationNumber || o.poNumber === q.quotationNumber.replace(/^QT-/, "ITC-PO-"))) ||
          (q.poNumber && o.poNumber === q.poNumber)
      );

      const isPaid =
        (q as any).paymentStatus === "paid" ||
        q.status === ("confirm_order" as any) ||
        (q.status as string) === "paid" ||
        matchingSO?.paymentStatus === "paid" ||
        (matchingSO?.status as string) === "paid" ||
        (matchingOrder?.paymentStatus || "").toLowerCase() === "paid" ||
        ((matchingOrder?.status as string) || "").toLowerCase() === "paid";

      if (isPaid) {
        return {
          ...q,
          status: "confirm_order" as any,
          paymentStatus: "paid",
        };
      }

      return q;
    });

    if (role === "admin" && list.length === 0) {
      BASELINE_QUOTATIONS.forEach((sample) => {
        if (!list.some((q) => q.id === sample.id || (q.quotationNumber && q.quotationNumber === sample.quotationNumber))) {
          list.push(sample);
        }
      });
    }

    // In admin role: ensure all orders where rates were quoted/confirmed/rejected across salespersons appear
    allMergedOrders.forEach((o) => {
      const s = (o.status || "").toLowerCase();
      const isOrderPaid = s === "paid" || (o.paymentStatus || "").toLowerCase() === "paid";
      const matchingSO = salesOrders.find(
        (so) =>
          (so.orderId && so.orderId === o.id) ||
          (so.poNumber && o.poNumber && so.poNumber === o.poNumber) ||
          (so.quotationNumber && o.quotationNumber && so.quotationNumber === o.quotationNumber)
      );
      const isPaid = isOrderPaid || matchingSO?.paymentStatus === "paid" || (matchingSO?.status as string) === "paid";

      if (s === "rate_quoted" || s === "confirmed" || s === "approved" || s === "rejected" || s === "pending_admin_approval" || s === "pending_salesperson_review" || s === "paid" || isPaid) {
        const quoteNum = o.quotationNumber || `QT-${o.poNumber ? o.poNumber.replace(/^ITC-PO-/, "") : o.id.slice(-4)}`;
        const existingIdx = list.findIndex((q) => q.orderId === o.id || (o.quotationId && q.id === o.quotationId) || (quoteNum && q.quotationNumber === quoteNum) || (o.poNumber && q.poNumber === o.poNumber));

        if (existingIdx >= 0) {
          if (isPaid) {
            list[existingIdx] = {
              ...list[existingIdx],
              status: "confirm_order" as any,
              paymentStatus: "paid",
              changedByRole: "customer",
            };
          } else if (s === "confirmed") {
            list[existingIdx] = {
              ...list[existingIdx],
              status: "accepted",
              changedByRole: "customer",
            };
          } else if (s === "rejected") {
            list[existingIdx] = {
              ...list[existingIdx],
              status: "rejected",
              changedByRole: o.changedByRole || "customer",
              rejectedBy: o.rejectedBy || "Customer",
              rejectionReason: o.rejectionReason,
            };
          }
        } else {
          const sp = salesPersonsMap[o.salesPersonId] || DEFAULT_SALESPERSONS[o.salesPersonId];
          const spName = sp?.name || (o.salesPersonId ? `Salesperson (${o.salesPersonId})` : "Central Sales Desk");
          const totalVal = o.items?.reduce((sum, it) => {
            const sqftPerBox = it.sqftPerBox || 15.5;
            const ratePerSqft = (it.basePrice && it.basePrice > 150) ? (it.basePrice / sqftPerBox) : (it.basePrice || 35);
            const boxPrice = ratePerSqft * sqftPerBox;
            return sum + (it.lineTotal || (boxPrice * (it.quantityBoxes || 1)));
          }, 0) || 50000;

          let quoteStatus: any = "pending_approval";
          if (isPaid) quoteStatus = "confirm_order";
          else if (s === "confirmed") quoteStatus = "accepted";
          else if (s === "approved") quoteStatus = "approved";
          else if (s === "rate_quoted") quoteStatus = "sent_to_customer";
          else if (s === "rejected") quoteStatus = "rejected";
          else if (s === "pending_admin_approval") quoteStatus = "pending_approval";
          else if (s === "pending_salesperson_review") {
            quoteStatus = o.adminApprovalStatus === "rejected" ? "pending_salesperson_review" : "approved";
          }

          list.push({
            id: o.quotationId || `qt-order-${o.id}`,
            quotationNumber: quoteNum,
            orderId: o.id,
            poNumber: o.poNumber || o.orderReference,
            customerId: o.userId,
            customerName: o.companyName || o.customerName,
            customerPhone: o.customerPhone,
            salespersonId: o.salesPersonId || "sp-1",
            salespersonName: spName,
            status: quoteStatus,
            paymentStatus: isPaid ? "paid" : (o.paymentStatus || undefined),
            approvalStatus: (o.adminApprovalStatus as any) || (quoteStatus === "approved" ? "approved" : "pending"),
            adminApprovalStatus: o.adminApprovalStatus,
            salespersonApprovalStatus: o.salespersonApprovalStatus,
            changedByRole: o.changedByRole,
            rejectedBy: o.rejectedBy,
            rejectionReason: o.rejectionReason,
            items: (o.items || []).map((it) => {
              const sqftPerBox = it.sqftPerBox || 15.5;
              const ratePerSqft = (it.basePrice && it.basePrice > 150) ? (it.basePrice / sqftPerBox) : (it.basePrice || 35);
              const disc = it.discountPercent || 0;
              const effRateSqft = Number((ratePerSqft * (1 - disc / 100)).toFixed(2));
              const effBoxPrice = Number((effRateSqft * sqftPerBox).toFixed(2));
              const lineTotal = it.lineTotal || Number(((it.quantityBoxes || 1) * effBoxPrice).toFixed(2));

              return {
                productId: it.productId,
                productName: it.productName,
                sku: it.sku,
                size: it.size,
                quantityBoxes: it.quantityBoxes,
                sqftPerBox: sqftPerBox,
                totalSqft: it.quantitySqFt || Number(((it.quantityBoxes || 1) * sqftPerBox).toFixed(2)),
                weightKg: (it.weightPerBoxKg || 29.0) * it.quantityBoxes,
                unitPrice: ratePerSqft,
                discountPercent: disc,
                effectivePrice: effBoxPrice,
                lineTotal: lineTotal,
              };
            }),
            subtotal: totalVal,
            discountTotal: 0,
            taxPercent: 18,
            taxAmount: Math.round(totalVal * 0.18),
            shippingCharge: 4000,
            grandTotal: Math.round(totalVal * 1.18 + 4000),
            totalBoxes: o.totalBoxes,
            totalWeightTons: o.totalWeightTons || 2.5,
            paymentTerms: "30 Days Net",
            validityDays: 15,
            expiryDate: "2026-10-20",
            pricePerSqft: o.pricePerSqft,
            rateThreshold: 26.5,
            requiresSpecialApproval: s === "pending_admin_approval" || Boolean(o.adminApprovalRequired) || (o.pricePerSqft !== undefined && o.pricePerSqft < 26.5),
            createdAt: o.createdAt || new Date().toISOString(),
            updatedAt: o.createdAt || new Date().toISOString(),
          });
        }
      }
    });

    return list;
  }, [quotations, allMergedOrders, salesOrders, salesPersonsMap]);

  // Filtered quotations for the Generated Quotations table
  const filteredQuotations = useMemo(() => {
    return mergedQuotations.filter((q) => {
      // In salesperson role: strictly only show quotations belonging to this salesperson
      if (role === "salesperson") {
        const myIds = new Set<string>();
        if (user?.userId) myIds.add(user.userId.trim());
        if (user?.salesPersonId) myIds.add(user.salesPersonId.trim());
        if (salesperson?.salesPersonId) myIds.add(salesperson.salesPersonId.trim());
        if (salesperson?.employeeId) myIds.add(salesperson.employeeId.trim());

        const qSpId = (q.salespersonId || (q as any).salesPersonId || "").trim();
        const qSpName = (q.salespersonName || "").trim().toLowerCase();
        const myName = (salesperson?.name || user?.name || "").trim().toLowerCase();

        const isMatch =
          myIds.has(qSpId) ||
          (myName && qSpName && (qSpName === myName || (myName.length >= 4 && qSpName.includes(myName))));
        if (!isMatch) return false;
      }
      // In admin role: SHOW ALL generated quotations across all salespersons and admin!

      const matchesSearch =
        (q.quotationNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.salespersonName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.poNumber || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending_approval" && (q.status === "pending_approval" || q.status === "pending_admin_approval") && (q as any).adminApprovalStatus !== "approved" && (q as any).approvalStatus !== "approved" && (q as any).adminApprovalStatus !== "rejected" && (q as any).approvalStatus !== "rejected") ||
        (statusFilter === "approved" && ((q.status === "approved" && ((q.pricePerSqft !== undefined && q.pricePerSqft < 26.50) || q.requiresSpecialApproval)) || (q as any).adminApprovalStatus === "approved" || (q as any).approvalStatus === "approved" || q.status === "pending_salesperson_review")) ||
        (statusFilter === "admin_rejected" && ((q as any).adminApprovalStatus === "rejected" || (q as any).approvalStatus === "rejected" || (q.status === "pending_salesperson_review" && (q as any).adminApprovalStatus === "rejected"))) ||
        (statusFilter === "sent_to_customer" && (q.status === "sent_to_customer" || q.status === "rate_quoted")) ||
        (statusFilter === "confirm_order" && (q.status === "confirm_order" || q.status === ("confirm order" as any) || q.status === "accepted" || (q as any).paymentStatus === "paid")) ||
        (statusFilter === "accepted" && (q.status === "accepted" || q.status === "confirm_order" || (q as any).paymentStatus === "paid")) ||
        (statusFilter === "rejected_customer" && q.status === "rejected" && (q as any).changedByRole === "customer") ||
        (statusFilter === "rejected_salesperson" && (q.status === "declined" || (q as any).salespersonApprovalStatus === "cancelled" || ((q as any).changedByRole === "salesperson" && (q as any).approvalStatus !== "rejected" && (q as any).adminApprovalStatus !== "rejected"))) ||
        (statusFilter === "rejected" && (q.status === "declined" || q.status === "rejected")) ||
        q.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [mergedQuotations, searchTerm, statusFilter, role, user, salesperson]);

  const filteredPOs = poRequests.filter((po) => {
    return (
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleTabChange = (tab: "all" | "pending_po") => {
    setActiveTab(tab);
    router.push(`/quotations?tab=${tab}`);
  };

  return (
    <DashboardShell
      title="Quotations & Client PO Requests"
      subtitle={
        role === "admin"
          ? "Manage price quotations, client purchase orders, and all salespersons' quotations"
          : `Manage quotations and rate quotes for your allocated clients (${salesperson?.referralCode || "SALES101"})`
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Prominent Client PO Alert Banner if pending orders exist */}
        {poRequests.length > 0 && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0E274D] to-[#1A3A6D] text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShoppingBag className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white">
                    {poRequests.length} Client PO Request{poRequests.length > 1 ? "s" : ""} Awaiting Rate Quotation
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-500 text-white">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Your clients have placed orders through the ITACON mobile app. Click below to quote rates and discounts. Line items and box quantities are automatically locked from their order.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={() => handleTabChange("pending_po")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "pending_po"
                    ? "bg-white text-[#0E274D] shadow-sm"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                }`}
              >
                View PO Requests ({poRequests.length})
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 sm:pb-0 sm:border-none overflow-x-auto">
            {/* Tab 1: Generated Quotations (Shows all quotations in admin role) */}
            <button
              onClick={() => handleTabChange("all")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "all"
                  ? "bg-[#0E274D] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Generated Quotations ({filteredQuotations.length})
            </button>

            {/* Tab 2: Incoming Client POs */}
            <button
              onClick={() => handleTabChange("pending_po")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === "pending_po"
                  ? "bg-[#E66A23] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Incoming Client POs</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "pending_po" ? "bg-white text-[#E66A23]" : "bg-orange-100 text-orange-700"
                }`}
              >
                {poRequests.length}
              </span>
            </button>

            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time App Sync</span>
            </div>
          </div>

          {/* Top Right Quick Actions: Search, Filter, Create Quote */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="relative w-56 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={activeTab === "pending_po" ? "Search by PO# or client..." : "Search quotation or client..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>

            {activeTab === "all" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              >
                <option value="all">All Statuses</option>
                <option value="confirm_order">Confirm Order (Paid)</option>
                <option value="pending_approval">Awaiting Admin Approval</option>
                <option value="approved">Admin Approved - Sales Action Required</option>
                <option value="admin_rejected">Admin Rejected - Sales Action Required</option>
                <option value="sent_to_customer">Sent to Customer</option>
                <option value="accepted">Converted to Order</option>
                <option value="rejected_customer">Rejected by Customer</option>
                <option value="rejected_salesperson">Rejected by Salesperson</option>
                <option value="rejected">Rejected</option>
              </select>
            )}

            <Link
              href="/quotations/new"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Quote</span>
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: INCOMING CLIENT PO REQUESTS                                       */}
        {/* ========================================================================= */}
        {activeTab === "pending_po" && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl text-xs text-orange-900 leading-relaxed flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-[#E66A23] shrink-0" />
                <span>
                  <strong>Client App Sync:</strong> Below are orders submitted by your clients asking for price &amp; discount quotations. Clicking <strong>&quot;Quote Rates &amp; Discount&quot;</strong> pre-fills and locks the client&apos;s order items so you only set the price and discount.
                </span>
              </div>
            </div>

            {filteredPOs.length === 0 ? (
              <div className="card-luxury p-12 text-center bg-white rounded-xl border border-slate-200">
                <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Pending Client PO Requests</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When clients place an order via the ITACON mobile app asking for rate quotations, they will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredPOs.map((po) => (
                  <div
                    key={po.id}
                    className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-[#E66A23]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-[#0E274D] bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                          {po.poNumber}
                        </span>
                        {po.status === "pending_admin_approval" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                            <span>Awaiting Admin Approval (&lt; ₹26.50/sq.ft)</span>
                          </span>
                        ) : po.status === "pending_salesperson_review" || (po.adminApprovalStatus === "approved" && po.salespersonApprovalStatus !== "released") ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center space-x-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Admin Approved - Sales Action Required</span>
                          </span>
                        ) : po.adminApprovalStatus === "rejected" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 flex items-center space-x-1">
                            <X className="w-3.5 h-3.5 text-rose-600" />
                            <span>Admin Rejected - Sales Action Required</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Awaiting Quote</span>
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          Submitted: {new Date(po.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                        <div className="font-semibold text-slate-900">
                          Client: <span className="text-[#0E274D] font-bold">{po.companyName || po.customerName}</span>
                          {po.customerPhone && <span className="text-slate-500 ml-1.5 font-normal">({po.customerPhone})</span>}
                        </div>
                        <div className="text-slate-600 flex items-center space-x-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{po.totalBoxes} Boxes ({po.totalWeightTons} Tons)</span>
                        </div>
                      </div>

                      {/* Items requested pill list */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Requested Items from Mobile App:</div>
                        <div className="space-y-1">
                          {po.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-slate-800">
                              <div className="flex items-center space-x-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E66A23]" />
                                <span className="font-medium text-slate-900">{it.productName}</span>
                                <span className="text-slate-400 font-mono text-[11px]">{it.size}</span>
                              </div>
                              <div className="font-bold text-[#0E274D] bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                {it.quantityBoxes} Boxes • {it.quantitySqFt} sqft
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {po.remarks && (
                        <p className="text-xs text-slate-500 italic">
                          &ldquo;{po.remarks}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-end justify-center gap-2.5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                      {po.status === "pending_admin_approval" ? (
                        <Link
                          href="/approvals"
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          <span>Awaiting Admin Approval (&lt; ₹26.50) &rarr;</span>
                        </Link>
                      ) : po.status === "pending_salesperson_review" || (po.adminApprovalStatus === "approved" && po.salespersonApprovalStatus !== "released") ? (
                        <Link
                          href="/approvals"
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span>Admin Approved - Sales Action Required &rarr;</span>
                        </Link>
                      ) : po.adminApprovalStatus === "rejected" ? (
                        <Link
                          href={`/quotations/new?orderId=${po.id}&poNumber=${po.poNumber}&customerId=${po.userId}&name=${encodeURIComponent(po.companyName || po.customerName)}&revise=true`}
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Admin Rejected - Sales Action Required &rarr;</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/quotations/new?orderId=${po.id}&poNumber=${po.poNumber}&customerId=${po.userId}&name=${encodeURIComponent(po.companyName || po.customerName)}`}
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Quote Rates &amp; Discount &rarr;</span>
                        </Link>
                      )}
                      <span className="text-[11px] text-slate-400 text-center">
                        {po.status === "pending_admin_approval" 
                          ? "Awaiting Admin Approval" 
                          : po.adminApprovalStatus === "approved"
                          ? "Admin Approved - Sales Action Required"
                          : po.adminApprovalStatus === "rejected"
                          ? "Admin Rejected - Sales Action Required"
                          : "Quantities lock from client PO"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: GENERATED QUOTATIONS TABLE (ORIGINAL TABLE VIEW)                  */}
        {/* Shows ALL generated quotations across all salespersons and admin in Admin role */}
        {/* ========================================================================= */}
        {activeTab === "all" && (
          <div className="card-luxury overflow-hidden bg-white rounded-xl border border-slate-200">
            {filteredQuotations.length === 0 ? (
              <div className="p-12 text-center">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Quotations Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your filters or search terms."
                    : "Create a new quotation or quote rates for incoming client PO requests above."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-5">Quotation #</th>
                      <th className="py-3.5 px-5">Customer &amp; Salesperson</th>
                      <th className="py-3.5 px-5">Order Size</th>
                      <th className="py-3.5 px-5">Grand Total</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuotations.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-5">
                          <div>
                            <Link href={`/quotations/${q.id}`} className="font-bold text-[#0E274D] hover:underline flex items-center space-x-1.5">
                              <span>{q.quotationNumber}</span>
                            </Link>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              {new Date(q.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div>
                            <p className="font-bold text-slate-900">{q.customerName}</p>
                            <span className="text-xs text-slate-500">Rep: {q.salespersonName}</span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">{q.totalBoxes} Boxes</span>
                            <span className="text-slate-400 block">{q.totalWeightTons} Tons</span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div>
                            <p className="font-extrabold text-[#0E274D]">
                              ₹{Number(q.grandTotal).toLocaleString("en-IN")}
                            </p>
                            <span className="text-[11px] text-slate-400">{q.paymentTerms}</span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPOStatusBadgeClass(
                              q.status,
                              {
                                adminApprovalStatus: (q as any).adminApprovalStatus || q.approvalStatus,
                                approvalStatus: q.approvalStatus,
                                salespersonApprovalStatus: (q as any).salespersonApprovalStatus,
                                changedByRole: (q as any).changedByRole,
                                rejectedBy: (q as any).rejectedBy,
                                pricePerSqft: q.pricePerSqft,
                                rateThreshold: q.rateThreshold,
                                requiresSpecialApproval: q.requiresSpecialApproval,
                                paymentStatus: (q as any).paymentStatus,
                                isPaid: (q as any).paymentStatus === "paid" || q.status === ("confirm_order" as any),
                              }
                            )}`}
                          >
                            <span>
                              {getPOStatusLabel(q.status, {
                                adminApprovalStatus: (q as any).adminApprovalStatus || q.approvalStatus,
                                approvalStatus: q.approvalStatus,
                                salespersonApprovalStatus: (q as any).salespersonApprovalStatus,
                                changedByRole: (q as any).changedByRole,
                                rejectedBy: (q as any).rejectedBy,
                                pricePerSqft: q.pricePerSqft,
                                rateThreshold: q.rateThreshold,
                                requiresSpecialApproval: q.requiresSpecialApproval,
                                paymentStatus: (q as any).paymentStatus,
                                isPaid: (q as any).paymentStatus === "paid" || q.status === ("confirm_order" as any),
                              })}
                            </span>
                          </span>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <Link
                            href={`/quotations/${q.id}`}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#0E274D] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading quotations &amp; client PO requests...</div>}>
      <QuotationsContent />
    </Suspense>
  );
}
