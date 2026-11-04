"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { sortNewestFirst } from "@/lib/sort-utils";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Lead, LeadStatus, LeadSource } from "@/types";
import { isAdminRole } from "@/lib/auth-utils";
import { DeleteLeadModal } from "@/components/leads/delete-lead-modal";
import { EditLeadModal } from "@/components/leads/edit-lead-modal";
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
  Sparkles,
  Pencil,
  Trash2,
  CheckCircle2
} from "lucide-react";

export default function LeadsPage() {
  const { user, role } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const isAdmin = isAdminRole(role);

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

  const filteredLeads = sortNewestFirst(leads, (lead) => lead.createdAt).filter((lead) => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.companyName && lead.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lead.phone.includes(searchTerm) ||
      lead.city.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;

    return matchesSearch && matchesStatus && matchesSource;
  });
  const pager = usePagination(filteredLeads, `${searchTerm}|${statusFilter}|${sourceFilter}`);

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
        {toastMsg && (
          <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold animate-fadeIn">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{toastMsg}</span>
            </div>
            <button
              onClick={() => setToastMsg(null)}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer text-base leading-none"
            >
              &times;
            </button>
          </div>
        )}
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
            <table className="w-full table-fixed text-left text-sm min-w-[1000px]">
              <colgroup>
                {role !== "salesperson" ? (
                  <>
                    <col className="w-[19%]" />
                    <col className="w-[15%]" />
                    <col className="w-[11%]" />
                    <col className="w-[13%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[24%]" />
                  </>
                ) : (
                  <>
                    <col className="w-[25%]" />
                    <col className="w-[19%]" />
                    <col className="w-[15%]" />
                    <col className="w-[13%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                  </>
                )}
              </colgroup>
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 whitespace-nowrap">Lead / Client</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Contact Details</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Location</th>
                  {role !== "salesperson" && <th className="py-3.5 px-4 whitespace-nowrap">Assigned Rep</th>}
                  <th className="py-3.5 px-4 whitespace-nowrap">Source</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pager.pageItems.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-[#0E274D] font-bold flex items-center justify-center text-sm shrink-0">
                          {lead.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/leads/${lead.id}`} className="font-semibold text-[#0E274D] hover:underline block truncate" title={lead.name}>
                            {lead.name}
                          </Link>
                          {lead.companyName && (
                            <p className="text-xs text-slate-500 font-medium truncate" title={lead.companyName}>{lead.companyName}</p>
                          )}
                          <span className="text-[11px] font-mono text-slate-400 block">{lead.leadNumber}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium min-w-0">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={lead.phone}>{lead.phone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center space-x-1.5 text-xs text-slate-500 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate" title={lead.email}>{lead.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-1.5 text-xs text-slate-600 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate" title={`${lead.city}, ${lead.state}`}>{lead.city}, {lead.state}</span>
                      </div>
                    </td>

                    {role !== "salesperson" && (
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium min-w-0">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={lead.assignedSalespersonName || "Unassigned"}>
                            {lead.assignedSalespersonName || "Unassigned"}
                          </span>
                        </div>
                      </td>
                    )}

                    <td className="py-4 px-4">
                      {lead.source === "customer_app" ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Customer App</span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-600 capitalize truncate block" title={lead.source.replace("_", " ")}>
                          {lead.source.replace("_", " ")}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border whitespace-nowrap ${getStatusBadge(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5 whitespace-nowrap">
                        {lead.status !== "converted" && (
                          <Link
                            href={`/leads/${lead.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-[#0E274D] bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
                          >
                            Details &rarr;
                          </Link>
                        )}
                        {lead.status === "converted" && lead.convertedCustomerId && (
                          <Link
                            href={`/customers/${lead.convertedCustomerId}`}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors whitespace-nowrap"
                          >
                            View Customer
                          </Link>
                        )}
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingLead(lead)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors cursor-pointer whitespace-nowrap"
                              title="Edit lead"
                              aria-label={`Edit lead ${lead.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setLeadToDelete(lead)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors cursor-pointer whitespace-nowrap"
                              title="Delete lead"
                              aria-label={`Delete lead ${lead.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={pager.page} totalPages={pager.totalPages} totalItems={pager.totalItems} pageSize={pager.pageSize} onPageChange={pager.setPage} />
        </div>
            </div>

            {editingLead && (
        <EditLeadModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onUpdated={(updatedLead) => {
            setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
            setToastMsg("Lead updated");
            setTimeout(() => setToastMsg(null), 4000);
          }}
        />
      )}

      {leadToDelete && (
        <DeleteLeadModal
          lead={leadToDelete}
          onClose={() => setLeadToDelete(null)}
          onDeleted={(deletedId) => {
            setLeads((prev) => prev.filter((l) => l.id !== deletedId));
            setToastMsg("Lead deleted");
            setTimeout(() => setToastMsg(null), 4000);
          }}
        />
      )}
    </DashboardShell>
  );
}
