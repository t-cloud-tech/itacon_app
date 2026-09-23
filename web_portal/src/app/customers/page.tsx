"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Customer } from "@/types";
import { 
  Users, 
  Search, 
  PlusCircle, 
  Phone, 
  MapPin, 
  BadgePercent, 
  CreditCard, 
  ArrowRight,
  ShieldCheck,
  Building
} from "lucide-react";

export default function CustomersPage() {
  const { user, role } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomers() {
      setIsLoading(true);
      try {
        const custRef = collection(db, "customers");
        let q = query(custRef, orderBy("name", "asc"));

        if (role === "salesperson" && user?.userId) {
          q = query(custRef, where("assignedSalespersonId", "==", user.userId));
        }

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));

        if (list.length > 0) {
          setCustomers(list);
        } else {
          // Provide realistic starter customers
          setCustomers([
            {
              id: "cust-1",
              customerNumber: "CUST-2026-081",
              name: "Pravin Bhai Shah",
              companyName: "Gujarat Ceramics & Tiles",
              phone: "98250 99881",
              email: "gujaratceramics@gmail.com",
              city: "Ahmedabad",
              state: "Gujarat",
              gstNumber: "24AAACG1234F1Z5",
              category: "Dealer",
              priceTier: "A",
              creditLimit: 1500000,
              paymentTerms: "45 Days",
              assignedSalespersonId: user?.userId || "sp-1",
              status: "active",
              createdAt: "2026-01-10",
              updatedAt: "2026-09-20",
            },
            {
              id: "cust-2",
              customerNumber: "CUST-2026-074",
              name: "Nirav Sanghavi",
              companyName: "Apex Infra & Builders",
              phone: "98791 44556",
              email: "purchase@apexinfra.com",
              city: "Surat",
              state: "Gujarat",
              gstNumber: "24BBBCG5678F1Z2",
              category: "Builder",
              priceTier: "B",
              creditLimit: 2500000,
              paymentTerms: "30 Days",
              assignedSalespersonId: user?.userId || "sp-1",
              status: "active",
              createdAt: "2026-02-14",
              updatedAt: "2026-09-21",
            },
            {
              id: "cust-3",
              customerNumber: "CUST-2026-069",
              name: "Ar. Sneha Kulkarni",
              companyName: "Studio Kulkarni Architects",
              phone: "97660 33221",
              email: "sneha@studiokulkarni.in",
              city: "Pune",
              state: "Maharashtra",
              category: "Architect",
              priceTier: "C",
              creditLimit: 500000,
              paymentTerms: "Advance 50%",
              assignedSalespersonId: user?.userId || "sp-1",
              status: "active",
              createdAt: "2026-03-01",
              updatedAt: "2026-09-15",
            },
            {
              id: "cust-4",
              customerNumber: "CUST-2026-052",
              name: "Hitesh Patel",
              companyName: "Maruti Tile World",
              phone: "94260 77889",
              email: "maruti.tiles@yahoo.com",
              city: "Rajkot",
              state: "Gujarat",
              gstNumber: "24CCCG9012F1Z9",
              category: "Wholesaler",
              priceTier: "A",
              creditLimit: 3000000,
              paymentTerms: "60 Days",
              assignedSalespersonId: user?.userId || "sp-1",
              status: "active",
              createdAt: "2025-11-20",
              updatedAt: "2026-09-18",
            },
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch customers from Firestore:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomers();
  }, [user, role]);

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCat = categoryFilter === "all" || c.category === categoryFilter;
    const matchesTier = tierFilter === "all" || c.priceTier === tierFilter;

    return matchesSearch && matchesCat && matchesTier;
  });

  return (
    <DashboardShell
      title="Customer Directory"
      subtitle="Authorized tile dealers, wholesalers, contractors, and architects"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by company name, client, phone, or city..."
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

        {/* Customer Directory Table */}
        <div className="card-luxury overflow-hidden">
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
                        <div className="w-9 h-9 rounded-full bg-[#0E274D]/10 text-[#0E274D] font-bold flex items-center justify-center text-sm">
                          {c.companyName.charAt(0)}
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
                          <span>{c.phone}</span>
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
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
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
                        <span>{c.city}, {c.state}</span>
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
      </div>
    </DashboardShell>
  );
}
