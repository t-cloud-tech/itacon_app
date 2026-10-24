"use client";

import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AddFixingSolutionModal } from "@/components/catalogue/add-fixing-solution-modal";
import { FIXING_SOLUTIONS, fixingSolutionImage, type FixingSolution } from "@/lib/fixing-solutions";
import { Search, Wrench, Droplets, Timer, Ruler, PlusCircle } from "lucide-react";

// Designer-added adhesives live in Firestore; the built-in range is the static list.
function fromFirestore(id: string, d: any): FixingSolution {
  const price = Number(d.basePrice) || 0;
  return {
    id,
    sku: d.sku || "",
    name: d.name || "Fixing Solution",
    grade: d.classification || d.surface || "",
    shortDesc: d.applicationNotes || "",
    idealFor: d.usageTileSizes || "",
    coverage: d.coverage || "-",
    weight: d.size || "",
    price,
    mrp: Number(d.mrp) || price,
    waterRatio: d.waterRatio || "-",
    potLife: d.potLife || "-",
    openTime: d.openTime || "-",
    tensileStrength: d.tensileStrength || "-",
    image: (Array.isArray(d.images) && d.images[0]) || d.imageUrl || "",
  };
}

// Resolves a Storage path (products/adhesives/<sku>.webp) to a download URL; full URLs pass through.
function FixingImage({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState(/^https?:/.test(src) ? src : "");
  useEffect(() => {
    if (/^https?:/.test(src)) {
      setUrl(src);
      return;
    }
    let cancelled = false;
    getDownloadURL(ref(storage, src))
      .then((u) => !cancelled && setUrl(u))
      .catch((err) => console.error("Fixing solution image not found:", src, err));
    return () => {
      cancelled = true;
    };
  }, [src]);
  if (!url) return <Wrench className="w-8 h-8 text-slate-300" />;
  return <img src={url} alt={alt} loading="lazy" className="h-full w-full object-contain p-3" />;
}

export default function FixingSolutionsPage() {
  const { role } = useAuth();
  const canAdd = role === "designer" || role === "admin";
  const [searchTerm, setSearchTerm] = useState("");
  const [added, setAdded] = useState<FixingSolution[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDocs(query(collection(db, "products"), where("productLine", "==", "adhesives")))
      .then((snap) => {
        if (cancelled) return;
        const builtIn = new Set(FIXING_SOLUTIONS.map((f) => f.sku));
        setAdded(
          snap.docs
            .map((d) => fromFirestore(d.id, d.data()))
            .filter((f) => f.sku && !builtIn.has(f.sku))
        );
      })
      .catch((err) => console.error("Failed to load fixing solutions:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const term = searchTerm.toLowerCase();
  const items = [...FIXING_SOLUTIONS, ...added].filter(
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
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-slate-500">
              Showing <strong className="text-slate-800">{items.length}</strong> fixing solutions
            </span>
            {canAdd && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#E66A23] to-[#F59E0B] text-white text-sm font-bold rounded-xl shadow-md shadow-[#E66A23]/25 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Fixing Solution</span>
              </button>
            )}
          </div>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-10">No fixing solutions match your search.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((p) => (
            <div key={p.id} className="card-luxury overflow-hidden flex flex-col justify-between">
              <div>
              <div className="h-48 bg-slate-100 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                <FixingImage src={fixingSolutionImage(p)} alt={p.name} />
              </div>
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

      <AddFixingSolutionModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdded={(item) => setAdded((prev) => [...prev, item])}
      />
    </DashboardShell>
  );
}
