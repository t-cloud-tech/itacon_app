"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Lead, LeadStatus, LeadSource } from "@/types";
import { 
  UserCheck, 
  PlusCircle, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MapPin, 
  Smartphone, 
  ArrowRight,
  ChevronRight,
  Sparkles
} from "lucide-react";

export default function LeadsPage() {
  const { user, role } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLeads() {
      setIsLoading(true);
      try {
        const leadsRef = collection(db, "leads");
        let q = query(leadsRef, orderBy("createdAt", "desc"));

        if (role === "salesperson" && user?.userId) {
          q = query(leadsRef, where("assignedSalespersonId", "==", user.userId));
        }

        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
        
        if (data.length > 0) {
          setLeads(data);
        } else {
          // Provide realistic starter leads demonstrating customer app sync & CRM capabilities
          setLeads([
            {
              id: "lead-1",
              leadNumber: "LD-2026-042",
              name: "Pooja Varma",
              phone: "98241 55678",
              email: "pooja.v@varmaestates.in",
              companyName: "Varma Luxury Estates",
              city: "Ahmedabad",
              state: "Gujarat",
              source: "customer_app",
              status: "new",
              assignedSalespersonId: user?.userId || "sp-1",
              requirementNotes: "Inquired via App 3D Visualizer for 800x1600mm Carving Finish Porcelain tiles for 12 duplex villas.",
              createdAt: "Today, 09:15 AM",
              updatedAt: "Today, 09:15 AM",
            },
            {
              id: "lead-2",
              leadNumber: "LD-2026-041",
              name: "Nilesh Patel",
              phone: "98790 11223",
              companyName: "Shree Ram Ceramics",
              city: "Surat",
              state: "Gujarat",
              source: "referral",
              status: "contacted",
              assignedSalespersonId: user?.userId || "sp-1",
              requirementNotes: "Wholesale dealership inquiry. Interested in full truckload (FTL) orders.",
              createdAt: "Yesterday",
              updatedAt: "Yesterday",
            },
            {
              id: "lead-3",
              leadNumber: "LD-2026-040",
              name: "Ar. Harshil Shah",
              phone: "99099 88776",
              email: "studio@shaharchitects.com",
              companyName: "Shah & Associates",
              city: "Vadodara",
              state: "Gujarat",
              source: "trade_fair",
              status: "qualified",
              assignedSalespersonId: user?.userId || "sp-1",
              requirementNotes: "Commercial showroom project. Needs tile sample display kit and price catalog tier B.",
              createdAt: "Sep 20, 2026",
              updatedAt: "Sep 21, 2026",
            },
            {
              id: "lead-4",
              leadNumber: "LD-2026-039",
              name: "Dinesh Bhai Mehta",
              phone: "94260 44332",
              companyName: "Maruti Traders",
              city: "Rajkot",
              state: "Gujarat",
              source: "manual",
              status: "converted",
              convertedCustomerId: "cust-102",
              assignedSalespersonId: user?.userId || "sp-1",
              requirementNotes: "Converted to official dealer on Sep 18. First order in progress.",
              createdAt: "Sep 15, 2026",
              updatedAt: "Sep 18, 2026",
            },
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch leads from Firestore, using baseline list:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeads();
  }, [user, role]);

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.companyName && lead.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lead.phone.includes(searchTerm) ||
      lead.city.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;

    return matchesSearch && matchesStatus && matchesSource;
  });

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case "new":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "contacted":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "qualified":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "converted":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "dropped":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <DashboardShell
      title="Lead Management"
      subtitle="Inbound inquiries from Customer App and field prospecting"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by client name, firm, phone, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="dropped">Dropped</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Sources</option>
              <option value="customer_app">Customer App (3D Design)</option>
              <option value="referral">Referral</option>
              <option value="manual">Manual Prospecting</option>
              <option value="trade_fair">Exhibition / Expo</option>
            </select>

            {/* Create Lead Button */}
            <Link
              href="/leads/new"
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add New Lead</span>
            </Link>
          </div>
        </div>

        {/* Leads Table Card */}
        <div className="card-luxury overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Lead / Client</th>
                  <th className="py-3.5 px-5">Contact Details</th>
                  <th className="py-3.5 px-5">Location</th>
                  <th className="py-3.5 px-5">Source</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-[#0E274D] font-bold flex items-center justify-center text-sm">
                          {lead.name.charAt(0)}
                        </div>
                        <div>
                          <Link href={`/leads/${lead.id}`} className="font-semibold text-[#0E274D] hover:underline flex items-center space-x-1.5">
                            <span>{lead.name}</span>
                          </Link>
                          {lead.companyName && (
                            <p className="text-xs text-slate-500 font-medium">{lead.companyName}</p>
                          )}
                          <span className="text-[11px] font-mono text-slate-400">{lead.leadNumber}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{lead.phone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate max-w-[180px]">{lead.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{lead.city}, {lead.state}</span>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      {lead.source === "customer_app" ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Smartphone className="w-3 h-3 text-emerald-600" />
                          <span>Customer App</span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-600 capitalize">
                          {lead.source.replace("_", " ")}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getStatusBadge(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {lead.status !== "converted" && (
                          <Link
                            href={`/leads/${lead.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-[#0E274D] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                          >
                            Details &rarr;
                          </Link>
                        )}
                        {lead.status === "converted" && lead.convertedCustomerId && (
                          <Link
                            href={`/customers/${lead.convertedCustomerId}`}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
                          >
                            View Customer
                          </Link>
                        )}
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
