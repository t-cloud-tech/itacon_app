"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { AddTileModal } from "@/components/catalogue/add-tile-modal";
import { StorageImage, tileThumbnailPath } from "@/components/catalogue/storage-image";
import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { fetchAppTiles, SURFACE_FINISHES, matchesSurfaceFilter } from "@/lib/catalogue-service";
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
  Check,
  Loader2
} from "lucide-react";

function ProductsContent() {
  const { user, role } = useAuth();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [finishFilter, setFinishFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [justAddedTitle, setJustAddedTitle] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
        setProducts(await fetchAppTiles(true));
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

  const handleToggleStatus = async (tile: any) => {
    if (togglingId) return; // prevent double clicks

    const isCurrentlyActive = tile.isActive !== false;
    const nextIsActive = !isCurrentlyActive;
    const tileDisplayName = tile.name || tile.sku || "this tile";

    if (isCurrentlyActive) {
      const confirmed = window.confirm(`Hide ${tileDisplayName} from the customer app?`);
      if (!confirmed) return;
    }

    setTogglingId(tile.id);
    try {
      const productRef = doc(db, "products", tile.id);
      const tileRef = doc(db, "tiles", tile.id);

      const updateData: any = {
        isActive: nextIsActive,
        updatedAt: new Date(),
      };
      if (user?.userId) {
        updateData.updatedBy = user.userId;
      }

      const [pSnap, tSnap] = await Promise.all([
        getDoc(productRef).catch(() => null),
        getDoc(tileRef).catch(() => null),
      ]);

      const batch = writeBatch(db);
      let updatedAny = false;

      if (pSnap && pSnap.exists()) {
        batch.update(productRef, updateData);
        updatedAny = true;
      }
      if (tSnap && tSnap.exists()) {
        batch.update(tileRef, updateData);
        updatedAny = true;
      }

      // If document was not found under exists() in both, perform merge update on productRef
      if (!updatedAny) {
        batch.set(productRef, updateData, { merge: true });
      }

      await batch.commit();

      setProducts((prev) =>
        prev.map((p) => (p.id === tile.id ? { ...p, isActive: nextIsActive } : p))
      );

      setToast({
        message: `"${tileDisplayName}" is now ${nextIsActive ? "Active" : "Inactive"}.`,
        type: "success",
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      console.error("Failed to toggle tile status:", err);
      setToast({
        message: `Failed to update status: ${err?.message || "Unknown error"}`,
        type: "error",
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setTogglingId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.size && p.size.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFinish = matchesSurfaceFilter(p, finishFilter);

    return matchesSearch && matchesFinish;
  });

  const isDesignerOrAdmin = role === "designer" || role === "admin";

  return (
    <DashboardShell
      title={role === "designer" ? "Tile Catalogue" : "Tile & Ceramic Catalogue"}
      subtitle={
        role === "designer"
          ? "Master catalogue management - Add, curate & publish live tile models directly to the ITACON Mobile App"
          : "Read-only master product specifications, ready inventory, and packing metrics"
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 duration-200 ${toast.type === "success"
              ? "bg-slate-900 text-white border-emerald-500/50"
              : "bg-rose-950 text-white border-rose-500/50"
              }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">!</span>
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Designer Mode Welcome Banner */}
        {role === "designer" && (
          <div className="bg-gradient-to-r from-[#0E274D] to-[#1E3A8A] rounded-2xl p-5 text-white shadow-md border border-[#1A2D5A]">
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
              value={finishFilter}
              onChange={(e) => setFinishFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
            >
              <option value="all">All Surfaces / Finishes</option>
              {SURFACE_FINISHES.map((finish) => (
                <option key={finish} value={finish}>
                  {finish}
                </option>
              ))}
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
            const tileImg: string =
              (Array.isArray(tile.faceImages) && tile.faceImages[0]) ||
              tile.imageUrl ||
              (Array.isArray(tile.images) && tile.images[0]) ||
              "";
            const isTileActive = tile.isActive !== false;
            const isToggling = togglingId === tile.id;

            return (
              <div
                key={tile.id}
                className={`card-luxury overflow-hidden flex flex-col justify-between group transition-all duration-200 ${isTileActive
                  ? "hover:border-orange-300"
                  : "opacity-65 bg-slate-50/90 border-slate-300"
                  }`}
              >
                <div>
                  {/* Tile Preview Header */}
                  <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200/80 p-4 flex flex-col justify-between relative border-b border-slate-100 overflow-hidden">
                    {/* Background Texture if available */}
                    {tileImg && (
                      <StorageImage
                        sources={[tileImg, tileThumbnailPath(tileImg)]}
                        alt={tile.name || tile.sku || "Tile"}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-white/95 text-slate-800 shadow-xs border border-slate-200/60">
                          {tile.sku || tile.productId || "ITA-TILE"}
                        </span>
                        {!isTileActive && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                            Inactive
                          </span>
                        )}
                      </div>
                      {role !== "designer" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/90 text-emerald-800 backdrop-blur-xs border border-emerald-200">
                          {tile.availableStock ? `${tile.availableStock} Boxes Ready` : "In Stock"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-slate-700 font-medium relative z-10 bg-white/70 backdrop-blur-xs px-2.5 py-1 rounded-md">
                      <span className="truncate">
                        {tile.tileCategory || "Vitrified Tile"}
                        <span className="font-mono font-bold text-[#0E274D]"> · {tile.size || "600x1200 mm"}</span>
                      </span>
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

                  {role === "designer" || isDesignerOrAdmin ? (
                    <button
                      disabled={isToggling}
                      onClick={() => handleToggleStatus(tile)}
                      title={isTileActive ? "Click to deactivate tile" : "Click to activate tile"}
                      className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer ${isTileActive
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                        : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                        }`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span className="text-[9px] leading-none">●</span>
                      )}
                      <span>{isTileActive ? "Active" : "Inactive"}</span>
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
