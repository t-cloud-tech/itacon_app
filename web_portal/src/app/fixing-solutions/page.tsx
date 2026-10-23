"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FIXING_SOLUTIONS } from "@/lib/fixing-solutions";
import { Search, Wrench, Droplets, Timer, Ruler } from "lucide-react";

export default function FixingSolutionsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const term = searchTerm.toLowerCase();
  const items = FIXING_SOLUTIONS.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.grade.toLowerCase().includes(term) ||
      p.idealFor.toLowerCase().includes(term)
  );

  return (
    <DashboardShell
      title="Fixing Solutions"
      subtitle="Tile & stone adhesives available in the ITACON mobile app"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search adhesives, grades, applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            />
          </div>
          <span className="text-xs text-slate-500 shrink-0">
            Showing <strong className="text-slate-800">{items.length}</strong> fixing solutions
          </span>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-10">No fixing solutions match your search.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((p) => (
            <div key={p.id} className="card-luxury overflow-hidden flex flex-col justify-between">
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    {p.sku}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0E274D] text-white">
                    {p.grade}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0E274D] leading-snug flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#E66A23] shrink-0" />
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{p.shortDesc}</p>
                </div>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Ideal for: </span>
                  {p.idealFor}
                </p>
                <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-100 text-center text-xs">
                  <div>
                    <Ruler className="w-3.5 h-3.5 mx-auto text-slate-400" />
                    <span className="text-[10px] text-slate-400 block uppercase mt-0.5">Coverage</span>
                    <span className="font-bold text-slate-700">{p.coverage.split("/")[0].trim()}</span>
                  </div>
                  <div>
                    <Droplets className="w-3.5 h-3.5 mx-auto text-slate-400" />
                    <span className="text-[10px] text-slate-400 block uppercase mt-0.5">Water</span>
                    <span className="font-bold text-slate-700">{p.waterRatio.split(" Litres")[0]} L</span>
                  </div>
                  <div>
                    <Timer className="w-3.5 h-3.5 mx-auto text-slate-400" />
                    <span className="text-[10px] text-slate-400 block uppercase mt-0.5">Open time</span>
                    <span className="font-bold text-slate-700">{p.openTime}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pot life {p.potLife} · Tensile {p.tensileStrength}
                </p>
              </div>
              <div className="p-5 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-[10px] uppercase font-semibold text-slate-400">{p.weight}</span>
                <div>
                  <span className="text-xs text-slate-400 line-through mr-2">₹{p.mrp}</span>
                  <span className="text-lg font-extrabold text-[#0E274D]">₹{p.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
