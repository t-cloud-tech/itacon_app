"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Customer } from "@/types";
import { 
  ArrowLeft, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  FileSpreadsheet, 
  Target, 
  Truck, 
  PlusCircle, 
  Smartphone, 
  CalendarClock,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params?.id as string;
  const { user } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<"quotations" | "opportunities" | "orders">("quotations");
  const [isLoading, setIsLoading] = useState(true);

  // Mocked/fetched history
  const [quotations, setQuotations] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    async function fetchCustomerData() {
      setIsLoading(true);
      try {
        if (!customerId) return;
        const snap = await getDoc(doc(db, "customers", customerId));
        if (snap.exists()) {
          setCustomer({ id: snap.id, ...snap.data() } as Customer);
        } else {
          // Fallback baseline customer
          setCustomer({
            id: customerId,
            customerNumber: "CUST-2026-081",
            name: "Pravin Bhai Shah",
            companyName: "Gujarat Ceramics & Tiles",
            phone: "98250 99881",
            email: "gujaratceramics@gmail.com",
            city: "Ahmedabad",
            state: "Gujarat",
            address: "Plot 14, GIDC Vatva Industrial Estate, Phase 2",
            pincode: "382445",
            gstNumber: "24AAACG1234F1Z5",
            category: "Dealer",
            priceTier: "A",
            creditLimit: 1500000,
            paymentTerms: "45 Days",
            assignedSalespersonId: user?.userId || "sp-1",
            status: "active",
            createdAt: "2026-01-10",
            updatedAt: "2026-09-20",
          });
        }

        // Demo quotations for customer
        setQuotations([
          {
            id: "qt-104",
            quotationNumber: "QT-2026-104",
            grandTotal: 345000,
            status: "approved",
            totalBoxes: 450,
            createdAt: "Sep 22, 2026",
            appSynced: true,
          },
          {
            id: "qt-091",
            quotationNumber: "QT-2026-091",
            grandTotal: 520000,
            status: "accepted",
            totalBoxes: 680,
            createdAt: "Aug 15, 2026",
            appSynced: true,
          },
        ]);

        // Demo opportunities
        setOpportunities([
          {
            id: "opp-1",
            oppNumber: "OPP-2026-022",
            title: "Commercial Complex Floor Tiles (GVT 800x1600)",
            stage: "quotation",
            estimatedValue: 1200000,
            probability: 70,
            expectedCloseDate: "Oct 15, 2026",
          }
        ]);

        // Demo orders
        setOrders([
          {
            id: "ord-1",
            orderNumber: "ORD-2026-055",
            status: "dispatched",
            grandTotal: 520000,
            dispatchDate: "Sep 01, 2026",
            trackingNumber: "TRK-GT-9921",
          }
        ]);

      } catch (err) {
        console.warn("Could not fetch customer details:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomerData();
  }, [customerId, user]);

  if (isLoading || !customer) {
    return (
      <DashboardShell title="Customer Profile">
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={customer.companyName}
      subtitle={`Customer 360 View • ${customer.customerNumber}`}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <Link
            href="/customers"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-[#0E274D]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customers</span>
          </Link>

          <div className="flex items-center space-x-2">
            <Link
              href={`/quotations/new?customerId=${customer.id}&name=${encodeURIComponent(customer.companyName)}`}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Quotation</span>
            </Link>
          </div>
        </div>

        {/* Profile Overview Card */}
        <div className="card-luxury p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0E274D] to-[#1A2D5A] text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
                {customer.companyName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-[#0E274D]">{customer.companyName}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active Account
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Primary Contact: <span className="font-semibold text-slate-700">{customer.name}</span> • GSTIN: <span className="font-mono text-slate-700">{customer.gstNumber || "Unregistered"}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {customer.category}
              </span>
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Price Tier {customer.priceTier}
              </span>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium">Credit Limit</span>
              <p className="text-lg font-bold text-[#0E274D] mt-0.5">
                ₹{(customer.creditLimit / 100000).toFixed(2)} Lakhs
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Terms: {customer.paymentTerms}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium">Contact Phone</span>
              <p className="text-sm font-bold text-slate-800 mt-0.5 flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{customer.phone}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{customer.email || "No email"}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium">Business Address</span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">
                {customer.address || `${customer.city}, ${customer.state}`}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">PIN: {customer.pincode || "380001"}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col justify-between">
              <span className="text-xs text-emerald-800 font-medium">Mobile App Status</span>
              <p className="text-xs font-bold text-emerald-900 flex items-center space-x-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sync Active</span>
              </p>
              <p className="text-[11px] text-emerald-700">Can view approved quotes</p>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="space-y-4">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("quotations")}
              className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "quotations"
                  ? "border-[#E66A23] text-[#E66A23]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Quotations ({quotations.length})
            </button>
            <button
              onClick={() => setActiveTab("opportunities")}
              className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "opportunities"
                  ? "border-[#E66A23] text-[#E66A23]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Opportunities ({opportunities.length})
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "orders"
                  ? "border-[#E66A23] text-[#E66A23]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Orders ({orders.length})
            </button>
          </div>

          {/* Tab Content: Quotations */}
          {activeTab === "quotations" && (
            <div className="card-luxury overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-5">Quotation #</th>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Boxes</th>
                    <th className="py-3 px-5">Amount</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">App Visibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotations.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-[#0E274D]">
                        <Link href={`/quotations/${q.id}`} className="hover:underline">
                          {q.quotationNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-slate-500">{q.createdAt}</td>
                      <td className="py-3.5 px-5 text-xs text-slate-600">{q.totalBoxes}</td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        ₹{Number(q.grandTotal).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Smartphone className="w-3 h-3" />
                          <span>Visible in App</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Content: Opportunities */}
          {activeTab === "opportunities" && (
            <div className="card-luxury p-5 space-y-3">
              {opportunities.map((opp) => (
                <div key={opp.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-slate-400">{opp.oppNumber}</span>
                    <h3 className="text-sm font-bold text-[#0E274D] mt-0.5">{opp.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Expected Close: {opp.expectedCloseDate} • Probability: {opp.probability}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-extrabold text-[#0E274D]">
                      ₹{(opp.estimatedValue / 100000).toFixed(2)}L
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                      {opp.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab Content: Orders */}
          {activeTab === "orders" && (
            <div className="card-luxury p-5 space-y-3">
              {orders.map((ord) => (
                <div key={ord.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-slate-400">{ord.orderNumber}</span>
                    <p className="text-xs text-slate-500 mt-1">Dispatched: {ord.dispatchDate} • Tracking: {ord.trackingNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-extrabold text-[#0E274D]">
                      ₹{Number(ord.grandTotal).toLocaleString("en-IN")}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
