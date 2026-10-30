"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import {
  fetchLiveCustomerById,
  fetchActiveSalespersonsList,
  updateCustomerAllocatedSalesperson,
  AllocatedSalespersonInfo
} from "@/lib/customer-service";
import { getPOStatusLabel, getPOStatusBadgeClass } from "@/lib/order-service";
import { Customer } from "@/types";
import { DefaulterCheckCard } from "@/components/customers/defaulter-check-card";
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
  CheckCircle2,
  UserCheck,
  UserPlus,
  UserX,
  X,
  Check,
  AlertCircle
} from "lucide-react";

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params?.id as string;
  const { user, role } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);

  const isAllocated = Boolean(
    customer?.salespersonName &&
    customer.salespersonName.trim() !== "" &&
    customer.salespersonName.trim().toLowerCase() !== "not allocated" &&
    customer.salespersonName.trim().toLowerCase() !== "unallocated" &&
    customer.salespersonName.trim().toLowerCase() !== "none" &&
    (!customer.name || customer.salespersonName.trim().toLowerCase() !== customer.name.trim().toLowerCase())
  );
  const [activeTab, setActiveTab] = useState<"quotations" | "opportunities" | "orders">("quotations");
  const [isLoading, setIsLoading] = useState(true);

  // Salesperson allocation modal state
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [salespersonsList, setSalespersonsList] = useState<AllocatedSalespersonInfo[]>([]);
  const [selectedSpId, setSelectedSpId] = useState<string>("");
  const [isLoadingSpList, setIsLoadingSpList] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Mocked/fetched history
  const [quotations, setQuotations] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    async function fetchCustomerData() {
      setIsLoading(true);
      try {
        if (!customerId) return;
        const liveCustomer = await fetchLiveCustomerById(customerId);
        setCustomer(liveCustomer);

        // Fetch live quotations for this customer
        try {
          const qSnap = await getDocs(
            query(collection(db, "quotations"), where("customerId", "==", customerId))
          );
          const qList = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setQuotations(qList);
        } catch (_) {
          setQuotations([]);
        }

        // Fetch live opportunities for this customer
        try {
          const oppSnap = await getDocs(
            query(collection(db, "opportunities"), where("customerId", "==", customerId))
          );
          const oppList = oppSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setOpportunities(oppList);
        } catch (_) {
          setOpportunities([]);
        }

        // Fetch live orders for this customer
        try {
          const ordSnap = await getDocs(
            query(collection(db, "orders"), where("customerId", "==", customerId))
          );
          const ordList = ordSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setOrders(ordList);
        } catch (_) {
          setOrders([]);
        }
      } catch (err) {
        console.error("Could not fetch customer details:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomerData();
  }, [customerId]);

  // Open Reallocation modal for Admin
  const handleOpenReassignModal = async () => {
    setActionErrorMsg(null);
    setIsReassignModalOpen(true);
    setIsLoadingSpList(true);
    try {
      const list = await fetchActiveSalespersonsList();
      setSalespersonsList(list);
      // Preselect current salesperson if matching
      const currentId = customer?.salesPersonId || customer?.assignedSalespersonId;
      if (currentId && list.some(s => s.salesPersonId === currentId)) {
        setSelectedSpId(currentId);
      } else if (list.length > 0) {
        setSelectedSpId(list[0].salesPersonId);
      }
    } catch (err) {
      console.error("Failed to fetch salespersons list:", err);
      setActionErrorMsg("Failed to load salespersons list.");
    } finally {
      setIsLoadingSpList(false);
    }
  };

  // Confirm reallocation
  const handleConfirmAssignment = async () => {
    if (!customer || !selectedSpId) return;
    const targetSp = salespersonsList.find(s => s.salesPersonId === selectedSpId);
    if (!targetSp) {
      setActionErrorMsg("Please choose a valid salesperson.");
      return;
    }

    setIsSavingAssignment(true);
    setActionErrorMsg(null);
    try {
      const res = await updateCustomerAllocatedSalesperson(customer.id, {
        salesPersonId: targetSp.salesPersonId,
        name: targetSp.name,
        phone: targetSp.phone,
        referralCode: targetSp.referralCode,
      });

      if (res.success) {
        // Update local customer state immediately
        setCustomer(prev => prev ? {
          ...prev,
          salesPersonId: targetSp.salesPersonId,
          assignedSalespersonId: targetSp.salesPersonId,
          salespersonName: targetSp.name,
          salespersonPhone: targetSp.phone,
          salespersonReferralCode: targetSp.referralCode,
        } : null);

        setActionSuccessMsg(`Successfully allocated ${targetSp.name} to ${customer.companyName}.`);
        setIsReassignModalOpen(false);
        setTimeout(() => setActionSuccessMsg(null), 5000);
      } else {
        setActionErrorMsg(res.error || "Failed to save allocation.");
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || "Failed to update allocation.");
    } finally {
      setIsSavingAssignment(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardShell title="Customer Profile">
        <div className="flex flex-col items-center justify-center p-16">
          <div className="w-10 h-10 border-3 border-[#0E274D]/20 border-t-[#0E274D] rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-slate-700">Loading Customer Profile...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving live records from Firestore</p>
        </div>
      </DashboardShell>
    );
  }

  if (!customer) {
    return (
      <DashboardShell title="Customer Not Found">
        <div className="card-luxury p-12 text-center bg-white rounded-xl border border-slate-200/80 max-w-lg mx-auto mt-8">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#E66A23] flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Customer Not Found in Database</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            No live customer record found with ID <span className="font-mono font-semibold text-slate-700">{customerId}</span>.
          </p>
          <div className="mt-6">
            <Link
              href="/customers"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0E274D] hover:bg-[#1A3A6D] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Customer Directory</span>
            </Link>
          </div>
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
        {/* Success Alert Banner */}
        {actionSuccessMsg && (
          <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold animate-fadeIn">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  <span>
                    Primary Contact: <span className="font-semibold text-slate-700">{customer.name}</span>
                  </span>
                  <span>•</span>
                  <span>
                    GSTIN: <span className="font-mono text-slate-700">{customer.gstNumber || "Unregistered"}</span>
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center space-x-1 font-medium">
                    <UserCheck className={`w-3.5 h-3.5 ${isAllocated ? "text-[#0E274D]" : "text-slate-400"}`} />
                    <span>Allocated Salesperson:</span>
                    <span className={`font-semibold ${isAllocated ? "text-[#0E274D]" : "text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200"}`}>
                      {isAllocated ? customer.salespersonName : "Not Allocated"}
                    </span>
                    {isAllocated && customer.salespersonPhone && (
                      <span className="text-slate-600 font-mono">({customer.salespersonPhone})</span>
                    )}
                  </span>
                </div>
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

          <div className="pt-6">
            <DefaulterCheckCard gstNumber={customer.gstNumber} />
          </div>

          {/* Key Metrics Grid - 5 Column Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 pt-6">
            {/* 1. Credit Limit */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium">Credit Limit</span>
              <p className="text-lg font-bold text-[#0E274D] mt-0.5">
                ₹{(customer.creditLimit / 100000).toFixed(2)} Lakhs
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Terms: {customer.paymentTerms}</p>
            </div>

            {/* 2. Contact Phone */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium">Contact Phone</span>
              <p className="text-sm font-bold text-slate-800 mt-0.5 flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{customer.phone}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{customer.email || "No email"}</p>
            </div>

            {/* 3. Business Address */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium">Business Address</span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">
                {customer.address || `${customer.city}, ${customer.state}`}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">PIN: {customer.pincode || "380001"}</p>
            </div>

            {/* 4. Allocated Salesperson Card (Name, Mobile No, Referral Code, Reassign Action) */}
            <div className={`p-3.5 rounded-xl flex flex-col justify-between shadow-xs relative transition-all ${isAllocated
                ? "bg-gradient-to-br from-blue-50/70 via-slate-50/50 to-orange-50/40 border border-blue-200/80"
                : "bg-slate-50/90 border border-dashed border-amber-300/80"
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#0E274D] font-bold flex items-center space-x-1.5">
                  <UserCheck className={`w-3.5 h-3.5 ${isAllocated ? "text-[#0E274D]" : "text-slate-400"}`} />
                  <span>Allocated Salesperson</span>
                </span>
                {isAllocated && customer.salespersonReferralCode && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0E274D]/10 text-[#0E274D] font-bold border border-[#0E274D]/15">
                    {customer.salespersonReferralCode}
                  </span>
                )}
              </div>

              <div className="my-1.5">
                {isAllocated ? (
                  <>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {customer.salespersonName}
                    </p>
                    {customer.salespersonPhone ? (
                      <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center space-x-1">
                        <Phone className="w-3 h-3 text-[#E66A23]" />
                        <a
                          href={`tel:${customer.salespersonPhone}`}
                          className="text-[#E66A23] hover:underline hover:text-[#D95D16] transition-colors"
                          title="Call Salesperson"
                        >
                          {customer.salespersonPhone}
                        </a>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-0.5">No contact number registered</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-amber-900 flex items-center space-x-1.5">
                      <span>Not Allocated</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">No salesperson assigned to this account</p>
                  </>
                )}
              </div>

              {role === "admin" && (
                <div className="pt-1.5 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Admin Access</span>
                  <button
                    onClick={handleOpenReassignModal}
                    className="text-[11px] font-bold text-[#0E274D] hover:text-[#E66A23] hover:underline inline-flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>{isAllocated ? "Reallocate" : "Allocate Now"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 5. Mobile App Status */}
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

        {/* Admin Salesperson Allocation / Reassignment Modal */}
        {isReassignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="card-luxury w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0E274D]/10 text-[#0E274D] flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Allocate Salesperson</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Assign sales executive to {customer.companyName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReassignModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {actionErrorMsg && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{actionErrorMsg}</span>
                  </div>
                )}

                {isLoadingSpList ? (
                  <div className="py-8 text-center">
                    <div className="w-7 h-7 border-2 border-[#0E274D]/20 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Loading active salespersons...</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Select Sales Executive:
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {salespersonsList.map((sp) => {
                        const isSelected = selectedSpId === sp.salesPersonId;
                        return (
                          <div
                            key={sp.salesPersonId}
                            onClick={() => setSelectedSpId(sp.salesPersonId)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${isSelected
                                ? "bg-blue-50/80 border-[#0E274D] ring-2 ring-[#0E274D]/10"
                                : "bg-white border-slate-200 hover:bg-slate-50"
                              }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isSelected
                                    ? "bg-[#0E274D] text-white"
                                    : "bg-slate-100 text-slate-700"
                                  }`}
                              >
                                {sp.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900">{sp.name}</p>
                                <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{sp.phone || "No phone registered"}</span>
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {sp.referralCode || "SP"}
                              </span>
                              {isSelected && (
                                <div className="mt-1 flex items-center justify-end text-xs font-bold text-[#0E274D]">
                                  <Check className="w-3.5 h-3.5 mr-0.5" />
                                  <span>Selected</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  disabled={isSavingAssignment}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  disabled={isSavingAssignment || !selectedSpId || isLoadingSpList}
                  className="px-4 py-2 bg-[#0E274D] hover:bg-[#1A3A6D] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSavingAssignment ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Allocation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Section */}
        <div className="space-y-4">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("quotations")}
              className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === "quotations"
                  ? "border-[#E66A23] text-[#E66A23]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              Quotations ({quotations.length})
            </button>
            <button
              onClick={() => setActiveTab("opportunities")}
              className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === "opportunities"
                  ? "border-[#E66A23] text-[#E66A23]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              Opportunities ({opportunities.length})
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === "orders"
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
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getPOStatusBadgeClass(q.status, { adminApprovalStatus: q.adminApprovalStatus, salespersonApprovalStatus: q.salespersonApprovalStatus, isOrder: false })}`}>
                          {getPOStatusLabel(q.status, { adminApprovalStatus: q.adminApprovalStatus, salespersonApprovalStatus: q.salespersonApprovalStatus, isOrder: false })}
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
                    <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getPOStatusBadgeClass(ord.status, { adminApprovalStatus: ord.adminApprovalStatus, salespersonApprovalStatus: ord.salespersonApprovalStatus, isOrder: true })}`}>
                      {getPOStatusLabel(ord.status, { adminApprovalStatus: ord.adminApprovalStatus, salespersonApprovalStatus: ord.salespersonApprovalStatus, isOrder: true })}
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
