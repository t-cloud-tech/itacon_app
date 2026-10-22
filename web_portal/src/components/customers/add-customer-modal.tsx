"use client";

import React, { useEffect, useState } from "react";
import { X, Copy, Check, UserPlus, KeyRound } from "lucide-react";
import {
  createCustomerByStaff,
  fetchActiveSalespersonsList,
  AllocatedSalespersonInfo,
  CreatedCustomerCredentials,
  NewCustomerInput,
} from "@/lib/customer-service";
import { UserRole } from "@/types";

const CATEGORIES = [
  { id: "dealer", label: "Tile Dealer / Showroom" },
  { id: "architect", label: "Architect / Interior Designer" },
  { id: "builder", label: "Builder / Contractor" },
  { id: "wholesaler", label: "Wholesaler / Distributor" },
  { id: "retailer", label: "Retailer" },
  { id: "trader", label: "Trader" },
];

const EMPTY: NewCustomerInput = {
  name: "",
  companyName: "",
  category: "dealer",
  phone: "",
  email: "",
  gstNumber: "",
  address: "",
  city: "",
  state: "Gujarat",
  pincode: "",
  salesPersonId: "",
  username: "",
  password: "",
};

interface Props {
  role: UserRole | null;
  onClose: () => void;
  onCreated: () => void;
}

const inputCls =
  "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

function friendlyError(err: unknown): string {
  const e = err as { message?: string };
  // Callable errors arrive as "functions/..." codes with the server message; keep the message only.
  return (e?.message || "Could not create the customer. Please try again.").replace(/^.*?:\s*(?=[A-Z])/, "");
}

export function AddCustomerModal({ role, onClose, onCreated }: Props) {
  const isAdmin = role === "admin" || role === "manager";
  const [form, setForm] = useState<NewCustomerInput>(EMPTY);
  const [salespersons, setSalespersons] = useState<AllocatedSalespersonInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedCustomerCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetchActiveSalespersonsList().then(setSalespersons).catch(() => setSalespersons([]));
  }, [isAdmin]);

  const set = (key: keyof NewCustomerInput) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Customer name is required.");
    if (form.phone.replace(/\D/g, "").length < 10) return setError("Enter a valid 10-digit mobile number.");
    if (isAdmin && !form.salesPersonId) return setError("Please assign a salesperson.");

    setSubmitting(true);
    try {
      const result = await createCustomerByStaff(form);
      setCreated(result);
      onCreated();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = async () => {
    if (!created) return;
    const text = `ITACON GRANITO app login\nUsername: ${created.username}\nPassword: ${created.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — credentials remain visible on screen */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-[#0E274D]" />
            <h2 className="text-base font-bold text-slate-900">
              {created ? "Customer Created" : "Add New Customer"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {created ? (
          <div className="p-6 space-y-5">
            <p className="text-sm text-slate-600">
              The account is ready and allocated to <b>{created.salespersonName}</b>. Share these login details with
              the customer — the password is shown only once.
            </p>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-800 text-xs font-bold uppercase tracking-wide">
                <KeyRound className="w-4 h-4" />
                <span>App Login Credentials</span>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Username</p>
                <p className="font-mono text-base font-bold text-slate-900 select-all">{created.username}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Password</p>
                <p className="font-mono text-base font-bold text-slate-900 select-all">{created.password}</p>
              </div>
              <p className="text-[11px] text-slate-500">
                The customer signs in on the ITACON app with their mobile number OTP followed by these credentials.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={copyCredentials}
                className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied" : "Copy credentials"}</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0E274D] hover:bg-[#0A1D3A] rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Customer Name *</label>
                <input className={inputCls} value={form.name} onChange={set("name")} placeholder="Full name" />
              </div>
              <div>
                <label className={labelCls}>Firm / Company</label>
                <input className={inputCls} value={form.companyName} onChange={set("companyName")} placeholder="Business name" />
              </div>
              <div>
                <label className={labelCls}>Category *</label>
                <select className={inputCls} value={form.category} onChange={set("category")}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Mobile Number *</label>
                <input className={inputCls} value={form.phone} onChange={set("phone")} placeholder="10-digit mobile" inputMode="tel" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={form.email} onChange={set("email")} placeholder="Optional" />
              </div>
              <div>
                <label className={labelCls}>GST Number</label>
                <input className={inputCls} value={form.gstNumber} onChange={set("gstNumber")} placeholder="Optional" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Address</label>
                <input className={inputCls} value={form.address} onChange={set("address")} placeholder="Street / area" />
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
                <input className={inputCls} value={form.pincode} onChange={set("pincode")} inputMode="numeric" />
              </div>
              <div>
                <label className={labelCls}>Allocated Salesperson {isAdmin ? "*" : ""}</label>
                {isAdmin ? (
                  <select className={inputCls} value={form.salesPersonId} onChange={set("salesPersonId")}>
                    <option value="">Select salesperson…</option>
                    {salespersons.map((s) => (
                      <option key={s.salesPersonId} value={s.salesPersonId}>
                        {s.name}{s.referralCode ? ` (${s.referralCode})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className={`${inputCls} bg-slate-50`} value="You (auto-assigned)" disabled readOnly />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-700 mb-1">Login credentials</p>
              <p className="text-[11px] text-slate-500 mb-3">
                Leave blank to auto-generate a unique username and a strong password.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Username</label>
                  <input className={inputCls} value={form.username} onChange={set("username")} placeholder="Auto-generate" autoComplete="off" />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input className={inputCls} value={form.password} onChange={set("password")} placeholder="Auto-generate" autoComplete="off" />
                </div>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#E66A23] hover:bg-[#D95D16] rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Customer"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
