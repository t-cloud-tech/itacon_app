"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Quotation, QuotationStatus } from "@/types";
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
  Weight
} from "lucide-react";

export default function QuotationsPage() {
  const { user, role } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchQuotations() {
      setIsLoading(true);
      try {
        const quotesRef = collection(db, "quotations");
        let q = query(quotesRef, orderBy("createdAt", "desc"));

        if (role === "salesperson" && user?.userId) {
          q = query(quotesRef, where("salespersonId", "==", user.userId));
        }

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));

        if (list.length > 0) {
          setQuotations(list);
        } else {
          // Demo realistic quotations
          setQuotations([
            {
              id: "qt-104",
              quotationNumber: "QT-2026-104",
              customerId: "cust-1",
              customerName: "Gujarat Ceramics & Tiles",
              salespersonId: user?.userId || "sp-1",
              salespersonName: user?.name || "Senior Sales Executive",
              status: "approved",
              items: [
                {
                  productId: "prod-1",
                  productName: "Statuario White Marble Porcelain",
                  sku: "ITA-STAT-6012",
                  size: "600x1200 mm",
                  quantityBoxes: 300,
                  sqftPerBox: 15.5,
                  totalSqft: 4650,
                  weightKg: 8850,
                  unitPrice: 580,
                  discountPercent: 10,
                  effectivePrice: 522,
                  lineTotal: 156600,
                },
                {
                  productId: "prod-2",
                  productName: "Nero Marquina Grand Slab",
                  sku: "ITA-NERO-8016",
                  size: "800x1600 mm",
                  quantityBoxes: 150,
                  sqftPerBox: 27.56,
                  totalSqft: 4134,
                  weightKg: 8100,
                  unitPrice: 920,
                  discountPercent: 8,
                  effectivePrice: 846.4,
                  lineTotal: 126960,
                }
              ],
              subtotal: 283560,
              discountTotal: 28400,
              taxPercent: 18,
              taxAmount: 51040,
              shippingCharge: 10400,
              grandTotal: 345000,
              totalBoxes: 450,
              totalWeightTons: 16.95,
              paymentTerms: "30 Days Net",
              validityDays: 15,
              expiryDate: "2026-10-07",
              requiresSpecialApproval: false,
              approvalStatus: "approved",
              createdAt: "2026-09-22",
              updatedAt: "2026-09-22",
            },
            {
              id: "qt-103",
              quotationNumber: "QT-2026-103",
              customerId: "cust-2",
              customerName: "Apex Infra & Builders",
              salespersonId: user?.userId || "sp-1",
              salespersonName: user?.name || "Senior Sales Executive",
              status: "pending_approval",
              items: [],
              subtotal: 780000,
              discountTotal: 130000,
              taxPercent: 18,
              taxAmount: 140400,
              shippingCharge: 20000,
              grandTotal: 890000,
              totalBoxes: 1200,
              totalWeightTons: 35.4,
              paymentTerms: "45 Days",
              validityDays: 15,
              expiryDate: "2026-10-06",
              requiresSpecialApproval: true,
              approvalStatus: "pending",
              createdAt: "2026-09-21",
              updatedAt: "2026-09-21",
            },
            {
              id: "qt-102",
              quotationNumber: "QT-2026-102",
              customerId: "cust-3",
              customerName: "Studio Kulkarni Architects",
              salespersonId: user?.userId || "sp-1",
              salespersonName: user?.name || "Senior Sales Executive",
              status: "sent_to_customer",
              items: [],
              subtotal: 148000,
              discountTotal: 7400,
              taxPercent: 18,
              taxAmount: 26640,
              shippingCharge: 5000,
              grandTotal: 175000,
              totalBoxes: 220,
              totalWeightTons: 6.4,
              paymentTerms: "Advance 50%",
              validityDays: 15,
              expiryDate: "2026-10-04",
              requiresSpecialApproval: false,
              approvalStatus: "none",
              createdAt: "2026-09-19",
              updatedAt: "2026-09-19",
            },
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch quotations:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuotations();
  }, [user, role]);

  const filteredQuotes = quotations.filter(q => {
    const matchesSearch = 
      q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || q.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case "approved":
      case "accepted":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending_approval":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "sent_to_customer":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "rejected":
      case "declined":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <DashboardShell
      title="B2B Quotations"
      subtitle="Create, calculate box weight/sqft, request approval, and sync to Customer Mobile App"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by quote # or customer name..."
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
              <option value="all">All Quotation Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="sent_to_customer">Sent to Customer</option>
              <option value="accepted">Accepted / Order Placed</option>
              <option value="rejected">Rejected</option>
            </select>

            <Link
              href="/quotations/new"
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Quotation</span>
            </Link>
          </div>
        </div>

        {/* Quotations Table */}
        <div className="card-luxury overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Quotation #</th>
                  <th className="py-3.5 px-5">Customer</th>
                  <th className="py-3.5 px-5">Boxes & Weight</th>
                  <th className="py-3.5 px-5">Amount (incl. Tax)</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-center">Customer App Sync</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <Link href={`/quotations/${quote.id}`} className="font-bold text-[#0E274D] hover:underline">
                        {quote.quotationNumber}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5">{quote.createdAt}</p>
                    </td>

                    <td className="py-4 px-5">
                      <p className="font-semibold text-slate-800">{quote.customerName}</p>
                      <p className="text-xs text-slate-500 font-medium">Terms: {quote.paymentTerms}</p>
                    </td>

                    <td className="py-4 px-5">
                      <div className="text-xs">
                        <p className="font-bold text-slate-700">{quote.totalBoxes} Boxes</p>
                        <p className="text-slate-400 font-medium">~{quote.totalWeightTons} Tons</p>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <div className="text-sm font-extrabold text-[#0E274D]">
                        ₹{Number(quote.grandTotal).toLocaleString("en-IN")}
                      </div>
                      {quote.discountTotal > 0 && (
                        <p className="text-[11px] text-emerald-600 font-semibold">
                          ₹{Number(quote.discountTotal).toLocaleString("en-IN")} disc.
                        </p>
                      )}
                    </td>

                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getStatusBadge(quote.status)}`}>
                        {quote.status.replace("_", " ")}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-center">
                      {quote.status === "approved" || quote.status === "sent_to_customer" || quote.status === "accepted" ? (
                        <span className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Visible in App</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Awaiting Approval</span>
                      )}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <Link
                        href={`/quotations/${quote.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#0E274D] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View / Print</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
