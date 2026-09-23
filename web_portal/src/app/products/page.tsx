"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit } from "firebase/firestore";
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
  Sparkles
} from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [finishFilter, setFinishFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        // Query products or tiles collection
        let snap = await getDocs(query(collection(db, "products"), limit(40)));
        if (snap.empty) {
          snap = await getDocs(query(collection(db, "tiles"), limit(40)));
        }

        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (list.length > 0) {
          setProducts(list);
        } else {
          // Realistic ceramic & porcelain tile catalogue fallback
          setProducts([
            {
              id: "prod-1",
              productId: "ITA-STAT-6012",
              sku: "ITA-STAT-6012",
              name: "Statuario White Marble Porcelain",
              tileCategory: "Floor Tiles",
              size: "600x1200 mm",
              surface: "High Gloss Polish",
              color: "White / Grey Vein",
              basePrice: 580,
              sqFtPerBox: 15.5,
              boxWeightKg: 29.5,
              pcsPerBox: 2,
              stockStatus: "available",
              availableStock: 1450,
              images: ["/next.svg"],
            },
            {
              id: "prod-2",
              productId: "ITA-NERO-8016",
              sku: "ITA-NERO-8016",
              name: "Nero Marquina Grand Slab",
              tileCategory: "Slab Tiles",
              size: "800x1600 mm",
              surface: "Carving Matt",
              color: "Nero Black / White Veins",
              basePrice: 920,
              sqFtPerBox: 27.56,
              boxWeightKg: 54.0,
              pcsPerBox: 2,
              stockStatus: "available",
              availableStock: 620,
              images: ["/next.svg"],
            },
            {
              id: "prod-3",
              productId: "ITA-TRAV-6012",
              sku: "ITA-TRAV-6012",
              name: "Travertino Grigio Rustic",
              tileCategory: "Floor Tiles",
              size: "600x1200 mm",
              surface: "Satin Matt",
              color: "Grigio Grey",
              basePrice: 540,
              sqFtPerBox: 15.5,
              boxWeightKg: 29.0,
              pcsPerBox: 2,
              stockStatus: "available",
              availableStock: 890,
              images: ["/next.svg"],
            },
            {
              id: "prod-4",
              productId: "ITA-WOOD-2012",
              sku: "ITA-WOOD-2012",
              name: "Oak Natural Wood Plank",
              tileCategory: "Wall & Floor Planks",
              size: "200x1200 mm",
              surface: "Wood Embossed",
              color: "Warm Oak Brown",
              basePrice: 490,
              sqFtPerBox: 12.91,
              boxWeightKg: 24.5,
              pcsPerBox: 5,
              stockStatus: "available",
              availableStock: 410,
              images: ["/next.svg"],
            },
            {
              id: "prod-5",
              productId: "ITA-CALA-6060",
              sku: "ITA-CALA-6060",
              name: "Calacatta Gold Vitrified",
              tileCategory: "Floor Tiles",
              size: "600x600 mm",
              surface: "High Gloss Polish",
              color: "Bianco Gold",
              basePrice: 420,
              sqFtPerBox: 15.5,
              boxWeightKg: 27.5,
              pcsPerBox: 4,
              stockStatus: "available",
              availableStock: 2200,
              images: ["/next.svg"],
            },
            {
              id: "prod-6",
              productId: "ITA-CEMT-3060",
              sku: "ITA-CEMT-3060",
              name: "Urban Concrete Subway Wall Tile",
              tileCategory: "Wall Tiles",
              size: "300x600 mm",
              surface: "Matt Ceramic",
              color: "Smoke Grey",
              basePrice: 320,
              sqFtPerBox: 8.71,
              boxWeightKg: 14.0,
              pcsPerBox: 8,
              stockStatus: "available",
              availableStock: 1800,
              images: ["/next.svg"],
            }
          ]);
        }
      } catch (err) {
        console.warn("Could not load products:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.size && p.size.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCat = categoryFilter === "all" || p.tileCategory === categoryFilter;
    const matchesFinish = finishFilter === "all" || (p.surface && p.surface.toLowerCase().includes(finishFilter.toLowerCase()));

    return matchesSearch && matchesCat && matchesFinish;
  });

  return (
    <DashboardShell
      title="Tile & Ceramic Catalogue"
      subtitle="Read-only master product specifications, ready inventory, and packing metrics"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
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
              <option value="Floor Tiles">Floor Tiles</option>
              <option value="Slab Tiles">Grand Slab Tiles</option>
              <option value="Wall Tiles">Wall Tiles</option>
              <option value="Wall & Floor Planks">Planks</option>
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
            </select>

            <Link
              href="/quotations/new"
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Build Quotation</span>
            </Link>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((tile) => (
            <div
              key={tile.id}
              className="card-luxury overflow-hidden flex flex-col justify-between group"
            >
              <div>
                {/* Tile Preview Header */}
                <div className="h-44 bg-gradient-to-br from-slate-100 to-slate-200/80 p-4 flex flex-col justify-between relative border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white/90 text-slate-700 shadow-xs">
                      {tile.sku || tile.productId || "ITA-TILE"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      {tile.availableStock ? `${tile.availableStock} Boxes Ready` : "In Stock"}
                    </span>
                  </div>

                  <div className="text-center py-4">
                    <div className="inline-block p-4 rounded-xl bg-white/80 backdrop-blur-xs shadow-xs border border-white/50">
                      <span className="text-xs font-mono font-bold text-slate-600 uppercase tracking-widest">
                        {tile.size || "600x1200 mm"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>{tile.tileCategory || "Vitrified Tile"}</span>
                    <span>{tile.surface || "Polished"}</span>
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

              {/* Price & Quote CTA Footer */}
              <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Base Price / Box</span>
                  <span className="text-lg font-extrabold text-[#0E274D]">
                    ₹{tile.basePrice || 550}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1">
                    (₹{((tile.basePrice || 550) / (tile.sqFtPerBox || 15.5)).toFixed(1)}/sqft)
                  </span>
                </div>

                <Link
                  href={`/quotations/new?productId=${tile.id}&sku=${encodeURIComponent(tile.sku || tile.name)}`}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add to Quote</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
