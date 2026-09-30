"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { fetchLiveCustomers } from "@/lib/customer-service";
import { Customer } from "@/types";
import { 
  Users, 
  Search, 
  Phone, 
  MapPin, 
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  Building,
  UserCheck
} from "lucide-react";

export default function CustomersPage() {
  const { user, role, salesperson } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadLiveCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLiveCustomers(user, salesperson, role);
      setCustomers(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Could not fetch live customers from Firestore:", err);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, salesperson, role]);

  useEffect(() => {
    loadLiveCustomers();
  }, [loadLiveCustomers]);

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      c.name.toLowerCase().includes(term) ||
      c.companyName.toLowerCase().includes(term) ||
      c.phone.includes(searchTerm) ||
      c.city.toLowerCase().includes(term);

    const matchesCat = categoryFilter === "all" || c.category === categoryFilter;
    const matchesTier = tierFilter === "all" || c.priceTier === tierFilter;

    return matchesSearch && matchesCat && matchesTier;
  });

  return (
    <DashboardShell
      title="Allocated Customers"
      subtitle={
        role === "admin"
          ? "All registered clients and dealers across the ITACON ecosystem"
          : `Live customers allocated to your sales executive account (${salesperson?.referralCode || "SALES101"})`
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Live Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0E274D]/10 text-[#0E274D] flex items-center justify-center">
              <Database className="w-5 h-5 text-[#0E274D]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900">Live Database Feed</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Connected
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {role === "admin"
                  ? `Showing all ${customers.length} registered customers in Firestore`
                  : `Showing ${customers.length} customer${customers.length === 1 ? "" : "s"} allocated to ${user?.name || "you"}`}
                {" • "}
                Refreshed at {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadLiveCustomers}
              disabled={isLoading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#E66A23]" : "text-slate-500"}`} />
              <span>{isLoading ? "Fetching..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by client, firm, phone, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Categories</option>
              <option value="Dealer">Dealer</option>
              <option value="Wholesaler">Wholesaler</option>
              <option value="Builder">Builder / Infra</option>
              <option value="Architect">Architect</option>
              <option value="Contractor">Contractor</option>
              <option value="Retailer">Retailer</option>
            </select>

            {/* Price Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Price Tiers</option>
              <option value="A">Tier A (Wholesale)</option>
              <option value="B">Tier B (Standard)</option>
              <option value="C">Tier C (Retail)</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && customers.length === 0 ? (
          <div className="card-luxury p-12 text-center bg-white rounded-xl border border-slate-200">
            <div className="w-10 h-10 border-3 border-[#0E274D]/20 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-base font-bold text-slate-900">Querying Firestore Database...</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Fetching live customers allocated to your salesperson profile.
            </p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          /* Zero Mock Data Empty State */
          <div className="card-luxury p-12 text-center bg-white rounded-xl border border-slate-200/80">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-[#E66A23] flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {searchTerm || categoryFilter !== "all" || tierFilter !== "all"
                ? "No Matching Customers Found"
                : "No Allocated Customers in Database"}
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              {searchTerm || categoryFilter !== "all" || tierFilter !== "all"
                ? "Try clearing your filters or search keyword to see all allocated clients."
                : `No customers have been allocated to salesperson code (${salesperson?.referralCode || "SALES101"}) yet. When clients register with this code or get auto-allocated from the mobile app, they will appear here live.`}
            </p>

            <div className="mt-6 flex items-center justify-center space-x-3">
              {(searchTerm || categoryFilter !== "all" || tierFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("all");
                    setTierFilter("all");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={loadLiveCustomers}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#E66A23] hover:bg-[#D95D16] rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Re-check Firestore
              </button>
            </div>
          </div>
        ) : (
          /* Live Customer Table */
          <div className="card-luxury overflow-hidden bg-white rounded-xl border border-slate-200/80 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">Customer / Firm</th>
                    <th className="py-3.5 px-5">Contact Details</th>
                    <th className="py-3.5 px-5">Category & Tier</th>
                    <th className="py-3.5 px-5">Credit Terms</th>
                    <th className="py-3.5 px-5">Location</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0E274D] to-[#1A3A6D] text-white font-bold flex items-center justify-center text-sm shadow-sm">
                            {c.companyName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link href={`/customers/${c.id}`} className="font-bold text-[#0E274D] hover:underline">
                              {c.companyName}
                            </Link>
                            <p className="text-xs text-slate-600 font-medium">{c.name}</p>
                            <span className="text-[11px] font-mono text-slate-400">{c.customerNumber}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.phone || "No phone registered"}</span>
                          </div>
                          {c.email && (
                            <div className="text-xs text-slate-400 truncate max-w-[180px]">
                              {c.email}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {c.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Tier {c.priceTier}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="text-xs">
                          <p className="font-bold text-slate-800">
                            ₹{(c.creditLimit / 100000).toFixed(1)}L Limit
                          </p>
                          <p className="text-slate-500 font-medium">{c.paymentTerms}</p>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.city}{c.state ? `, ${c.state}` : ""}</span>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/quotations/new?customerId=${c.id}&name=${encodeURIComponent(c.companyName)}`}
                            className="px-2.5 py-1 text-xs font-semibold text-[#E66A23] bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded transition-colors"
                          >
                            New Quote
                          </Link>
                          <Link
                            href={`/customers/${c.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-[#0E274D] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                          >
                            Profile &rarr;
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
