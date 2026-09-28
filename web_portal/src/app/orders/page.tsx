"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db, storage, functions } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { SalesOrder, OrderStatus, PaymentSubmissionRecord } from "@/types";
import { subscribeAllOrders, ClientOrderPO } from "@/lib/order-service";
import { 
  Truck, 
  Search, 
  CheckCircle2, 
  Clock, 
  CreditCard,
  Building2,
  Eye,
  XCircle,
  FileText,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  Smartphone,
  Layers,
  ShoppingBag,
  ArrowRight
} from "lucide-react";

export default function SalesOrdersPage() {
  const { user, role, salesperson } = useAuth();
  const [activeTab, setActiveTab] = useState<"client_pos" | "sales_orders" | "payments">("client_pos");

  // Orders State
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [clientPOs, setClientPOs] = useState<ClientOrderPO[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingPOs, setIsLoadingPOs] = useState(true);

  // Payment Verification State
  const [paymentSubmissions, setPaymentSubmissions] = useState<PaymentSubmissionRecord[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);

  // Proof Modal State
  const [viewingProof, setViewingProof] = useState<PaymentSubmissionRecord | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [isLoadingProof, setIsLoadingProof] = useState(false);

  // Action Dialogs
  const [verifyingSub, setVerifyingSub] = useState<PaymentSubmissionRecord | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rejectingSub, setRejectingSub] = useState<PaymentSubmissionRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Live real-time subscription to mobile app Client POs in orders collection
  useEffect(() => {
    setIsLoadingPOs(true);
    const unsubPOs = subscribeAllOrders(user, salesperson, role, (livePOs) => {
      setClientPOs(livePOs);
      setIsLoadingPOs(false);
    });

    return () => unsubPOs();
  }, [user, salesperson, role]);

  // 2. Fetch Sales Orders from salesOrders collection
  useEffect(() => {
    async function fetchSalesOrders() {
      setIsLoadingOrders(true);
      try {
        const refCol = collection(db, "salesOrders");
        let q = query(refCol, orderBy("createdAt", "desc"));

        if (role === "salesperson" && user?.userId) {
          q = query(refCol, where("salespersonId", "==", user.userId));
        }

        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder));

        if (list.length > 0) {
          setOrders(list);
        } else {
          // Demo fallback orders
          setOrders([
            {
              id: "ord-1",
              orderNumber: "ORD-2026-055",
              quotationId: "qt-104",
              customerId: "cust-1",
              customerName: "Gujarat Ceramics & Tiles",
              salespersonId: user?.userId || "sp-1",
              status: "dispatched",
              items: [],
              subtotal: 283560,
              taxAmount: 51040,
              grandTotal: 345000,
              shippingAddress: "Shop 12, Ceramic Plaza, 8-A National Highway, Morbi - 363642",
              dispatchDate: "2026-09-21",
              trackingNumber: "GJ-TRK-88190",
              paymentStatus: "paid",
              paymentTerms: "100% advance on PO confirmation",
              createdAt: "2026-09-20",
              updatedAt: "2026-09-21",
            },
            {
              id: "ord-2",
              orderNumber: "ORD-2026-056",
              quotationId: "qt-105",
              customerId: "cust-2",
              customerName: "Somany Buildcon",
              salespersonId: user?.userId || "sp-2",
              status: "in_production",
              items: [],
              subtotal: 540000,
              taxAmount: 97200,
              grandTotal: 637200,
              shippingAddress: "Plot 45, GIDC Industrial Estate, Rajkot - 360003",
              paymentStatus: "partial",
              paymentTerms: "50% advance, balance on dispatch",
              createdAt: "2026-09-22",
              updatedAt: "2026-09-22",
            },
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch sales orders:", err);
      } finally {
        setIsLoadingOrders(false);
      }
    }

    fetchSalesOrders();
  }, [user, role]);

  // 3. Fetch Payment Submissions in Real-Time
  useEffect(() => {
    setIsLoadingPayments(true);
    try {
      const colRef = collection(db, "paymentSubmissions");
      let q = query(colRef, orderBy("submittedAt", "desc"));

      if (role === "salesperson" && user?.userId) {
        q = query(colRef, where("salesPersonId", "==", user.userId), orderBy("submittedAt", "desc"));
      }

      const unsubscribe = onSnapshot(q, (snap) => {
        const list: PaymentSubmissionRecord[] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PaymentSubmissionRecord));
        setPaymentSubmissions(list);
        setIsLoadingPayments(false);
      }, (err) => {
        console.warn("Could not subscribe to paymentSubmissions:", err);
        setIsLoadingPayments(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn("Payment subscriptions error:", e);
      setIsLoadingPayments(false);
    }
  }, [user, role]);

  // Filtered Client POs
  const filteredClientPOs = clientPOs.filter(po => {
    const matchesSearch = 
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.companyName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Payments
  const filteredPayments = paymentSubmissions.filter(p => {
    const matchesSearch =
      (p.orderReference?.toLowerCase() || "").includes(paymentSearch.toLowerCase()) ||
      (p.customerName?.toLowerCase() || "").includes(paymentSearch.toLowerCase()) ||
      (p.utrNumber?.toLowerCase() || "").includes(paymentSearch.toLowerCase());
    const matchesStatus = paymentFilter === "all" || p.status === paymentFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingVerificationCount = paymentSubmissions.filter(
    p => p.status === "pending_verification"
  ).length;

  // Open Proof Viewer Modal
  const handleViewProof = async (sub: PaymentSubmissionRecord) => {
    setViewingProof(sub);
    setProofUrl(null);
    setIsLoadingProof(true);
    try {
      if (sub.proofStoragePath) {
        const fileRef = ref(storage, sub.proofStoragePath);
        const url = await getDownloadURL(fileRef);
        setProofUrl(url);
      }
    } catch (err) {
      console.error("Failed to load proof storage URL:", err);
    } finally {
      setIsLoadingProof(false);
    }
  };

  // Authoritative Verify Payment Action
  const handleConfirmVerify = async () => {
    if (!verifyingSub) return;
    setIsVerifying(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const verifyCallable = httpsCallable(functions, "verifyPaymentCallable");
      const res: any = await verifyCallable({ submissionId: verifyingSub.id });
      
      if (res.data?.success) {
        setActionSuccess(`Payment of ₹${verifyingSub.submittedAmount.toLocaleString("en-IN")} verified successfully!`);
        setVerifyingSub(null);
        if (viewingProof?.id === verifyingSub.id) setViewingProof(null);
      } else {
        setActionError(res.data?.message || "Failed to verify payment");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setActionError(err.message || "Failed to verify payment.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Authoritative Reject Payment Action
  const handleConfirmReject = async () => {
    if (!rejectingSub) return;
    if (!rejectionReason.trim()) {
      setActionError("Please provide a non-empty rejection reason.");
      return;
    }

    setIsRejecting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const rejectCallable = httpsCallable(functions, "rejectPaymentCallable");
      const res: any = await rejectCallable({
        submissionId: rejectingSub.id,
        reason: rejectionReason.trim(),
      });

      if (res.data?.success) {
        setActionSuccess("Payment submission rejected and customer notified.");
        setRejectingSub(null);
        setRejectionReason("");
        if (viewingProof?.id === rejectingSub.id) setViewingProof(null);
      } else {
        setActionError(res.data?.message || "Failed to reject payment");
      }
    } catch (err: any) {
      console.error("Rejection error:", err);
      setActionError(err.message || "Failed to reject payment.");
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "delivered":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "dispatched":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "in_production":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "confirmed":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "cancelled":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending_verification":
        return "bg-amber-50 text-amber-700 border-amber-200 animate-pulse";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <DashboardShell
      title="Orders & Client PO Requests"
      subtitle="Live purchase orders from customer mobile app, factory sales orders, and bank transfer payment reconciliation"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Global Alert Messages */}
        {actionSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
          </div>
        )}
        {actionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-800">✕</button>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setActiveTab("client_pos"); setStatusFilter("all"); setSearchTerm(""); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === "client_pos"
                  ? "bg-[#0E274D] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Client POs (Mobile App)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "client_pos" ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-800"
              }`}>
                {clientPOs.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab("sales_orders"); setStatusFilter("all"); setSearchTerm(""); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === "sales_orders"
                  ? "bg-[#0E274D] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Factory Sales Orders</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab("payments"); setPaymentFilter("all"); setPaymentSearch(""); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer relative ${
                activeTab === "payments"
                  ? "bg-[#0E274D] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Payment Verification</span>
              {pendingVerificationCount > 0 ? (
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-bounce">
                  {pendingVerificationCount}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  {paymentSubmissions.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time App Sync Active</span>
            </div>
          </div>
        </div>

        {/* Top Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === "client_pos"
                    ? "Search client name, company or PO#..."
                    : activeTab === "sales_orders"
                    ? "Search order # or customer..."
                    : "Search PO #, customer, or UTR..."
                }
                value={activeTab === "payments" ? paymentSearch : searchTerm}
                onChange={(e) => {
                  if (activeTab === "payments") {
                    setPaymentSearch(e.target.value);
                  } else {
                    setSearchTerm(e.target.value);
                  }
                }}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {activeTab === "client_pos" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              >
                <option value="all">All PO Statuses</option>
                <option value="pending_rate">Awaiting Quote (pending_rate)</option>
                <option value="rate_quoted">Rate Quoted</option>
                <option value="confirmed">Confirmed</option>
              </select>
            )}

            {activeTab === "sales_orders" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              >
                <option value="all">All Order Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_production">In Production</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
              </select>
            )}

            {activeTab === "payments" && (
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              >
                <option value="all">All Verification Statuses</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="verified">Verified (Bank Credit Confirmed)</option>
                <option value="rejected">Rejected</option>
              </select>
            )}
          </div>
        </div>

        {/* VIEW 1: LIVE CLIENT PURCHASE ORDERS (FROM MOBILE APP) */}
        {activeTab === "client_pos" && (
          <div className="space-y-4">
            {isLoadingPOs ? (
              <div className="p-12 text-center card-luxury">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500">Connecting to real-time mobile app order feed...</p>
              </div>
            ) : filteredClientPOs.length === 0 ? (
              <div className="p-12 text-center card-luxury space-y-3">
                <Smartphone className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No Client Orders Found</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When your clients submit purchase orders through the ITACON app, they will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredClientPOs.map((po) => (
                  <div
                    key={po.id}
                    className="card-luxury p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-[#0E274D]/30 transition-all"
                  >
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-[#0E274D]">{po.poNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-bold uppercase tracking-wider">
                          Mobile App PO
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
                          po.status === "pending_rate" 
                            ? "bg-amber-50 text-amber-800 border-amber-200" 
                            : po.status === "rate_quoted"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}>
                          {po.status === "pending_rate" ? "Quote Needed" : po.status.replace("_", " ")}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(po.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                        <div className="font-semibold text-slate-900">
                          Customer: <span className="text-[#0E274D] font-bold">{po.companyName || po.customerName}</span>
                          {po.customerPhone && <span className="text-slate-500 ml-1.5 font-normal">({po.customerPhone})</span>}
                        </div>
                        <div className="text-slate-600 flex items-center space-x-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{po.totalBoxes} Boxes ({po.totalWeightTons} Tons)</span>
                        </div>
                      </div>

                      {/* Items pill preview */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Requested Tile Items:</div>
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
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-end justify-center gap-2.5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                      {po.status === "pending_rate" ? (
                        <Link
                          href={`/quotations/new?orderId=${po.id}&poNumber=${po.poNumber}&customerId=${po.userId}&name=${encodeURIComponent(po.companyName || po.customerName)}`}
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Quote Rates & Discount &rarr;</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/quotations/${po.quotationId || ""}`}
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Quoted Rates</span>
                        </Link>
                      )}
                      <span className="text-[11px] text-slate-400 text-center">
                        {po.status === "pending_rate" ? "Quantities locked to PO" : "Rate estimate delivered"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FACTORY SALES ORDERS */}
        {activeTab === "sales_orders" && (
          <div className="card-luxury overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">Order #</th>
                    <th className="py-3.5 px-5">Customer & Delivery</th>
                    <th className="py-3.5 px-5">Dispatch / Tracking</th>
                    <th className="py-3.5 px-5">Order Total</th>
                    <th className="py-3.5 px-5">Payment Status</th>
                    <th className="py-3.5 px-5">Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingOrders ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-2" />
                        Loading factory sales orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                        No sales orders found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-5">
                          <span className="font-bold text-[#0E274D] block">{ord.orderNumber}</span>
                          <span className="text-xs text-slate-400">Created: {ord.createdAt}</span>
                        </td>

                        <td className="py-4 px-5">
                          <p className="font-semibold text-slate-800">{ord.customerName}</p>
                          <p className="text-xs text-slate-500 truncate max-w-xs">{ord.shippingAddress}</p>
                        </td>

                        <td className="py-4 px-5">
                          {ord.trackingNumber ? (
                            <div className="text-xs">
                              <p className="font-semibold text-blue-700 flex items-center space-x-1">
                                <Truck className="w-3.5 h-3.5 text-blue-600" />
                                <span>{ord.trackingNumber}</span>
                              </p>
                              <p className="text-[11px] text-slate-400">Dispatched: {ord.dispatchDate}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Awaiting dispatch schedule</span>
                          )}
                        </td>

                        <td className="py-4 px-5">
                          <div className="text-sm font-extrabold text-[#0E274D]">
                            ₹{Number(ord.grandTotal).toLocaleString("en-IN")}
                          </div>
                          <p className="text-xs text-slate-500">{ord.paymentTerms}</p>
                        </td>

                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                            ord.paymentStatus === "paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : ord.paymentStatus === "partial"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {ord.paymentStatus}
                          </span>
                        </td>

                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getStatusBadge(ord.status)}`}>
                            {ord.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: PAYMENT VERIFICATION QUEUE */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            <div className="card-luxury overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-5">PO Reference</th>
                      <th className="py-3.5 px-5">Customer</th>
                      <th className="py-3.5 px-5">Expected Amount</th>
                      <th className="py-3.5 px-5">Submitted Amount</th>
                      <th className="py-3.5 px-5">Transaction / UTR</th>
                      <th className="py-3.5 px-5">Payment Date</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingPayments ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                          <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-2" />
                          Loading payment verification submissions...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                          No payment verification records found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-5">
                            <span className="font-bold text-[#0E274D] block">{sub.orderReference || sub.orderId}</span>
                            <span className="text-xs text-slate-400">
                              Sub ID: {sub.id.substring(0, 12)}...
                            </span>
                          </td>

                          <td className="py-4 px-5">
                            <p className="font-semibold text-slate-800">{sub.customerName || "Customer"}</p>
                            <p className="text-xs text-slate-500">UID: {sub.customerId.substring(0, 10)}...</p>
                          </td>

                          <td className="py-4 px-5 font-bold text-slate-700">
                            ₹{Number(sub.expectedAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          <td className="py-4 px-5">
                            <span className="text-sm font-extrabold text-[#0E274D]">
                              ₹{Number(sub.submittedAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td className="py-4 px-5">
                            <code className="text-xs font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-800">
                              {sub.utrNumber}
                            </code>
                          </td>

                          <td className="py-4 px-5 text-xs text-slate-600">
                            {sub.paymentDate ? (
                              typeof sub.paymentDate === "string" 
                                ? sub.paymentDate 
                                : new Date(sub.paymentDate?.seconds * 1000).toLocaleDateString("en-IN")
                            ) : "N/A"}
                          </td>

                          <td className="py-4 px-5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getPaymentStatusBadge(sub.status)}`}>
                              {sub.status.replace("_", " ")}
                            </span>
                          </td>

                          <td className="py-4 px-5 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handleViewProof(sub)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Proof</span>
                            </button>

                            {sub.status === "pending_verification" && (
                              <>
                                <button
                                  onClick={() => setVerifyingSub(sub)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Verify</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setRejectingSub(sub);
                                    setRejectionReason("");
                                  }}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-all cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: Payment Proof Viewer */}
        {viewingProof && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Payment Transfer Proof</h3>
                  <p className="text-xs text-slate-500">
                    PO #{viewingProof.orderReference} • UTR: {viewingProof.utrNumber}
                  </p>
                </div>
                <button
                  onClick={() => setViewingProof(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {/* Proof Metadata (Read-Only) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block">Expected</span>
                    <span className="font-bold text-slate-800">₹{Number(viewingProof.expectedAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Submitted</span>
                    <span className="font-bold text-[#0E274D]">₹{Number(viewingProof.submittedAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">UTR Number</span>
                    <span className="font-mono font-bold text-slate-800">{viewingProof.utrNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Status</span>
                    <span className="capitalize font-bold text-amber-600">{viewingProof.status.replace("_", " ")}</span>
                  </div>
                </div>

                {/* File Preview */}
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px] bg-slate-50/50">
                  {isLoadingProof ? (
                    <div className="flex flex-col items-center space-y-2 text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin text-[#0E274D]" />
                      <span className="text-xs">Loading secure proof from private storage...</span>
                    </div>
                  ) : proofUrl ? (
                    viewingProof.proofStoragePath?.toLowerCase().endsWith(".pdf") ? (
                      <div className="text-center space-y-3">
                        <FileText className="w-16 h-16 text-rose-500 mx-auto" />
                        <p className="text-sm font-bold text-slate-800">PDF Payment Receipt</p>
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-[#0E274D] text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1"
                        >
                          <span>Open PDF in New Window</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <img
                        src={proofUrl}
                        alt="Bank Transfer Receipt"
                        className="max-h-[450px] w-auto object-contain rounded-lg shadow-sm"
                      />
                    )
                  ) : (
                    <div className="text-center text-slate-400 text-xs">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      Proof document could not be loaded from storage.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons in Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => setViewingProof(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>

                {viewingProof.status === "pending_verification" && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setRejectingSub(viewingProof);
                        setRejectionReason("");
                      }}
                      className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 cursor-pointer"
                    >
                      Reject Proof
                    </button>
                    <button
                      onClick={() => setVerifyingSub(viewingProof)}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm cursor-pointer"
                    >
                      Verify Credit Received
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: Verify Confirmation Dialog */}
        {verifyingSub && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="font-bold text-slate-900 text-lg">Verify Bank Credit</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Confirm that this payment of <strong>₹{Number(verifyingSub.submittedAmount).toLocaleString("en-IN")}</strong> with UTR <strong>{verifyingSub.utrNumber}</strong> has been received in the ITACON company bank account.
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 text-left">
                  ⚠️ This action will mark the order <strong>PAID</strong>, register the UTR permanently, and trigger production fulfillment.
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => setVerifyingSub(null)}
                  disabled={isVerifying}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmVerify}
                  disabled={isVerifying}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isVerifying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Confirm & Mark Paid</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: Rejection Dialog */}
        {rejectingSub && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <XCircle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="font-bold text-slate-900 text-lg">Reject Payment Submission</h3>
                <p className="text-xs text-slate-500">
                  PO #{rejectingSub.orderReference} • UTR: {rejectingSub.utrNumber}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Rejection Reason (Required, visible to customer)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. UTR number not found in bank statement, or amount credited differs from total..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[90px]"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => {
                    setRejectingSub(null);
                    setRejectionReason("");
                  }}
                  disabled={isRejecting}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isRejecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Reject Submission</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
