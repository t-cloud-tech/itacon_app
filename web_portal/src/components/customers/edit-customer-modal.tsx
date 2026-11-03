"use client";

import React, { useEffect, useState, useMemo } from "react";
import { X, Pencil, Lock, Check, AlertCircle } from "lucide-react";
import {
  fetchActiveSalespersonsList,
  lookupGstDetails,
  updateCustomerProfile,
  AllocatedSalespersonInfo,
  CUSTOMER_CATEGORY_CONFIG,
} from "@/lib/customer-service";
import { PAYMENT_TERM_OPTIONS } from "@/lib/payment-terms";
import { Customer, UserRole } from "@/types";
import { isAdminRole } from "@/lib/auth-utils";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const CATEGORIES = [
  { id: "dealer", label: "Tile Dealer / Showroom" },
  { id: "architect", label: "Architect / Interior Designer" },
  { id: "builder", label: "Builder / Contractor" },
  { id: "wholesaler", label: "Wholesaler / Distributor" },
  { id: "retailer", label: "Retailer" },
  { id: "trader", label: "Trader" },
];

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const inputCls =
  "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

function normalizeCategory(cat?: string): string {
  const lower = (cat || "dealer").toLowerCase().trim();
  if (CUSTOMER_CATEGORY_CONFIG[lower]) return lower;
  return "dealer";
}

function normalizePaymentTerms(terms?: string): string {
  if (!terms) return "30 Days Net";
  const trimmed = terms.trim();
  const match = PAYMENT_TERM_OPTIONS.find((opt) => opt.value === trimmed || opt.label === trimmed);
  if (match) return match.value;
  if (trimmed.includes("30")) return "30 Days Net";
  if (trimmed.includes("45")) return "45 Days Net";
  if (trimmed.includes("60")) return "60 Days Net (Requires Credit Check)";
  if (trimmed.includes("50%")) return "50% Advance, 50% Before Dispatch";
  if (trimmed.toLowerCase().includes("advance") || trimmed.toLowerCase().includes("immediate")) {
    return "Immediate / Advance";
  }
  return trimmed;
}

interface FormState {
  name: string;
  companyName: string;
  category: string;
  priceTier: "A" | "B" | "C";
  creditLimit: number;
  paymentTerms: string;
  email: string;
  gstNumber: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  salesPersonId: string;
}

interface Props {
  customer: Customer;
  role: UserRole | null;
  onClose: () => void;
  onUpdated?: (updatedCustomer: Customer) => void;
  onSaved?: (updatedCustomer?: Customer) => void;
}

