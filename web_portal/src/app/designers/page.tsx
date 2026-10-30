"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDesigners,
  fetchDesignerTiles,
  createDesignerAccount,
  resetDesignerPassword,
  toggleDesignerStatus,
  DesignerRecord,
  DesignerTile,
} from "@/lib/designer-service";
import { generateDesignerEmployeeId } from "@/lib/salesperson-service";
import {
  Palette,
  UserPlus,
  Search,
  Phone,
  Mail,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Grid3X3,
  ShieldAlert,
} from "lucide-react";

const inputCls =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
  employeeId: "",
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function DesignersPage() {
  const { role } = useAuth();

  const [designers, setDesigners] = useState<DesignerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Detail drawer
  const [selected, setSelected] = useState<DesignerRecord | null>(null);
  const [tiles, setTiles] = useState<DesignerTile[]>([]);
  const [isLoadingTiles, setIsLoadingTiles] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Add designer modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; email: string; password: string; employeeId: string } | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setDesigners(await fetchDesigners());
    } catch (err: any) {
      console.error("Failed to load designers:", err);
      setLoadError(err?.message || "Could not load designers.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === "admin") load();
  }, [role, load]);

  // Preview the auto-generated Employee ID ("DD IGPL-001") when the add modal opens
  useEffect(() => {
    if (!isAddOpen) return;
    generateDesignerEmployeeId()
      .then((employeeId) => setForm((prev) => ({ ...prev, employeeId })))
      .catch((err) => console.warn("Could not preview designer ID:", err));
  }, [isAddOpen]);

  const openDetail = async (d: DesignerRecord) => {
    setSelected(d);
    setTiles([]);
    setResetPassword("");
    setResetMsg(null);
    setIsLoadingTiles(true);
    try {
      setTiles(await fetchDesignerTiles(d.designerId));
    } catch (err) {
      console.warn("Could not load designer tiles:", err);
    } finally {
      setIsLoadingTiles(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selected) return;
    const next = selected.status === "active" ? "inactive" : "active";
    setIsToggling(true);
    const ok = await toggleDesignerStatus(selected.designerId, next);
    setIsToggling(false);
    if (!ok) {
      setResetMsg({ ok: false, text: "Could not update status. Please try again." });
      return;
    }
    setSelected({ ...selected, status: next });
    setDesigners((prev) => prev.map((d) => (d.designerId === selected.designerId ? { ...d, status: next } : d)));
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setResetMsg(null);
    setIsResetting(true);
    const res = await resetDesignerPassword(selected.designerId, resetPassword.trim());
    setIsResetting(false);
    if (res.success) {
      setResetMsg({ ok: true, text: "Password updated. The designer can log in with the new password now." });
      setResetPassword("");
    } else {
      setResetMsg({ ok: false, text: res.error || "Failed to update password." });
    }
  };

  // Employee ID ("DD IGPL-001") is auto-generated on create
  const handleNameChange = (name: string) => setForm((prev) => ({ ...prev, name }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    const res = await createDesignerAccount({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      employeeId: form.employeeId,
    });
    setIsCreating(false);
    if (!res.success) {
      setCreateError(res.error || "Failed to create designer.");
      return;
    }
    setCreated({ name: form.name, email: form.email.trim().toLowerCase(), password: form.password, employeeId: res.employeeId || "" });
    setForm(EMPTY_FORM);
    await load();
  };

  const closeAdd = () => {
    setIsAddOpen(false);
    setCreated(null);
    setCreateError(null);
    setShowPassword(false);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return designers.filter((d) => {
      const matches =
        d.name.toLowerCase().includes(term) ||
        d.email.toLowerCase().includes(term) ||
        d.phone.includes(searchTerm) ||
        d.employeeId.toLowerCase().includes(term);
      return matches && (statusFilter === "all" || d.status === statusFilter);
    });
  }, [designers, searchTerm, statusFilter]);

  if (role !== "admin") {
    return (
      <DashboardShell title="Access Restricted" subtitle="This page is exclusively for Super Administrators.">
        <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Admin Clearance Required</h2>
        </div>
      </DashboardShell>
    );
  }

  const activeCount = designers.filter((d) => d.status === "active").length;
  const totalTiles = designers.reduce((acc, d) => acc + d.tilesAdded, 0);

  return (
    <DashboardShell
      title="Designer Management"
      subtitle="View the designers on the platform, track their catalogue work, and onboard new designers."
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { label: "Total Designers", value: designers.length },
            { label: "Active Designers", value: activeCount },
            { label: "Tiles Published", value: totalTiles },
          ].map((m) => (
            <div key={m.label} className="card-luxury p-5">
              <p className="text-xs text-slate-500 font-medium">{m.label}</p>
              <p className="text-2xl font-black text-[#0E274D] mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 max-w-xl">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, email, phone or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#E66A23] to-[#F59E0B] text-white text-sm font-bold rounded-lg shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Designer</span>
            </button>
          </div>
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* List */}
        <div className="card-luxury overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">Designer</th>
                  <th className="py-3 px-4 font-semibold">Contact</th>
                  <th className="py-3 px-4 font-semibold text-center">Tiles Added</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <tr key={d.designerId} onClick={() => openDetail(d)} className="hover:bg-orange-50/40 cursor-pointer">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#E66A23]/15 border border-[#E66A23]/30 flex items-center justify-center font-bold text-sm text-[#E66A23] shrink-0">
                          {d.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0E274D]">{d.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {d.employeeId && <span className="font-mono">{d.employeeId}</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {d.email || "—"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {d.phone || "—"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                        {d.tilesAdded}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          d.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-300"
                        }`}
                      >
                        {d.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-10">
              {designers.length === 0 ? "No designers on the platform yet. Use “Add Designer” to onboard one." : "No designers match your search."}
            </p>
          )}
          {isLoading && <p className="text-sm text-slate-500 text-center py-10">Loading designers...</p>}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 bg-[#0E274D] text-white flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#E66A23]/25 border border-[#E66A23]/50 flex items-center justify-center font-bold text-lg text-orange-300">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{selected.name}</h2>
                  <p className="text-xs text-slate-300 font-mono">{selected.employeeId}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Employee ID", selected.employeeId || "—"],
                  ["Status", selected.status === "active" ? "Active" : "Inactive"],
                  ["Email", selected.email || "—"],
                  ["Phone", selected.phone || "—"],
                  ["Joined", formatDate(selected.createdAt)],
                  ["Last tile added", formatDate(selected.lastTileAt)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[11px] uppercase font-semibold text-slate-400">{k}</p>
                    <p className="font-semibold text-slate-800 break-all">{v}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-2">
                  <Grid3X3 className="w-4 h-4 text-[#E66A23]" />
                  Tiles added ({tiles.length})
                </h3>
                {isLoadingTiles && <p className="text-xs text-slate-500">Loading...</p>}
                {!isLoadingTiles && tiles.length === 0 && <p className="text-xs text-slate-400">No tiles published yet.</p>}
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl max-h-64 overflow-y-auto">
                  {tiles.map((t) => (
                    <div key={t.id} className="px-3 py-2 flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                        <p className="text-slate-500 font-mono">
                          {t.sku}
                          {t.size ? ` · ${t.size}` : ""}
                        </p>
                      </div>
                      <span className="text-slate-400 shrink-0 ml-3">{formatDate(t.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#E66A23]" />
                  Account
                </h3>
                {resetMsg && (
                  <div
                    className={`p-3 rounded-lg text-xs ${
                      resetMsg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                  >
                    {resetMsg.text}
                  </div>
                )}
                <form onSubmit={handleReset} className="flex gap-2">
                  <input
                    type="text"
                    minLength={6}
                    required
                    placeholder="New password (min 6 characters)"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="px-4 py-2 rounded-xl bg-[#0E274D] text-white text-xs font-semibold shrink-0 disabled:opacity-60 cursor-pointer"
                  >
                    {isResetting ? "Saving..." : "Reset"}
                  </button>
                </form>
                <button
                  onClick={handleToggleStatus}
                  disabled={isToggling}
                  className={`w-full px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-60 ${
                    selected.status === "active"
                      ? "border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100"
                      : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  }`}
                >
                  {selected.status === "active" ? "Deactivate designer" : "Activate designer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add designer modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-5 bg-[#0E274D] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E66A23] to-[#F59E0B] flex items-center justify-center">
                  <Palette className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Add New Designer</h2>
                  <p className="text-xs text-slate-300">Creates a login for the Designer Studio</p>
                </div>
              </div>
              <button onClick={closeAdd} className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            {created ? (
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{created.name} was added as a designer.</span>
                </div>
                <p className="text-xs text-slate-500">Share these login details with the designer. The password is not shown again.</p>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
                  {[
                    ["Email", created.email, "email"],
                    ["Password", created.password, "password"],
                    ["Employee ID", created.employeeId, "emp"],
                  ].map(([label, value, key]) => (
                    <div key={key} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase font-semibold text-slate-400">{label}</p>
                        <p className="font-mono font-semibold text-slate-800">{value}</p>
                      </div>
                      <button onClick={() => handleCopy(value, key)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                        {copiedKey === key ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setCreated(null)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Add another
                  </button>
                  <button onClick={closeAdd} className="px-5 py-2 text-sm font-bold text-white bg-[#0E274D] rounded-xl cursor-pointer">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {createError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input required className={inputCls} value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Somil Patel" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
                    <input
                      className={`${inputCls} font-mono`}
                      readOnly
                      value={form.employeeId}
                      placeholder="Generating..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email (login) *</label>
                    <input
                      required
                      type="email"
                      className={inputCls}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="designer@itacongranito.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone *</label>
                    <input
                      required
                      type="tel"
                      className={inputCls}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="10-digit mobile number"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                    <div className="relative">
                      <input
                        required
                        minLength={6}
                        type={showPassword ? "text" : "password"}
                        className={`${inputCls} pr-10`}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="At least 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={closeAdd}
                    disabled={isCreating}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#E66A23] to-[#F59E0B] text-white text-sm font-bold rounded-xl shadow-md shadow-[#E66A23]/25 disabled:opacity-60 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isCreating ? "Creating..." : "Create Designer"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
