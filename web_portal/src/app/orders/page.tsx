"use client";

import React, { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db, storage, functions } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { SalesOrder, OrderStatus, PaymentSubmissionRecord } from "@/types";
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
  RefreshCw
} from "lucide-react";

export default function SalesOrdersPage() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<"orders" | "payments">("orders");

  // Orders State
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

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

  // 1. Fetch Sales Orders
  useEffect(() => {
    async function fetchOrders() {
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
              shippingAddress: "Plot 14, GIDC Vatva Industrial Estate, Phase 2, Ahmedabad",
              paymentTerms: "30 Days Net",
              paymentStatus: "partial",
              advancePaid: 150000,
              dispatchDate: "2026-09-22",
              trackingNumber: "TRK-GT-9921 (Shreeji Logistics)",
              createdAt: "2026-09-21",
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

    fetchOrders();
  }, [user, role]);

  // 2. Fetch Payment Submissions in Real-Time
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
      title="Orders & Payment Verification"
      subtitle="Manage purchase orders, logistics, and company bank transfer reconciliations"
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "orders"
                ? "border-[#0E274D] text-[#0E274D]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Sales Orders</span>
          </button>

          <button
            onClick={() => setActiveTab("payments")}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 relative ${
              activeTab === "payments"
                ? "border-[#0E274D] text-[#0E274D]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Payment Verification</span>
            {pendingVerificationCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white animate-bounce">
                {pendingVerificationCount}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: Sales Orders */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Top Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-1 items-center space-x-3 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search order # or customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
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
              </div>
            </div>

            {/* Orders Table */}
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
                    {filteredOrders.map((ord) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Payment Verification Queue */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            {/* Top Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-1 items-center space-x-3 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search PO #, customer, or UTR..."
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
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
              </div>
            </div>

            {/* Submissions Table */}
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
                    {filteredPayments.length === 0 ? (
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
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Proof</span>
                            </button>

                            {sub.status === "pending_verification" && (
                              <>
                                <button
                                  onClick={() => setVerifyingSub(sub)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 shadow-sm transition-all"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Verify</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setRejectingSub(sub);
                                    setRejectionReason("");
                                  }}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-all"
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
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
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
                    viewingProof.proofStoragePath.toLowerCase().endsWith(".pdf") ? (
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
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100"
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
                      className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100"
                    >
                      Reject Proof
                    </button>
                    <button
                      onClick={() => setVerifyingSub(viewingProof)}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm"
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
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmVerify}
                  disabled={isVerifying}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center justify-center space-x-1"
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
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center space-x-1"
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
