"use client";

import React, { useState } from "react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, collection, setDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { X, Wrench, Image as ImageIcon, AlertCircle, CheckCircle2, PlusCircle } from "lucide-react";
import type { FixingSolution } from "@/lib/fixing-solutions";

interface AddFixingSolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded?: (item: FixingSolution) => void;
}

const inputCls =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E274D]";

const EMPTY = {
  name: "",
  sku: "",
  grade: "",
  shortDesc: "",
  idealFor: "",
  coverage: "50 - 60 sq.ft / 20kg Bag",
  weight: "20 kg Bag",
  price: "",
  mrp: "",
  waterRatio: "4.5 to 5.0 Litres per 20 kg bag",
  potLife: "2.5 - 3 Hours at 27°C",
  openTime: "20 Minutes",
  tensileStrength: "≥ 0.5 N/mm²",
  image: "",
};

export function AddFixingSolutionModal({ isOpen, onClose, onAdded }: AddFixingSolutionModalProps) {
  const { user, role } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const set = (key: keyof typeof EMPTY, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG or WebP).");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const safeSku = form.sku.trim().replace(/[^A-Za-z0-9_-]/g, "_") || "fixing";
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileRef = ref(storage, `products/designer_uploads/${safeSku}_${Date.now()}.${ext}`);
      await uploadBytes(fileRef, file, { contentType: file.type });
      set("image", await getDownloadURL(fileRef));
    } catch (err: any) {
      console.error("Image upload failed:", err);
      setError(err?.message || "Image upload failed. You can paste an image URL instead.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("Please enter a product name.");
    if (!form.sku.trim()) return setError("Please enter an SKU.");
    const price = parseFloat(form.price);
    if (!(price > 0)) return setError("Please specify a valid price.");
    const mrp = parseFloat(form.mrp) || price;
    const image = form.image.trim();
    if (!image) return setError("Please add a product image.");

    setIsSubmitting(true);
    try {
      const productId = doc(collection(db, "products")).id;
      const now = new Date().toISOString();
      const sku = form.sku.trim().toUpperCase();
      const bagKg = parseFloat(form.weight) || 20;

      // Same shape the mobile app's seedAdhesiveProducts writes, so the app lists it under Fixing Solutions.
      const payload = {
        id: productId,
        productId,
        sku,
        name: form.name.trim(),
        productLine: "adhesives",
        categoryId: "CAT_ADHESIVES",
        tileCategory: "Tile Adhesives",
        classification: form.grade.trim(),
        surface: form.grade.trim(),
        color: "Grey",
        basePrice: price,
        mrp,
        unit: "bag",
        bagWeightKg: bagKg,
        boxWeightKg: bagKg,
        size: form.weight.trim(),
        usageTileSizes: form.idealFor.trim(),
        applicationNotes: form.shortDesc.trim(),
        coverage: form.coverage.trim(),
        waterRatio: form.waterRatio.trim(),
        potLife: form.potLife.trim(),
        openTime: form.openTime.trim(),
        tensileStrength: form.tensileStrength.trim(),
        images: [image],
        imageUrl: image,
        collection: "Fixing Solutions",
        productType: "Adhesives",
        stockStatus: "available_now",
        availableQuantity: 1000,
        isActive: true,
        isComingSoon: false,
        createdAt: now,
        updatedAt: now,
        createdByName: user?.name || "Designer",
        createdByRole: role || "designer",
        createdByUid: user?.userId || "",
      };

      await setDoc(doc(db, "products", productId), payload);
      await setDoc(doc(db, "tiles", productId), payload);

      setSuccess(true);
      onAdded?.({
        id: productId,
        sku,
        name: payload.name,
        grade: form.grade.trim(),
        shortDesc: form.shortDesc.trim(),
        idealFor: form.idealFor.trim(),
        coverage: form.coverage.trim(),
        weight: form.weight.trim(),
        price,
        mrp,
        waterRatio: form.waterRatio.trim(),
        potLife: form.potLife.trim(),
        openTime: form.openTime.trim(),
        tensileStrength: form.tensileStrength.trim(),
        image,
      });
      setTimeout(() => {
        setSuccess(false);
        setForm(EMPTY);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Error creating fixing solution:", err);
      setError(err?.message || "Failed to publish. Please check permissions and connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (label: string, key: keyof typeof EMPTY, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        className={inputCls}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        {...props}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        <div className="px-6 py-5 bg-[#0E274D] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E66A23] to-[#F59E0B] flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Add New Fixing Solution</h2>
              <p className="text-xs text-slate-300">Appears in the ITACON mobile app under Fixing Solutions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Fixing solution added! Live in the mobile app now.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">Product Image *</span>
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-[#0E274D]/30 border-t-[#E66A23] rounded-full animate-spin" />
                ) : form.image ? (
                  <img src={form.image} alt="Product" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <label className="block text-center text-xs font-semibold px-2 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <input
                type="url"
                placeholder="or paste URL"
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0E274D]"
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field("Product Name *", "name", { required: true, placeholder: "e.g. ITA LX-05 Tile Adhesive" })}
                {field("SKU *", "sku", {
                  required: true,
                  placeholder: "e.g. ITA-LX-05",
                  onChange: (e) => set("sku", e.target.value.toUpperCase()),
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field("Grade / Type", "grade", { placeholder: "e.g. TYPE-2 (C2T)" })}
                {field("Pack Weight", "weight", { placeholder: "e.g. 20 kg Bag" })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {field("Price (₹) *", "price", { type: "number", step: "any", required: true, placeholder: "185" })}
                {field("MRP (₹)", "mrp", { type: "number", step: "any", placeholder: "230" })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {field("Short Description", "shortDesc", { placeholder: "Where and how this adhesive is used" })}
            {field("Ideal For (tile sizes)", "idealFor", { placeholder: "e.g. 300x600, 800x800, 600x1200" })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field("Coverage", "coverage")}
              {field("Water Ratio", "waterRatio")}
              {field("Pot Life", "potLife")}
              {field("Open Time", "openTime")}
              {field("Tensile Strength", "tensileStrength")}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-[#E66A23] to-[#F59E0B] text-white text-sm font-bold rounded-xl shadow-md shadow-[#E66A23]/25 cursor-pointer disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSubmitting ? "Publishing..." : "Publish Fixing Solution"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
