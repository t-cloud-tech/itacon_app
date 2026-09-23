"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from "firebase/firestore";
import { Opportunity, OpportunityStage } from "@/types";
import { 
  Target, 
  PlusCircle, 
  Search, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Building2, 
  ChevronRight,
  CheckCircle2,
  FileSpreadsheet
} from "lucide-react";

export default function OpportunitiesPage() {
  const { user, role } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const stages: { key: OpportunityStage; label: string; color: string }[] = [
    { key: "requirement", label: "Requirement Scoping", color: "border-l-blue-500" },
    { key: "quotation", label: "Quotation Sent", color: "border-l-amber-500" },
    { key: "negotiation", label: "Price Negotiation", color: "border-l-purple-500" },
    { key: "approved", label: "Approved by Client", color: "border-l-emerald-500" },
    { key: "won", label: "Deal Won", color: "border-l-emerald-600" },
    { key: "lost", label: "Closed / Lost", color: "border-l-slate-400" },
  ];

  useEffect(() => {
    async function fetchOpportunities() {
      setIsLoading(true);
      try {
        const oppsRef = collection(db, "opportunities");
        let q = query(oppsRef, orderBy("createdAt", "desc"));

        if (role === "salesperson" && user?.userId) {
          q = query(oppsRef, where("assignedSalespersonId", "==", user.userId));
        }

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Opportunity));

        if (list.length > 0) {
          setOpportunities(list);
        } else {
          // Demo realistic opportunities
          setOpportunities([
            {
              id: "opp-1",
              oppNumber: "OPP-2026-041",
              customerId: "cust-1",
              customerName: "Gujarat Ceramics & Tiles",
              title: "Monsoon Villa Project - Full Vitrified Flooring (1,200 Boxes)",
              stage: "quotation",
              estimatedValue: 850000,
              probability: 75,
              expectedCloseDate: "Oct 10, 2026",
              assignedSalespersonId: user?.userId || "sp-1",
              notes: "Client comparing with competitor quote; approved 10% discount to secure order.",
              createdAt: "2026-09-19",
              updatedAt: "2026-09-22",
            },
            {
              id: "opp-2",
              oppNumber: "OPP-2026-040",
              customerId: "cust-2",
              customerName: "Apex Infra & Builders",
              title: "Skyline Residency - Elevation Wall Cladding & Stair Tiles",
              stage: "negotiation",
              estimatedValue: 1650000,
              probability: 60,
              expectedCloseDate: "Oct 25, 2026",
              assignedSalespersonId: user?.userId || "sp-1",
              notes: "Requires special payment credit terms of 60 days.",
              createdAt: "2026-09-14",
              updatedAt: "2026-09-21",
            },
            {
              id: "opp-3",
              oppNumber: "OPP-2026-039",
              customerId: "cust-3",
              customerName: "Studio Kulkarni Architects",
              title: "Boutique Cafe Interior - Handcrafted Ceramic Mosaics",
              stage: "requirement",
              estimatedValue: 320000,
              probability: 80,
              expectedCloseDate: "Sep 30, 2026",
              assignedSalespersonId: user?.userId || "sp-1",
              notes: "Samples delivered to site. Client reviewing tile finishes.",
              createdAt: "2026-09-18",
              updatedAt: "2026-09-20",
            },
            {
              id: "opp-4",
              oppNumber: "OPP-2026-038",
              customerId: "cust-4",
              customerName: "Maruti Tile World",
              title: "Quarterly Stock Replenishment - 600x600 Double Charge",
              stage: "won",
              estimatedValue: 2400000,
              probability: 100,
              expectedCloseDate: "Sep 15, 2026",
              assignedSalespersonId: user?.userId || "sp-1",
              notes: "Sales Order confirmed and sent to production.",
              createdAt: "2026-09-01",
              updatedAt: "2026-09-15",
            }
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch opportunities:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOpportunities();
  }, [user, role]);

  const handleStageChange = async (oppId: string, newStage: OpportunityStage) => {
    try {
      await updateDoc(doc(db, "opportunities", oppId), {
        stage: newStage,
        updatedAt: new Date().toISOString(),
      });
      setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: newStage } : o));
    } catch (err) {
      console.warn("Firestore update skipped, updating local state:", err);
      setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: newStage } : o));
    }
  };

  const filteredOpps = opportunities.filter(o => {
    const matchesSearch = 
      o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.oppNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage = stageFilter === "all" || o.stage === stageFilter;

    return matchesSearch && matchesStage;
  });

  const totalPipelineValue = filteredOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);

  return (
    <DashboardShell
      title="Opportunity Pipeline"
      subtitle="Deal tracking, probability forecasting, and value pipeline"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Control Bar & Pipeline Summary */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search deal title, customer, or deal ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium">Pipeline:</span>
              <span className="font-extrabold text-[#0E274D] text-sm">
                ₹{(totalPipelineValue / 100000).toFixed(1)} Lakhs
              </span>
              <span className="text-slate-400">({filteredOpps.length} deals)</span>
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Stages</option>
              {stages.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>

            <Link
              href="/opportunities/new"
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Opportunity</span>
            </Link>
          </div>
        </div>

        {/* Opportunity Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredOpps.map((opp) => (
            <div
              key={opp.id}
              className="card-luxury p-6 flex flex-col justify-between border-l-4 border-l-[#E66A23]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400">{opp.oppNumber}</span>
                    <h3 className="text-base font-bold text-[#0E274D] mt-0.5 leading-snug">{opp.title}</h3>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-600 mt-1 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{opp.customerName}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-extrabold text-[#0E274D]">
                      ₹{(opp.estimatedValue / 100000).toFixed(2)}L
                    </p>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {opp.probability}% win probability
                    </span>
                  </div>
                </div>

                {opp.notes && (
                  <p className="text-xs text-slate-500 mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    {opp.notes}
                  </p>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Stage:</span>
                  <select
                    value={opp.stage}
                    onChange={(e) => handleStageChange(opp.id, e.target.value as OpportunityStage)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-[#0E274D] focus:outline-none focus:ring-1 focus:ring-[#0E274D]"
                  >
                    {stages.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1 text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Close: {opp.expectedCloseDate}</span>
                  </span>

                  <Link
                    href={`/quotations/new?customerId=${opp.customerId}&name=${encodeURIComponent(opp.customerName)}&oppId=${opp.id}`}
                    className="flex items-center space-x-1 font-semibold text-[#E66A23] hover:underline"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Quote &rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
