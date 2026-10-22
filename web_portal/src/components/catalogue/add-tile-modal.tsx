"use client";

import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import {
  X,
  PlusCircle,
  Sparkles,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Package,
  Boxes,
  Palette,
  Maximize2,
  Tag,
  IndianRupee,
  Smartphone
} from "lucide-react";

interface AddTileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTileAdded?: (tile: any) => void;
}

const PRESET_IMAGES = [
  {
    name: "Statuario White Marble",
    url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Nero Marquina Slab",
    url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Calacatta Gold Porcelain",
    url: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Travertino Grigio Rustic",
    url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Oak Natural Wood Plank",
    url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Urban Concrete Smoke",
    url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
  },
];

const STANDARD_SIZES: Record<string, { sqft: number; pcs: number; weightKg: number }> = {
  "600x1200 mm": { sqft: 15.5, pcs: 2, weightKg: 29.5 },
  "800x1600 mm": { sqft: 27.56, pcs: 2, weightKg: 54.0 },
  "600x600 mm": { sqft: 15.5, pcs: 4, weightKg: 27.5 },
  "300x600 mm": { sqft: 8.71, pcs: 8, weightKg: 14.0 },
  "200x1200 mm": { sqft: 12.91, pcs: 5, weightKg: 24.5 },
  "800x2400 mm": { sqft: 41.33, pcs: 2, weightKg: 82.0 },
  "1200x2400 mm": { sqft: 62.0, pcs: 1, weightKg: 110.0 },
};