export function EditCustomerModal({ customer, role, onClose, onUpdated, onSaved }: Props) {
  const { user } = useAuth();
  const isAdmin = isAdminRole(role);

  const initialForm: FormState = useMemo(() => {
    return {
      name: customer.name || "",
      companyName: customer.companyName || "",
      category: normalizeCategory(customer.category),
      priceTier: (customer.priceTier || "B") as "A" | "B" | "C",
      creditLimit: Number(customer.creditLimit) || 0,
      paymentTerms: normalizePaymentTerms(customer.paymentTerms),
      email: customer.email || "",
      gstNumber: (customer.gstNumber || "").toUpperCase().trim(),
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "Gujarat",
      pincode: customer.pincode || "",
      salesPersonId: (customer.salesPersonId || customer.assignedSalespersonId || "").trim(),
    };
  }, [customer]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [username, setUsername] = useState<string>(customer.username || "");
  const [salespersons, setSalespersons] = useState<AllocatedSalespersonInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUpGst, setLookingUpGst] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load active salespersons
  useEffect(() => {
    fetchActiveSalespersonsList()
      .then(setSalespersons)
      .catch(() => setSalespersons([]));
  }, []);

  // Fetch username from users/{id} if missing on customer
  useEffect(() => {
    if (!username && customer.id) {
      getDoc(doc(db, "users", customer.id))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const u = (data.username || data.loginUsername || "").toString().trim();
            if (u) setUsername(u);
          }
        })
        .catch(() => {});
    }
  }, [customer.id, username]);

  // Form field updater
  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const val = key === "creditLimit" ? Number(e.target.value) || 0 : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  // Check if form has changed from initial values
  const isDirty = useMemo(() => {
    return (
      form.name.trim() !== initialForm.name.trim() ||
      form.companyName.trim() !== initialForm.companyName.trim() ||
      form.category !== initialForm.category ||
      form.priceTier !== initialForm.priceTier ||
      Number(form.creditLimit) !== Number(initialForm.creditLimit) ||
      form.paymentTerms.trim() !== initialForm.paymentTerms.trim() ||
      form.email.trim() !== initialForm.email.trim() ||
      form.gstNumber.trim().toUpperCase() !== initialForm.gstNumber.trim().toUpperCase() ||
      form.address.trim() !== initialForm.address.trim() ||
      form.city.trim() !== initialForm.city.trim() ||
      form.state.trim() !== initialForm.state.trim() ||
      form.pincode.trim() !== initialForm.pincode.trim() ||
      form.salesPersonId.trim() !== initialForm.salesPersonId.trim()
    );
  }, [form, initialForm]);

  const handleGstChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
    setForm((f) => ({ ...f, gstNumber: val }));
    if (val.length === 15 && GSTIN_PATTERN.test(val)) {
      triggerGstLookup(val);
    }
  };

  const triggerGstLookup = async (gstin: string) => {
    if (lookingUpGst) return;
    setLookingUpGst(true);
    try {
      const res = await lookupGstDetails(gstin);
      if (res && res.success) {
        setForm((f) => ({
          ...f,
          companyName: (f.companyName || "").trim() ? f.companyName : (res.companyName || f.companyName),
          address: (f.address || "").trim() ? f.address : (res.address || f.address),
          city: (f.city || "").trim() ? f.city : (res.city || f.city),
          state: (f.state || "").trim() && f.state !== "Gujarat" ? f.state : (res.state || f.state),
          pincode: (f.pincode || "").trim() ? f.pincode : (res.pincode || f.pincode),
        }));
      }
    } catch (_) {
      // Non-blocking autofill
    } finally {
      setLookingUpGst(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError("Only administrators and managers can edit customer profiles.");
      return;
    }
    if (submitting) return;

    setError("");
    setSuccessMsg("");

    if (!form.name.trim()) return setError("Customer name is required.");

    const gst = form.gstNumber.trim().toUpperCase();
    if (!gst) return setError("GST number is required");
    if (gst.length !== 15 || !GSTIN_PATTERN.test(gst)) {
      return setError("Enter a valid 15-character GST number");
    }

    setSubmitting(true);
    try {
      const selectedSp = form.salesPersonId
        ? salespersons.find((s) => s.salesPersonId === form.salesPersonId) || null
        : null;

      const res = await updateCustomerProfile({
        customerId: customer.id,
        name: form.name.trim(),
        companyName: form.companyName.trim() || form.name.trim(),
        category: form.category,
        priceTier: form.priceTier,
        email: form.email.trim(),
        gstNumber: gst,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        salesperson: selectedSp
          ? {
              salesPersonId: selectedSp.salesPersonId,
              name: selectedSp.name,
              phone: selectedSp.phone,
              referralCode: selectedSp.referralCode,
            }
          : null,
        creditLimit: Number(form.creditLimit) || 0,
        paymentTerms: form.paymentTerms,
        updatedBy: user?.userId || "admin",
        updatedByName: user?.name || "Admin",
        updatedByRole: role || "admin",
      });

      if (!res.success) {
        setError(res.error || "Failed to update customer profile.");
        setSubmitting(false);
        return;
      }

      setSuccessMsg("Customer updated");

      const catLabel = (form.category.charAt(0).toUpperCase() +
        form.category.slice(1).toLowerCase()) as Customer["category"];

      const updatedCustomer: Customer = {
        ...customer,
        name: form.name.trim(),
        companyName: form.companyName.trim() || form.name.trim(),
        category: catLabel,
        priceTier: form.priceTier,
        email: form.email.trim(),
        gstNumber: gst,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        creditLimit: Number(form.creditLimit) || 0,
        paymentTerms: form.paymentTerms,
        salesPersonId: selectedSp?.salesPersonId || "",
        assignedSalespersonId: selectedSp?.salesPersonId || "",
        salespersonName: selectedSp?.name || undefined,
        salespersonPhone: selectedSp?.phone || undefined,
        salespersonReferralCode: selectedSp?.referralCode || undefined,
        updatedAt: new Date().toISOString(),
      };

      if (onUpdated) onUpdated(updatedCustomer);
      if (onSaved) onSaved(updatedCustomer);

      // Close modal smoothly after brief feedback
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while saving.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2">
            <Pencil className="w-5 h-5 text-[#0E274D]" />
            <h2 className="text-base font-bold text-slate-900 truncate max-w-md">
              Edit Customer — {customer.companyName || customer.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* READ-ONLY / Identity Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Identity & System Authentication (Read-Only)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Customer ID</label>
                <input
                  className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed font-mono`}
                  value={customer.customerNumber || customer.id}
                  disabled
                  readOnly
                />
              </div>
              <div>
                <label className={labelCls}>Mobile Number</label>
                <input
                  className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed font-medium`}
                  value={customer.phone}
                  disabled
                  readOnly
                />
                <p className="text-[10px] text-amber-700 font-medium mt-1">
                  Mobile number is the login ID and can&apos;t be changed here
                </p>
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input
                  className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed font-mono`}
                  value={username || "—"}
                  disabled
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* EDITABLE Fields (same layout as Add New Customer) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Customer Name *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={set("name")}
                placeholder="Full name"
                required
              />
            </div>

            <div>
              <label className={labelCls}>Firm / Company</label>
              <input
                className={inputCls}
                value={form.companyName}
                onChange={set("companyName")}
                placeholder="Business name"
              />
            </div>

            <div>
              <label className={labelCls}>Category *</label>
              <select className={inputCls} value={form.category} onChange={set("category")}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Price Tier *</label>
              <select
                className={inputCls}
                value={form.priceTier}
                onChange={(e) => setForm((f) => ({ ...f, priceTier: e.target.value as "A" | "B" | "C" }))}
              >
                <option value="A">Price Tier A (High Volume)</option>
                <option value="B">Price Tier B (Standard Commercial)</option>
                <option value="C">Price Tier C (Retail / Walk-in)</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Credit Limit (₹) *</label>
              <input
                type="number"
                min="0"
                step="50000"
                className={inputCls}
                value={form.creditLimit}
                onChange={set("creditLimit")}
                required
              />
            </div>

            <div>
              <label className={labelCls}>Payment Terms *</label>
              <select className={inputCls} value={form.paymentTerms} onChange={set("paymentTerms")}>
                {PAYMENT_TERM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Email</label>
              <input
                className={inputCls}
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="contact@example.com"
              />
            </div>

            <div>
              <label className={labelCls}>GST Number *</label>
              <div className="relative">
                <input
                  className={`${inputCls} uppercase font-mono`}
                  value={form.gstNumber}
                  maxLength={15}
                  onChange={handleGstChange}
                  onBlur={() => {
                    if (form.gstNumber && form.gstNumber.length === 15 && GSTIN_PATTERN.test(form.gstNumber)) {
                      triggerGstLookup(form.gstNumber);
                    }
                  }}
                  placeholder="e.g. 24AAAFT2820R1Z0"
                  required
                />
                {lookingUpGst && (
                  <span className="absolute right-3 top-2.5 text-[10px] text-blue-600 font-semibold animate-pulse">
                    Auto-filling…
                  </span>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Address</label>
              <input
                className={inputCls}
                value={form.address}
                onChange={set("address")}
                placeholder="Street / area"
              />
            </div>

            <div>
              <label className={labelCls}>City</label>
              <input className={inputCls} value={form.city} onChange={set("city")} />
            </div>

            <div>
              <label className={labelCls}>State</label>
              <input className={inputCls} value={form.state} onChange={set("state")} />
            </div>

            <div>
              <label className={labelCls}>Pincode</label>
              <input
                className={inputCls}
                value={form.pincode}
                onChange={set("pincode")}
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            <div>
              <label className={labelCls}>Allocated Salesperson</label>
              <select className={inputCls} value={form.salesPersonId} onChange={set("salesPersonId")}>
                <option value="">-- Unallocated / None --</option>
                {salespersons.map((s) => (
                  <option key={s.salesPersonId} value={s.salesPersonId}>
                    {s.name}
                    {s.referralCode ? ` (${s.referralCode})` : ""}
                    {s.phone ? ` • ${s.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isDirty || submitting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0E274D] hover:bg-[#1A3A6D] rounded-lg shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-1" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

