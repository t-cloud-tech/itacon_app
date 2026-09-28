"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import { Quotation, QuotationStatus } from "@/types";
import { subscribeClientPORequests, ClientOrderPO } from "@/lib/order-service";
import { 
  FileSpreadsheet, 
  PlusCircle, 
  Search, 
  Filter, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Truck,
  ArrowRight,
  Eye,
  Weight,
  Layers,
  ShoppingBag,
  Inbox,
  Radio,
  ShieldAlert
} from "lucide-react";

export default function QuotationsPage() {
  const { user, role, salesperson } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [poRequests, setPoRequests] = useState<ClientOrderPO[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "pending_po">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    // 1. Real-time live quotations listener
    const quotesRef = collection(db, "quotations");
    let q = query(quotesRef, orderBy("createdAt", "desc"));

    if (role === "salesperson" && user?.userId) {
      q = query(quotesRef, where("salespersonId", "==", user.userId));
    }

    const unsubQuotes = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
        setQuotations(list);
      },
      (err) => {
        console.warn("Real-time quotations listener warning:", err);
      }
    );

    // 2. Real-time live client PO listener (triggers INSTANTLY when client places PO in app!)
    const unsubPOs = subscribeClientPORequests(user, salesperson, role, (livePOs) => {
      setPoRequests(livePOs);
      setIsLoading(false);
    });

    return () => {
      unsubQuotes();
      unsubPOs();
    };
  }, [user, salesperson, role]);

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = 
      q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPOs = poRequests.filter(po => {
    return (
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <DashboardShell
      title="Quotations & Client PO Requests"
      subtitle={
        role === "admin"
          ? "Manage price quotations, client purchase orders, and special discount approvals"
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
                onClick={() => setActiveTab("pending_po")}
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

        {/* Tab Navigation & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 sm:pb-0 sm:border-none">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-[#0E274D] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Generated Quotations ({quotations.length})
            </button>
            <button
              onClick={() => setActiveTab("pending_po")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === "pending_po"
                  ? "bg-[#E66A23] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>Incoming Client POs</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === "pending_po" ? "bg-white text-[#E66A23]" : "bg-orange-100 text-orange-700"}`}>
                {poRequests.length}
              </span>
            </button>

            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time App Sync</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative w-64">
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
                <option value="approved">Approved</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="sent_to_customer">Sent to App</option>
                <option value="accepted">Accepted by Client</option>
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

        {/* VIEW 1: INCOMING CLIENT PO REQUESTS */}
        {activeTab === "pending_po" && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl text-xs text-orange-900 leading-relaxed flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-[#E66A23] shrink-0" />
                <span>
                  <strong>Client App Sync:</strong> Below are orders submitted by your clients asking for price & discount quotations. Clicking <strong>"Quote Rates & Discount"</strong> pre-fills and locks the client's order items so you only set the price and discount.
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
                            <span>Awaiting Admin Confirmation (&lt; ₹26.50/sq.ft)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Awaiting Rate Quote</span>
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
                          href={`/quotations/${po.quotationId || ""}`}
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          <span>In Admin Review (&lt; ₹26.50) &rarr;</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/quotations/new?orderId=${po.id}&poNumber=${po.poNumber}&customerId=${po.userId}&name=${encodeURIComponent(po.companyName || po.customerName)}`}
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Quote Rates & Discount &rarr;</span>
                        </Link>
                      )}
                      <span className="text-[11px] text-slate-400 text-center">
                        {po.status === "pending_admin_approval" ? "Pending Admin Approval" : "Quantities lock from client PO"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: GENERATED QUOTATIONS TABLE */}
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
                      <th className="py-3.5 px-5">Customer & Salesperson</th>
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
                          <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            q.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : q.status === "pending_approval"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : q.status === "sent_to_customer"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-700"
                          }`}>
                            <span className="capitalize">{q.status.replace(/_/g, " ")}</span>
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