export function AddTileModal({ isOpen, onClose, onTileAdded }: AddTileModalProps) {
  const { user, role } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    sku: `ITA-${Math.floor(1000 + Math.random() * 9000)}`,
    category: "Floor Tiles",
    size: "600x1200 mm",
    surface: "High Gloss Polish",
    color: "White / Grey Vein",
    pattern: "Marble Vein",
    collection: "Endless Marbles",
    basePrice: "580",
    unit: "box",
    moq: "10",
    sqFtPerBox: "15.5",
    pcsPerBox: "2",
    boxWeightKg: "29.5",
    thickness: "9 mm",
    thicknessMm: "9.0",
    stockQuantity: "500",
    stockStatus: "available",
    spaces: ["Living Room", "Bedroom"],
    imageUrl: PRESET_IMAGES[0].url,
    productType: "Vitrified",
    bodyType: "Porcelain",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSizeChange = (newSize: string) => {
    const std = STANDARD_SIZES[newSize];
    if (std) {
      setFormData((prev) => ({
        ...prev,
        size: newSize,
        sqFtPerBox: std.sqft.toString(),
        pcsPerBox: std.pcs.toString(),
        boxWeightKg: std.weightKg.toString(),
      }));
    } else {
      setFormData((prev) => ({ ...prev, size: newSize }));
    }
  };

  const toggleSpace = (space: string) => {
    setFormData((prev) => {
      const exists = prev.spaces.includes(space);
      return {
        ...prev,
        spaces: exists ? prev.spaces.filter((s) => s !== space) : [...prev.spaces, space],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Please enter a tile name.");
      return;
    }
    if (!formData.sku.trim()) {
      setError("Please enter an SKU or model code.");
      return;
    }
    if (Number(formData.basePrice) <= 0) {
      setError("Please specify a valid base price.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Generate Firestore ID under products collection
      const productsCol = collection(db, "products");
      const tileDocRef = doc(productsCol);
      const productId = tileDocRef.id;

      const getCategoryId = (cat: string) => {
        switch (cat) {
          case "Slab Tiles":
            return "CAT_SLABS_01";
          case "Wall Tiles":
            return "CAT_WALL_01";
          case "Wall & Floor Planks":
            return "CAT_PLANKS_01";
          case "Heavy Duty Parkings":
            return "CAT_PARKING_01";
          case "Tile Adhesives":
            return "CAT_ADHESIVES";
          default:
            return "CAT_GLAZED_01";
        }
      };

      const now = new Date().toISOString();
      const stockNum = parseInt(formData.stockQuantity, 10) || 500;
      const priceNum = parseFloat(formData.basePrice) || 580;
      const sqFtNum = parseFloat(formData.sqFtPerBox) || 15.5;
      const pcsNum = parseInt(formData.pcsPerBox, 10) || 2;
      const wtNum = parseFloat(formData.boxWeightKg) || 29.5;
      const thickNum = parseFloat(formData.thicknessMm) || 9.0;
      const moqNum = parseInt(formData.moq, 10) || 1;

      const tilePayload = {
        id: productId,
        productId: productId,
        sku: formData.sku.trim().toUpperCase(),
        name: formData.name.trim(),
        tileCategory: formData.category,
        categoryId: getCategoryId(formData.category),
        productLine: formData.category === "Tile Adhesives" ? "adhesives" : "tiles",
        size: formData.size.trim(),
        surface: formData.surface.trim(),
        color: formData.color.trim(),
        baseColour: formData.color.trim(),
        pattern: formData.pattern.trim(),
        basePrice: priceNum,
        unit: formData.unit,
        moq: moqNum,
        stockStatus: formData.stockStatus, // 'available' or 'available_now'
        availableQuantity: stockNum,
        currentStock: stockNum,
        reservedStock: 0,
        availableStock: stockNum,
        images: formData.imageUrl ? [formData.imageUrl] : [PRESET_IMAGES[0].url],
        imageUrl: formData.imageUrl || PRESET_IMAGES[0].url,
        isActive: true,
        isComingSoon: false,
        collection: formData.collection.trim(),
        spaces: formData.spaces,
        finish: formData.surface.trim(),
        productType: formData.productType,
        bodyType: formData.bodyType,
        thickness: formData.thickness,
        thicknessMm: thickNum,
        boxWeightKg: wtNum,
        pcsPerBox: pcsNum,
        sqFtPerBox: sqFtNum,
        thicknessCategory: "standard",
        shape: formData.size.includes("600x600") ? "square" : "rectangle",
        aspectRatio: "0.5",
        aspectRatioValue: 0.5,
        randomPattern: "4 Faces",
        priceCategory: "Premium",
        shade: "V2 - Slight Variation",
        packingDetails: {
          coverageSqFt: sqFtNum,
          pcsPerBox: pcsNum,
          boxWeightKg: wtNum,
        },
        createdAt: now,
        updatedAt: now,
        createdByName: user?.name || "Designer",
        createdByRole: role || "designer",
        createdByUid: user?.userId || "",
      };

      // Direct write to products collection (read by mobile app & web catalogue)
      await setDoc(doc(db, "products", productId), tilePayload);

      // Mirror write to tiles collection for backwards compatibility
      await setDoc(doc(db, "tiles", productId), tilePayload);

      setSuccess(true);
      if (onTileAdded) {
        onTileAdded(tilePayload);
      }

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error("Error creating tile:", err);
      setError(err?.message || "Failed to publish tile. Please check permissions and connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#0E274D] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E66A23] to-[#F59E0B] flex items-center justify-center shadow-md shadow-[#E66A23]/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Add New Tile to Catalogue</span>
                <span className="text-[11px] font-medium bg-white/10 text-orange-300 px-2.5 py-0.5 rounded-full border border-white/15">
                  Designer Studio
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Immediately syncs with the ITACON mobile app catalogue and web portal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live sync banner */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">Direct App Sync:</span>
            <span>
              Tiles added here become instantly searchable & visible to Dealers, Architects, and Builders in the ITACON mobile app.
            </span>
          </div>
          <span className="font-mono text-[11px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold">
            Live Collection
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-semibold text-sm">
                Tile successfully added! Live in mobile app & web catalogue now.
              </span>
            </div>
          )}

          {/* Section 1: Tile Identity & Dimension */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#E66A23]" />
              <span>1. Tile Identity & Specifications</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tile Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Statuario Michelangelo Marble"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Model / SKU *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ITA-STAT-6012"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tile Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="Floor Tiles">Floor Tiles</option>
                  <option value="Slab Tiles">Grand Slab Tiles</option>
                  <option value="Wall Tiles">Wall Tiles</option>
                  <option value="Wall & Floor Planks">Wall & Floor Planks</option>
                  <option value="Heavy Duty Parkings">Heavy Duty Parkings</option>
                  <option value="Tile Adhesives">Tile Adhesives</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dimensions / Size</label>
                <select
                  value={formData.size}
                  onChange={(e) => handleSizeChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="600x1200 mm">600x1200 mm (2x4 ft)</option>
                  <option value="800x1600 mm">800x1600 mm (Grand Slab)</option>
                  <option value="600x600 mm">600x600 mm (2x2 ft)</option>
                  <option value="300x600 mm">300x600 mm (Subway/Wall)</option>
                  <option value="200x1200 mm">200x1200 mm (Wood Plank)</option>
                  <option value="800x2400 mm">800x2400 mm (Max Slab)</option>
                  <option value="1200x2400 mm">1200x2400 mm (Mega Slab)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Surface Finish</label>
                <select
                  value={formData.surface}
                  onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="High Gloss Polish">High Gloss Polish</option>
                  <option value="Satin Matt">Satin Matt</option>
                  <option value="Carving Matt">Carving Matt</option>
                  <option value="Wood Embossed">Wood Embossed</option>
                  <option value="Sugar Finish">Sugar Finish</option>
                  <option value="Rustic Matt">Rustic Matt</option>
                  <option value="Glossy Ceramic">Glossy Ceramic</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Color Shade</label>
                <input
                  type="text"
                  placeholder="e.g. White / Grey Vein"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Design Pattern</label>
                <input
                  type="text"
                  placeholder="e.g. Marble Vein, Natural Wood"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Collection / Series</label>
                <input
                  type="text"
                  placeholder="e.g. Endless Marbles"
                  value={formData.collection}
                  onChange={(e) => setFormData({ ...formData, collection: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pricing, Packaging & Ready Inventory */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#E66A23]" />
              <span>2. Commercial Pricing & Box Packaging Metrics</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Base Price (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="580"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#0E274D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pricing Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="box">per Box</option>
                  <option value="sqft">per Sq.ft</option>
                  <option value="piece">per Piece</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Coverage (Sq.ft / Box)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.sqFtPerBox}
                  onChange={(e) => setFormData({ ...formData, sqFtPerBox: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pieces / Box</label>
                <input
                  type="number"
                  value={formData.pcsPerBox}
                  onChange={(e) => setFormData({ ...formData, pcsPerBox: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Box Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.boxWeightKg}
                  onChange={(e) => setFormData({ ...formData, boxWeightKg: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ready Stock (Boxes)</label>
                <input
                  type="number"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Availability</label>
                <select
                  value={formData.stockStatus}
                  onChange={(e) => setFormData({ ...formData, stockStatus: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="available">Ready Stock (available)</option>
                  <option value="available_now">Available Now</option>
                  <option value="made_to_order">Made to Order</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Recommended Spaces & Image */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#E66A23]" />
              <span>3. Applicable Spaces & High-Res Tile Texture</span>
            </h3>

            {/* Spaces Pills */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Suitable Living Spaces</label>
              <div className="flex flex-wrap gap-2">
                {["Living Room", "Bedroom", "Bathroom", "Kitchen", "Outdoor / Patio", "Commercial Hall"].map(
                  (space) => {
                    const isSelected = formData.spaces.includes(space);
                    return (
                      <button
                        type="button"
                        key={space}
                        onClick={() => toggleSpace(space)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-[#0E274D] text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {space} {isSelected ? "✓" : "+"}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Image Preview & Presets */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Tile Image / Texture Preview</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-28 h-28 rounded-xl border-2 border-slate-200 overflow-hidden shrink-0 shadow-xs bg-slate-100 relative group">
                  {formData.imageUrl ? (
                    <img
                      src={formData.imageUrl}
                      alt="Tile Preview"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                      <ImageIcon className="w-6 h-6 mb-1" />
                      <span>No Image</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full space-y-2">
                  <input
                    type="url"
                    placeholder="Paste image URL (e.g. https://...)..."
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  />

                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1 font-medium">
                      Or pick from designer preset marble & porcelain textures:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_IMAGES.map((preset) => (
                        <button
                          type="button"
                          key={preset.name}
                          onClick={() => setFormData({ ...formData, imageUrl: preset.url })}
                          className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                            formData.imageUrl === preset.url
                              ? "bg-orange-50 border-[#E66A23] text-[#E66A23] font-semibold"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-[#E66A23] to-[#F59E0B] hover:opacity-95 text-white text-sm font-bold rounded-xl shadow-md shadow-[#E66A23]/25 transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Syncing to Mobile App...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Publish Tile to Catalogue</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
