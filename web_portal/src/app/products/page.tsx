"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { AddTileModal } from "@/components/catalogue/add-tile-modal";
import { db } from "@/lib/firebase";
import { fetchAppTiles } from "@/lib/catalogue-service";
import { 
  Grid3X3, 
  Search, 
  Filter, 
  Layers, 
  Package, 
  Weight, 
  CheckCircle2, 
  PlusCircle, 
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Smartphone,
  Tag,
  Palette,
  Check
} from "lucide-react";

function ProductsContent() {
  const { user, role } = useAuth();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [finishFilter, setFinishFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [justAddedTitle, setJustAddedTitle] = useState<string | null>(null);

  // Auto open modal if ?action=new
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        setProducts(await fetchAppTiles());
      } catch (err) {
        console.warn("Could not load products:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const handleTileAdded = (newTile: any) => {
    setProducts((prev) => [newTile, ...prev]);
    setJustAddedTitle(newTile.name || newTile.sku);
    setTimeout(() => {
      setJustAddedTitle(null);
    }, 5000);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.size && p.size.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCat = categoryFilter === "all" || p.tileCategory === categoryFilter;
    const matchesFinish = finishFilter === "all" || (p.surface && p.surface.toLowerCase().includes(finishFilter.toLowerCase()));

    return matchesSearch && matchesCat && matchesFinish;
  });

  const categoryOptions = [...new Set(products.map((p) => p.tileCategory).filter(Boolean))] as string[];

  const isDesignerOrAdmin = role === "designer" || role === "admin";

  return (
    <DashboardShell
      title={role === "designer" ? "Designer Studio — Tile Catalogue" : "Tile & Ceramic Catalogue"}
      subtitle={
        role === "designer"
          ? "Master catalogue management — Add, curate & publish live tile models directly to the ITACON Mobile App"
          : "Read-only master product specifications, ready inventory, and packing metrics"
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Designer Mode Welcome Banner */}
        {role === "designer" && (
          <div className="bg-gradient-to-r from-[#0E274D] to-[#1E3A8A] rounded-2xl p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#1A2D5A]">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E66A23] text-white">
                  Designer Studio
                </span>
                <span className="text-xs text-orange-300 font-medium flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> Direct Mobile App Sync Active
                </span>
              </div>
              <h2 className="text-base font-bold text-white">
                Surface & Tile Catalogue Editor
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl">
                As a Designer, you have authority to add new ceramic, vitrified, and porcelain tile designs to the catalogue. Every new tile is immediately searchable and visible in the client mobile app.
              </p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-[#E66A23] to-[#F59E0B] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md shadow-[#E66A23]/30 transition-all shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add New Tile</span>
            </button>
          </div>
        )}

        {/* Just Added Alert Banner */}
        {justAddedTitle && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">Tile Live in Catalogue:</span>{" "}
                <span>"{justAddedTitle}" was published successfully. It is now live in the mobile app & web catalogue!</span>
              </div>
            </div>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
              Mobile App Synced
            </span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tile model, SKU, dimension (e.g. 600x1200)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Tile Categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={finishFilter}
              onChange={(e) => setFinishFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Surfaces / Finishes</option>
              <option value="gloss">Glossy / High Gloss</option>
              <option value="matt">Satin Matt</option>
              <option value="carving">Carving</option>
              <option value="wood">Wood Embossed</option>
              <option value="sugar">Sugar Finish</option>
              <option value="rustic">Rustic</option>
            </select>

            {/* Add New Tile CTA for Designers & Admins */}
            {isDesignerOrAdmin && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-[#E66A23] to-[#F59E0B] hover:opacity-95 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add New Tile</span>
              </button>
            )}

            {/* Build Quotation button (available for sales & admin) */}
            {role !== "designer" && (
              <Link
                href="/quotations/new"
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#0E274D] hover:bg-[#1A2D5A] text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Build Quotation</span>
              </Link>
            )}
          </div>
        </div>

        {/* Products Count Indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Showing <strong className="text-slate-800">{filteredProducts.length}</strong> tile designs in catalogue
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Firestore Database
          </span>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((tile) => {
            const tileImg = tile.imageUrl || (Array.isArray(tile.images) && tile.images[0]) || "";
            return (
              <div
                key={tile.id}
                className="card-luxury overflow-hidden flex flex-col justify-between group hover:border-orange-300 transition-all duration-200"
              >
                <div>
                  {/* Tile Preview Header */}
                  <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200/80 p-4 flex flex-col justify-between relative border-b border-slate-100 overflow-hidden">
                    {/* Background Texture if available */}
                    {tileImg && (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity"
                        style={{ backgroundImage: `url(${tileImg})` }}
                      />
                    )}

                    <div className="flex items-center justify-between relative z-10">
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-white/95 text-slate-800 shadow-xs border border-slate-200/60">
                        {tile.sku || tile.productId || "ITA-TILE"}
                      </span>
                      {role !== "designer" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/90 text-emerald-800 backdrop-blur-xs border border-emerald-200">
                          {tile.availableStock ? `${tile.availableStock} Boxes Ready` : "In Stock"}
                        </span>
                      )}
                    </div>

                    <div className="text-center py-4 relative z-10">
                      <div className="inline-block p-4 rounded-xl bg-white/90 backdrop-blur-sm shadow-xs border border-white/80 group-hover:scale-105 transition-transform">
                        <span className="text-xs font-mono font-bold text-[#0E274D] uppercase tracking-widest block">
                          {tile.size || "600x1200 mm"}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {tile.collection || "Endless Series"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-700 font-medium relative z-10 bg-white/70 backdrop-blur-xs px-2.5 py-1 rounded-md">
                      <span>{tile.tileCategory || "Vitrified Tile"}</span>
                      <span className="font-semibold text-[#E66A23]">{tile.surface || "Polished"}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="text-base font-bold text-[#0E274D] group-hover:text-[#E66A23] transition-colors leading-snug">
                        {tile.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{tile.color || "Standard Colorway"}</p>
                    </div>

                    {/* Packing Specifications */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-100 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Coverage</span>
                        <span className="font-bold text-slate-700">{tile.sqFtPerBox || 15.5} sqft</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Weight</span>
                        <span className="font-bold text-slate-700">{tile.boxWeightKg || 29} kg</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Packing</span>
                        <span className="font-bold text-slate-700">{tile.pcsPerBox || 2} pcs/box</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price & Action CTA Footer */}
                <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      {tile.basePrice && tile.basePrice <= 150 ? "Base Price / Sq.ft" : "Base Price / Box"}
                    </span>
                    <span className="text-lg font-extrabold text-[#0E274D]">
                      ₹{tile.basePrice || 35}
                      {tile.basePrice && tile.basePrice <= 150 ? "/sq.ft" : ""}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1">
                      {tile.basePrice && tile.basePrice <= 150
                        ? `(₹${(tile.basePrice * (tile.sqFtPerBox || 15.5)).toFixed(1)}/box)`
                        : `(₹${((tile.basePrice || 550) / (tile.sqFtPerBox || 15.5)).toFixed(1)}/sqft)`}
                    </span>
                  </div>

                  {role === "designer" ? (
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-[#E66A23] text-slate-700 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add Variant</span>
                    </button>
                  ) : (
                    <Link
                      href={`/quotations/new?productId=${tile.id}&sku=${encodeURIComponent(tile.sku || tile.name)}`}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add to Quote</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal for adding new tiles */}
        <AddTileModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onTileAdded={handleTileAdded}
        />
      </div>
    </DashboardShell>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-sm">Loading Tile Catalogue...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
