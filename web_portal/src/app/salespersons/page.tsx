"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { 
  fetchLiveSalespersonsWithMetrics,
  fetchSalespersonDetailedActivity,
  createSalespersonAccount,
  generateSalespersonIdentifiers,
  toggleSalespersonStatus,
  resetSalespersonPassword,
  SalespersonPerformanceMetrics,
  SalespersonDetailData,
  NewSalespersonInput
} from "@/lib/salesperson-service";
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  TrendingUp, 
  ShoppingBag, 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  X, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  RefreshCw, 
  BadgePercent, 
  Layers, 
  Building2,
  ArrowUpRight,
  Filter,
  UserCheck,
  KeyRound
} from "lucide-react";

export default function SalespersonsPage() {
  const { user, role } = useAuth();

  // State: Salespersons list & loading
  const [salespersons, setSalespersons] = useState<SalespersonPerformanceMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // State: Detail Drawer / Modal
  const [selectedSp, setSelectedSp] = useState<SalespersonPerformanceMetrics | null>(null);
  const [detailData, setDetailData] = useState<SalespersonDetailData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"orders" | "quotations" | "clients" | "settings">("orders");

  // State: Add Salesperson Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    referralCode: string;
    employeeId: string;
  } | null>(null);

  // Form inputs
  const [newForm, setNewForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    employeeId: "",
    referralCode: "",
    region: "Western Region",
    states: "GJ",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // State: Reset Password within drawer
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);

  // Load live salespersons data
  const loadSalespersons = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLiveSalespersonsWithMetrics();
      setSalespersons(data);
      setLastRefreshed(new Date());

      // If a salesperson was selected, refresh their details too
      if (selectedSp) {
        const updatedSelected = data.find((s) => s.salesPersonId === selectedSp.salesPersonId);
        if (updatedSelected) {
          setSelectedSp(updatedSelected);
        }
      }
    } catch (err) {
      console.error("Failed to load salespersons:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSp]);

  useEffect(() => {
    loadSalespersons();
  }, []);

  // When a salesperson is clicked, fetch their detailed activity
  const handleSelectSalesperson = async (sp: SalespersonPerformanceMetrics) => {
    setSelectedSp(sp);
    setIsLoadingDetail(true);
    setActiveDetailTab("orders");
    setResetSuccessMsg(null);
    setResetErrorMsg(null);
    setResetPasswordInput("");
    try {
      const details = await fetchSalespersonDetailedActivity(sp);
      setDetailData(details);
    } catch (err) {
      console.error("Failed to load salesperson details:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (sp: SalespersonPerformanceMetrics, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = sp.status === "active" ? "inactive" : "active";
    const ok = await toggleSalespersonStatus(sp.salesPersonId, newStatus);
    if (ok) {
      setSalespersons((prev) =>
        prev.map((s) => (s.salesPersonId === sp.salesPersonId ? { ...s, status: newStatus } : s))
      );
      if (selectedSp?.salesPersonId === sp.salesPersonId) {
        setSelectedSp((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    }
  };

  // Handle salesperson password update from drawer
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSp) return;
    setResetSuccessMsg(null);
    setResetErrorMsg(null);
    setIsResettingPassword(true);

    try {
      const res = await resetSalespersonPassword(selectedSp.salesPersonId, resetPasswordInput.trim());
      if (!res.success) {
        throw new Error(res.error || "Failed to update password.");
      }
      setResetSuccessMsg(`Password successfully updated! They can now log in using password: "${resetPasswordInput.trim()}".`);
      setResetPasswordInput("");
    } catch (err: any) {
      setResetErrorMsg(err.message || "Failed to update password.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Employee ID ("SE IGPL-001") and Referral Code ("SALES-001") are auto-generated; preview them when the modal opens
  useEffect(() => {
    if (!isAddModalOpen) return;
    generateSalespersonIdentifiers()
      .then((ids) => setNewForm((prev) => ({ ...prev, ...ids })))
      .catch((err) => console.warn("Could not preview salesperson IDs:", err));
  }, [isAddModalOpen]);

  const handleNameChange = (name: string) => {
    setNewForm((prev) => ({ ...prev, name }));
  };

  // Handle Create Salesperson Form Submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const statesArray = newForm.states
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const payload: NewSalespersonInput = {
        name: newForm.name,
        email: newForm.email,
        phone: newForm.phone,
        password: newForm.password,
        employeeId: newForm.employeeId,
        referralCode: newForm.referralCode,
        region: newForm.region || "Western Region",
        states: statesArray.length > 0 ? statesArray : ["GJ"],
      };

      const res = await createSalespersonAccount(payload);

      if (!res.success) {
        throw new Error(res.error || "Failed to create salesperson account.");
      }

      // Save credentials for the success modal
      setCreatedCredentials({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        referralCode: res.referralCode || "",
        employeeId: res.employeeId || "",
      });

      // Reload live salespersons list
      await loadSalespersons();

      // Reset form
      setNewForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        employeeId: "",
        referralCode: "",
        region: "Western Region",
        states: "GJ",
      });
    } catch (err: any) {
      setCreateError(err.message || "Failed to create salesperson profile.");
    } finally {
      setIsCreating(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Aggregate Top Metrics
  const summaryMetrics = useMemo(() => {
    const totalTeam = salespersons.length;
    const activeTeam = salespersons.filter((s) => s.status === "active").length;
    const todaySales = salespersons.reduce((acc, s) => acc + s.todaySalesAmount, 0);
    const todayOrders = salespersons.reduce((acc, s) => acc + s.todayOrdersCount, 0);
    const totalSales = salespersons.reduce((acc, s) => acc + s.totalSalesAmount, 0);
    const totalQuotations = salespersons.reduce((acc, s) => acc + s.totalQuotationsCount, 0);

    return { totalTeam, activeTeam, todaySales, todayOrders, totalSales, totalQuotations };
  }, [salespersons]);

  // Unique regions for filter dropdown
  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    salespersons.forEach((s) => {
      if (s.region) set.add(s.region);
    });
    return Array.from(set);
  }, [salespersons]);

  // Filtered Salespersons
  const filteredSalespersons = useMemo(() => {
    return salespersons.filter((sp) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        sp.name.toLowerCase().includes(term) ||
        sp.email.toLowerCase().includes(term) ||
        sp.phone.includes(searchTerm) ||
        sp.referralCode.toLowerCase().includes(term) ||
        sp.employeeId.toLowerCase().includes(term) ||
        sp.region.toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" || sp.status === statusFilter;
      const matchesRegion = regionFilter === "all" || sp.region === regionFilter;

      return matchesSearch && matchesStatus && matchesRegion;
    });
  }, [salespersons, searchTerm, statusFilter, regionFilter]);

  // Access Control: Admin Only
  if (role !== "admin") {
    return (
      <DashboardShell
        title="Access Restricted"
        subtitle="This management portal is exclusively for Super Administrators."
      >
        <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Admin Clearance Required</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            The Salesperson Management interface provides administrative access to staff credentials, team revenue analytics, and account provisioning.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#0E274D] text-white text-sm font-semibold hover:bg-[#1A3868] transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Salesperson Management"
      subtitle="Monitor sales team performance, today's order generation, and onboard new sales executives."
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top KPI Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Sales Team */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sales Team</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl lg:text-3xl font-extrabold text-[#0E274D]">
                {summaryMetrics.totalTeam}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {summaryMetrics.activeTeam} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Active executives across all territories</p>
          </div>

          {/* Card 2: Today's Team Sales */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Team Orders</span>
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl lg:text-3xl font-extrabold text-[#0E274D]">
                ₹{summaryMetrics.todaySales.toLocaleString("en-IN")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>{summaryMetrics.todayOrders} order{summaryMetrics.todayOrders === 1 ? "" : "s"} placed today</span>
            </p>
          </div>

          {/* Card 3: Lifetime Team Sales */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Team Sales</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl lg:text-3xl font-extrabold text-[#0E274D]">
                ₹{summaryMetrics.totalSales.toLocaleString("en-IN")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Cumulative revenue generated by team</p>
          </div>

          {/* Card 4: Active Quotations Pipeline */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quotation Pipeline</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl lg:text-3xl font-extrabold text-[#0E274D]">
                {summaryMetrics.totalQuotations}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Created
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Dealer & customer quotation records</p>
          </div>
        </div>

        {/* Action Header & Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, phone, referral code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D] focus:bg-white transition-all"
            />
          </div>

          {/* Filter Dropdowns & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="all">All ({salespersons.length})</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Region Filter */}
            {uniqueRegions.length > 1 && (
              <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Region:</span>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Territories</option>
                  {uniqueRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Refresh Feed */}
            <button
              onClick={loadSalespersons}
              disabled={isLoading}
              title="Refresh live data"
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#E66A23]" : ""}`} />
            </button>

            {/* Add Salesperson Button */}
            <button
              onClick={() => {
                setCreateError(null);
                setCreatedCredentials(null);
                handleNameChange("");
                setIsAddModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E66A23] to-[#D95D16] hover:from-[#D95D16] hover:to-[#C24E0F] text-white text-sm font-semibold shadow-md shadow-[#E66A23]/25 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New Salesperson</span>
            </button>
          </div>
        </div>

        {/* Salespersons Roster Table / Cards */}
        {isLoading && salespersons.length === 0 ? (
          <div className="p-16 rounded-2xl bg-white border border-slate-200 text-center">
            <div className="w-10 h-10 border-3 border-[#0E274D]/20 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600">Loading sales team records from database...</p>
          </div>
        ) : filteredSalespersons.length === 0 ? (
          <div className="p-16 rounded-2xl bg-white border border-slate-200 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Salespersons Found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              No staff members match the selected search query or filters. Click &quot;Add New Salesperson&quot; to provision a new executive account.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">Salesperson & ID</th>
                    <th className="py-3.5 px-4">Contact & Email</th>
                    <th className="py-3.5 px-4">Referral Code</th>
                    <th className="py-3.5 px-4">Territory / Region</th>
                    <th className="py-3.5 px-4 text-center">Clients</th>
                    <th className="py-3.5 px-4">Today&apos;s Performance</th>
                    <th className="py-3.5 px-4">Lifetime Sales</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSalespersons.map((sp) => {
                    const isSelected = selectedSp?.salesPersonId === sp.salesPersonId;
                    return (
                      <tr
                        key={sp.salesPersonId}
                        onClick={() => handleSelectSalesperson(sp)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected ? "bg-orange-50/40" : ""
                        }`}
                      >
                        {/* Name & ID */}
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0E274D] to-[#1F4176] text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                              {sp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center space-x-2">
                                <span className="hover:text-[#E66A23] transition-colors">{sp.name}</span>
                                {sp.todayOrdersCount > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-[#E66A23] border border-orange-200">
                                    Today Active
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-mono text-slate-500 mt-0.5">
                                {sp.employeeId}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact & Email */}
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <div className="text-xs text-slate-800 font-medium flex items-center space-x-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{sp.email || "No email"}</span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{sp.phone || "No phone"}</span>
                            </div>
                          </div>
                        </td>

                        {/* Referral Code */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-orange-50 text-[#E66A23] border border-orange-200 tracking-wider">
                            {sp.referralCode || "N/A"}
                          </span>
                        </td>

                        {/* Region */}
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-1.5 text-xs text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{sp.region}</span>
                          </div>
                          {sp.states && sp.states.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {sp.states.map((st) => (
                                <span
                                  key={st}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-medium"
                                >
                                  {st}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Assigned Clients */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                            {sp.assignedClientsCount}
                          </span>
                        </td>

                        {/* Today's Sales */}
                        <td className="py-4 px-4">
                          {sp.todayOrdersCount > 0 ? (
                            <div>
                              <div className="font-extrabold text-sm text-[#0E274D]">
                                ₹{sp.todaySalesAmount.toLocaleString("en-IN")}
                              </div>
                              <div className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>{sp.todayOrdersCount} order{sp.todayOrdersCount === 1 ? "" : "s"} today</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">No orders today</div>
                          )}
                        </td>

                        {/* Lifetime Sales */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            ₹{sp.totalSalesAmount.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {sp.totalOrdersCount} total orders • {sp.totalQuotationsCount} quotes
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              sp.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-300"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                sp.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {sp.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* Action CTA */}
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSalesperson(sp);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#0E274D] text-slate-700 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Salesperson Activity Drawer / Modal */}
        {selectedSp && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="p-6 bg-[#0E274D] text-white flex items-start justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#E66A23] to-[#F59E0B] text-white flex items-center justify-center font-extrabold text-2xl shadow-lg shadow-[#E66A23]/30">
                    {selectedSp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-3">
                      <h2 className="text-xl font-bold tracking-tight text-white">{selectedSp.name}</h2>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          selectedSp.status === "active"
                            ? "bg-emerald-900/60 text-emerald-300 border-emerald-500/40"
                            : "bg-slate-800 text-slate-300 border-slate-600"
                        }`}
                      >
                        {selectedSp.status === "active" ? "Active Staff" : "Deactivated"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 flex items-center space-x-3 font-mono">
                      <span>{selectedSp.employeeId}</span>
                      <span>•</span>
                      <span className="text-orange-300">Code: {selectedSp.referralCode}</span>
                      <span>•</span>
                      <span>{selectedSp.region}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSp(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Quick Metrics Grid */}
              <div className="grid grid-cols-4 gap-2 p-4 bg-slate-50 border-b border-slate-200 text-center shrink-0">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Today&apos;s Sales</span>
                  <div className="text-sm font-extrabold text-[#0E274D] mt-0.5">
                    ₹{selectedSp.todaySalesAmount.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    {selectedSp.todayOrdersCount} order{selectedSp.todayOrdersCount === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Sales</span>
                  <div className="text-sm font-extrabold text-[#0E274D] mt-0.5">
                    ₹{selectedSp.totalSalesAmount.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {selectedSp.totalOrdersCount} orders
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quotations</span>
                  <div className="text-sm font-extrabold text-[#0E274D] mt-0.5">
                    {selectedSp.totalQuotationsCount}
                  </div>
                  <div className="text-[10px] text-slate-500">Drafted</div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Clients</span>
                  <div className="text-sm font-extrabold text-[#0E274D] mt-0.5">
                    {selectedSp.assignedClientsCount}
                  </div>
                  <div className="text-[10px] text-emerald-600">Assigned</div>
                </div>
              </div>

              {/* Detail Navigation Tabs */}
              <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
                <button
                  onClick={() => setActiveDetailTab("orders")}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeDetailTab === "orders"
                      ? "border-[#E66A23] text-[#E66A23]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Orders & Sales ({detailData?.allOrders.length || 0})
                </button>
                <button
                  onClick={() => setActiveDetailTab("quotations")}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeDetailTab === "quotations"
                      ? "border-[#E66A23] text-[#E66A23]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Quotations ({detailData?.allQuotations.length || 0})
                </button>
                <button
                  onClick={() => setActiveDetailTab("clients")}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeDetailTab === "clients"
                      ? "border-[#E66A23] text-[#E66A23]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Assigned Clients ({detailData?.assignedClients.length || 0})
                </button>
                <button
                  onClick={() => setActiveDetailTab("settings")}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeDetailTab === "settings"
                      ? "border-[#E66A23] text-[#E66A23]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Profile & Settings
                </button>
              </div>

              {/* Detail Content Body */}
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                {isLoadingDetail ? (
                  <div className="py-16 text-center">
                    <div className="w-8 h-8 border-2 border-[#0E274D]/20 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-slate-500">Loading salesperson activity and orders...</p>
                  </div>
                ) : (
                  <>
                    {/* Tab 1: Orders */}
                    {activeDetailTab === "orders" && (
                      <div className="space-y-4">
                        {/* Highlight today's orders if any */}
                        {detailData && detailData.todayOrders.length > 0 && (
                          <div className="p-4 rounded-xl bg-orange-50/80 border border-orange-200">
                            <div className="flex items-center space-x-2 text-xs font-bold text-[#E66A23] uppercase tracking-wider mb-2">
                              <ShoppingBag className="w-4 h-4" />
                              <span>Today&apos;s Active Generation ({detailData.todayOrders.length})</span>
                            </div>
                            <div className="space-y-2">
                              {detailData.todayOrders.map((ord: any) => (
                                <div
                                  key={ord.id}
                                  className="p-3 bg-white rounded-lg border border-orange-200/80 shadow-xs flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-bold text-sm text-slate-900">
                                      {ord.poNumber || ord.orderReference || ord.orderNumber || ord.id}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {ord.customerName || ord.companyName || "Client"}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-extrabold text-sm text-[#0E274D]">
                                      ₹{(ord.grandTotal || ord.totalAmount || 0).toLocaleString("en-IN")}
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                                      Today
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* All Orders List */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Historical Orders Portfolio
                          </h4>
                          {detailData && detailData.allOrders.length === 0 ? (
                            <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                              No orders recorded for this salesperson yet.
                            </div>
                          ) : (
                            detailData?.allOrders.map((ord: any) => (
                              <div
                                key={ord.id}
                                className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors"
                              >
                                <div>
                                  <div className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                                    <span>{ord.poNumber || ord.orderReference || ord.orderNumber || ord.id}</span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                      {ord.status || "confirmed"}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {ord.customerName || ord.companyName || "Client"} •{" "}
                                    {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : "Recent"}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-extrabold text-sm text-slate-900">
                                    ₹{(ord.grandTotal || ord.totalAmount || ord.subtotal || 0).toLocaleString("en-IN")}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {ord.items?.length || 1} item(s)
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Quotations */}
                    {activeDetailTab === "quotations" && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Quotations Issued
                        </h4>
                        {detailData && detailData.allQuotations.length === 0 ? (
                          <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                            No quotations issued by this salesperson yet.
                          </div>
                        ) : (
                          detailData?.allQuotations.map((q) => (
                            <div
                              key={q.id}
                              className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between"
                            >
                              <div>
                                <div className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                                  <span>{q.quotationNumber}</span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    {q.status}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {q.customerName} • Validity: {q.validityDays || 30} days
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-extrabold text-sm text-slate-900">
                                  ₹{(q.grandTotal || 0).toLocaleString("en-IN")}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : ""}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Tab 3: Assigned Clients */}
                    {activeDetailTab === "clients" && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Registered Dealers & Clients
                        </h4>
                        {detailData && detailData.assignedClients.length === 0 ? (
                          <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                            No clients directly assigned to this referral code yet.
                          </div>
                        ) : (
                          detailData?.assignedClients.map((c) => (
                            <div
                              key={c.id}
                              className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                                  <Building2 className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                  <div className="font-bold text-sm text-slate-900">
                                    {c.companyName || c.name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {c.name} • {c.phone}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {c.category}
                                </span>
                                <div className="text-xs text-slate-400 mt-1">{c.city}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Tab 4: Profile & Settings */}
                    {activeDetailTab === "settings" && (
                      <div className="space-y-6">
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Staff Profile Details
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-slate-400">Full Name:</span>
                              <div className="font-bold text-slate-900 mt-0.5">{selectedSp.name}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">Employee ID:</span>
                              <div className="font-mono font-bold text-slate-900 mt-0.5">
                                {selectedSp.employeeId}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400">Login Email:</span>
                              <div className="font-semibold text-slate-900 mt-0.5">{selectedSp.email}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">Mobile Phone:</span>
                              <div className="font-semibold text-slate-900 mt-0.5">{selectedSp.phone}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">Referral Code:</span>
                              <div className="font-mono font-bold text-[#E66A23] mt-0.5">
                                {selectedSp.referralCode}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400">Assigned Region:</span>
                              <div className="font-semibold text-slate-900 mt-0.5">{selectedSp.region}</div>
                            </div>
                          </div>
                        </div>

                        {/* Account Access Switch */}
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-sm text-slate-900">Account Access Status</div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {selectedSp.status === "active"
                                ? "This salesperson can actively sign in and manage customer orders."
                                : "Access is suspended. The executive cannot log in to the portal."}
                            </p>
                          </div>
                          <button
                            onClick={() => handleToggleStatus(selectedSp)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              selectedSp.status === "active"
                                ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                            }`}
                          >
                            {selectedSp.status === "active" ? "Deactivate Account" : "Activate Account"}
                          </button>
                        </div>

                        {/* Password Management Card */}
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#E66A23] flex items-center justify-center">
                              <KeyRound className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-900">Reset Salesperson Password</h4>
                              <p className="text-xs text-slate-500">
                                Set a new login password for {selectedSp.name}. They will immediately be able to sign in with it.
                              </p>
                            </div>
                          </div>

                          {resetSuccessMsg && (
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start space-x-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{resetSuccessMsg}</span>
                            </div>
                          )}

                          {resetErrorMsg && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <span>{resetErrorMsg}</span>
                            </div>
                          )}

                          <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                            <div className="relative">
                              <input
                                type={showResetPassword ? "text" : "password"}
                                required
                                minLength={6}
                                placeholder="Enter new password (min. 6 chars)"
                                value={resetPasswordInput}
                                onChange={(e) => setResetPasswordInput(e.target.value)}
                                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowResetPassword(!showResetPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <button
                              type="submit"
                              disabled={isResettingPassword || !resetPasswordInput}
                              className="px-4 py-2 bg-[#0E274D] hover:bg-[#1A3868] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isResettingPassword ? "Updating Password..." : "Update Login Password"}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add New Salesperson Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-6 bg-[#0E274D] text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E66A23] to-[#F59E0B] text-white flex items-center justify-center shadow-md">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">Add New Salesperson</h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Provision credentials so they can log in with their email &amp; password
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form or Success State */}
              {createdCredentials ? (
                <div className="p-6 text-center space-y-5">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold text-slate-900">Salesperson Registered!</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Profile created successfully. The executive can now immediately log in at the login screen using these credentials:
                    </p>
                  </div>

                  {/* Credentials Box */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2.5 max-w-md mx-auto">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Name:</span>
                      <span className="font-bold text-slate-900">{createdCredentials.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Login Email:</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900">{createdCredentials.email}</span>
                        <button
                          onClick={() => handleCopy(createdCredentials.email, "email")}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {copiedKey === "email" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Login Password:</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[#E66A23]">{createdCredentials.password}</span>
                        <button
                          onClick={() => handleCopy(createdCredentials.password, "pass")}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {copiedKey === "pass" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-500 font-medium">Referral Code:</span>
                      <span className="font-mono font-extrabold text-[#0E274D] bg-orange-100/70 px-2 py-0.5 rounded">
                        {createdCredentials.referralCode}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-center space-x-3">
                    <button
                      onClick={() => {
                        const summary = `ITACON Staff Credentials:\nPortal: https://itacon-app.firebaseapp.com\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nReferral Code: ${createdCredentials.referralCode}`;
                        handleCopy(summary, "all");
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-1.5 cursor-pointer"
                    >
                      {copiedKey === "all" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedKey === "all" ? "Copied All!" : "Copy All Credentials"}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setCreatedCredentials(null);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#0E274D] text-white text-xs font-bold hover:bg-[#1A3868] cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                  {/* Instructions */}
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 leading-relaxed flex items-start space-x-2.5">
                    <UserCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Instant Access Provisioning:</strong> Setting up this profile will allow the salesperson to immediately log in at the portal login screen with this email and password.
                    </div>
                  </div>

                  {/* Error Notification */}
                  {createError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{createError}</span>
                    </div>
                  )}

                  {/* Field: Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={newForm.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                    />
                  </div>

                  {/* Field: Email & Phone Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Work Email (Login ID) *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="rahul.sharma@itacon.com"
                        value={newForm.email}
                        onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mobile Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="9876543210"
                        value={newForm.phone}
                        onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                      />
                    </div>
                  </div>

                  {/* Field: Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Initial Login Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        placeholder="Minimum 6 characters"
                        value={newForm.password}
                        onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Field: Employee ID & Referral Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Employee ID
                      </label>
                      <input
                        type="text"
                        readOnly
                        placeholder="Generating..."
                        value={newForm.employeeId}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Referral Code
                      </label>
                      <input
                        type="text"
                        readOnly
                        placeholder="Generating..."
                        value={newForm.referralCode}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                      />
                    </div>
                  </div>

                  {/* Field: Region & States */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Sales Region / Territory
                      </label>
                      <input
                        type="text"
                        placeholder="Western Region"
                        value={newForm.region}
                        onChange={(e) => setNewForm({ ...newForm, region: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        States (comma separated)
                      </label>
                      <input
                        type="text"
                        placeholder="GJ, MH"
                        value={newForm.states}
                        onChange={(e) => setNewForm({ ...newForm, states: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      disabled={isCreating}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-5 py-2.5 rounded-xl bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-bold shadow-md shadow-[#E66A23]/25 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      {isCreating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <span>Create Salesperson Account</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
