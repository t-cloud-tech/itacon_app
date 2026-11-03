"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Pencil, Loader2, AlertCircle, Info, Lock } from "lucide-react";
import { Lead, LeadSource, LeadStatus } from "@/types";
import { updateLeadAsAdmin } from "@/lib/lead-service";
import { fetchActiveSalespersonsList, AllocatedSalespersonInfo } from "@/lib/customer-service";
import { useAuth } from "@/lib/auth-context";

interface Props {
  lead: Lead;
  onClose: () => void;
  onUpdated: (updatedLead: Lead) => void;
}

const SOURCES: { id: LeadSource; label: string }[] = [
  { id: "manual", label: "Manual Prospecting (Direct field visit)" },
  { id: "referral", label: "Referral from existing client" },
  { id: "trade_fair", label: "Exhibition / Expo / Trade Fair" },
  { id: "website", label: "Website Inbound" },
  { id: "customer_app", label: "Customer Mobile App" },
];

const STATUSES: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New Lead" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "converted", label: "Converted to Customer" },
  { id: "dropped", label: "Dropped" },
];

const STATES = [
  "Gujarat",
  "Maharashtra",
  "Rajasthan",
  "Madhya Pradesh",
  "Karnataka",
  "Other",
];

export function EditLeadModal({ lead, onClose, onUpdated }: Props) {
  const { user, role } = useAuth();

  const [salespersons, setSalespersons] = useState<AllocatedSalespersonInfo[]>([]);
  const [loadingSalespersons, setLoadingSalespersons] = useState(true);

  // Form State
  const [name, setName] = useState(lead.name || "");
  const [companyName, setCompanyName] = useState(lead.companyName || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [city, setCity] = useState(lead.city || "Ahmedabad");
  const [state, setState] = useState(lead.state || "Gujarat");
  const [source, setSource] = useState<LeadSource>(lead.source || "manual");
  const [status, setStatus] = useState<LeadStatus>(lead.status || "new");
  const [assignedSalespersonId, setAssignedSalespersonId] = useState(lead.assignedSalespersonId || "");
  const [requirementNotes, setRequirementNotes] = useState(lead.requirementNotes || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isConverted = lead.status === "converted" || Boolean(lead.convertedCustomerId);

  useEffect(() => {
    let isMounted = true;
    fetchActiveSalespersonsList()
      .then((list) => {
        if (!isMounted) return;
        setSalespersons(list);
        setLoadingSalespersons(false);
      })
      .catch((err) => {
        console.error("Could not load salespersons:", err);
        if (isMounted) setLoadingSalespersons(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Dirty check: has anything changed from the original lead?
  const isDirty = useMemo(() => {
    return (
      name.trim() !== (lead.name || "").trim() ||
      companyName.trim() !== (lead.companyName || "").trim() ||
      phone.trim() !== (lead.phone || "").trim() ||
      email.trim() !== (lead.email || "").trim() ||
      city.trim() !== (lead.city || "Ahmedabad").trim() ||
      state.trim() !== (lead.state || "Gujarat").trim() ||
      source !== (lead.source || "manual") ||
      status !== (lead.status || "new") ||
      assignedSalespersonId !== (lead.assignedSalespersonId || "") ||
      requirementNotes.trim() !== (lead.requirementNotes || "").trim()
    );
  }, [
    name,
    companyName,
    phone,
    email,
    city,
    state,
    source,
    status,
    assignedSalespersonId,
    requirementNotes,
    lead,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !isDirty) return;

    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Contact Person Name is required.");
      return;
    }

    const cleanDigits = phone.replace(/\D/g, "");
    if (!(cleanDigits.length === 10 && /^[6-9]\d{9}$/.test(cleanDigits)) &&
        !(cleanDigits.length === 12 && cleanDigits.startsWith("91") && /^[6-9]\d{9}$/.test(cleanDigits.slice(2)))) {
      setErrorMsg("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!assignedSalespersonId) {
      setErrorMsg("Please select an assigned salesperson.");
      return;
    }

    if (isConverted && status !== "converted") {
      setErrorMsg("This lead is converted. Status cannot be changed back from Converted.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedSp = salespersons.find((s) => s.salesPersonId === assignedSalespersonId);
      const spName = selectedSp ? selectedSp.name : lead.assignedSalespersonName || "Sales Executive";

      const res = await updateLeadAsAdmin({
        leadId: lead.id,
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        phone: cleanDigits.length === 12 ? cleanDigits.slice(2) : cleanDigits,
        email: email.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        source,
        status,
        assignedSalespersonId,
        assignedSalespersonName: spName,
        requirementNotes: requirementNotes.trim() || undefined,
        updatedBy: user?.userId || "admin",
        updatedByName: user?.name || "Admin",
        updatedByRole: role || "admin",
      });

      if (!res.success || !res.updatedLead) {
        setErrorMsg(res.error || "Failed to update lead. Please try again.");
        setIsSubmitting(false);
        return;
      }

      onUpdated(res.updatedLead);
      onClose();
    } catch (err: any) {
      console.error("Error updating lead:", err);
      setErrorMsg(err?.message || "An unexpected error occurred while saving lead changes.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fadeIn backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-scaleUp">
        {/* Header */}
        <div className="p-5 flex items-start justify-between border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0E274D]/10 text-[#0E274D] flex items-center justify-center shrink-0 border border-[#0E274D]/20">
              <Pencil className="w-5 h-5 text-[#0E274D]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Edit Lead — {lead.name}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {lead.leadNumber || lead.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Read-Only Meta Badge Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Lead ID
              </span>
              <span className="font-mono font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{lead.leadNumber || lead.id}</span>
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Created Date
              </span>
              <span className="text-slate-700 font-medium block mt-0.5 truncate">
                {lead.createdAt || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Created By
              </span>
              <span className="text-slate-700 font-medium block mt-0.5 truncate">
                {lead.assignedBy ? `Admin (${lead.assignedBy.slice(0, 8)})` : "Inbound / App"}
              </span>
            </div>
          </div>

          {/* Converted Lead Notice */}
          {isConverted && (
            <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">This lead is converted.</p>
                <p className="mt-0.5 text-amber-800">
                  Changes here do NOT update the customer — edit the customer from Customers.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="edit-lead-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Person Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Contact Person Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              {/* Company / Firm Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Company / Firm Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shree Ram Ceramic Studio"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile (e.g. 98250 12345)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. client@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="Ahmedabad"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  {STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Acquisition Source */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Acquisition Source
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  {SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Status
                </label>
                <select
                  disabled={isConverted}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D] ${
                    isConverted ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                  }`}
                >
                  {STATUSES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
                {isConverted && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Status is locked to Converted for this customer.
                  </p>
                )}
              </div>

              {/* Assign to Salesperson (Required) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Assign to Salesperson *
                </label>
                <select
                  required
                  value={assignedSalespersonId}
                  onChange={(e) => setAssignedSalespersonId(e.target.value)}
                  disabled={loadingSalespersons}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="">-- Select an active salesperson --</option>
                  {salespersons.map((sp) => (
                    <option key={sp.salesPersonId} value={sp.salesPersonId}>
                      {sp.name}
                      {sp.referralCode ? ` • ${sp.referralCode}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Requirement Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Requirement Details & Estimated Tile Quantity
                </label>
                <textarea
                  rows={3}
                  placeholder="Specify tile types, estimated sqft or boxes, project timelines..."
                  value={requirementNotes}
                  onChange={(e) => setRequirementNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {!isDirty ? (
              <span>No changes made</span>
            ) : (
              <span className="text-[#E66A23] font-semibold">Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-lead-form"
              disabled={isSubmitting || !isDirty}
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#0E274D] hover:bg-[#1A3A6D] rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

