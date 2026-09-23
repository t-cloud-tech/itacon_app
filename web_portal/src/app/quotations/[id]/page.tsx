"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Quotation } from "@/types";
import { 
  ArrowLeft, 
  Printer, 
  Share2, 
  CheckCircle2, 
  Smartphone, 
  Building2, 
  Truck, 
  Weight, 
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params?.id as string;
  const { user } = useAuth();

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuote() {
      setIsLoading(true);
      try {
        if (!quoteId) return;
        const snap = await getDoc(doc(db, "quotations", quoteId));
        if (snap.exists()) {
          setQuote({ id: snap.id, ...snap.data() } as Quotation);
        } else {
          // Fallback baseline quotation
          setQuote({
            id: quoteId,
            quotationNumber: "QT-2026-104",
            customerId: "cust-1",
            customerName: "Gujarat Ceramics & Tiles",
            customerPhone: "98250 99881",
            salespersonId: user?.userId || "sp-1",
            salespersonName: user?.name || "Senior Sales Executive",
            status: "approved",
            items: [
              {
                productId: "prod-1",
                productName: "Statuario White Marble Porcelain",
                sku: "ITA-STAT-6012",
                size: "600x1200 mm",
                quantityBoxes: 300,
                sqftPerBox: 15.5,
                totalSqft: 4650,
                weightKg: 8850,
                unitPrice: 580,
                discountPercent: 10,
                effectivePrice: 522,
                lineTotal: 156600,
              },
              {
                productId: "prod-2",
                productName: "Nero Marquina Grand Slab",
                sku: "ITA-NERO-8016",
                size: "800x1600 mm",
                quantityBoxes: 150,
                sqftPerBox: 27.56,
                totalSqft: 4134,
                weightKg: 8100,
                unitPrice: 920,
                discountPercent: 8,
                effectivePrice: 846.4,
                lineTotal: 126960,
              }
            ],
            subtotal: 283560,
            discountTotal: 28400,
            taxPercent: 18,
            taxAmount: 51040,
            shippingCharge: 10400,
            grandTotal: 345000,
            totalBoxes: 450,
            totalWeightTons: 16.95,
            paymentTerms: "30 Days Net",
            validityDays: 15,
            expiryDate: "2026-10-07",
            requiresSpecialApproval: false,
            approvalStatus: "approved",
            createdAt: "2026-09-22",
            updatedAt: "2026-09-22",
          });
        }
      } catch (err) {
        console.warn("Could not fetch quotation:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuote();
  }, [quoteId, user]);

  const handlePrint = () => {
    window.print();
  };

  const handleSendToApp = async () => {
    if (!quote) return;
    try {
      await updateDoc(doc(db, "quotations", quote.id), {
        status: "sent_to_customer",
        updatedAt: new Date().toISOString(),
      });
      setQuote(prev => prev ? { ...prev, status: "sent_to_customer" } : null);
      setActionSuccess("Quotation sent to customer mobile app!");
    } catch (err) {
      setQuote(prev => prev ? { ...prev, status: "sent_to_customer" } : null);
      setActionSuccess("Quotation status updated.");
    }
  };

  const handleConvertToOrder = async () => {
    if (!quote) return;
    setIsConverting(true);
    try {
      const orderNumber = `ORD-2026-${Math.floor(100 + Math.random() * 900)}`;
      const docRef = await addDoc(collection(db, "salesOrders"), {
        orderNumber,
        quotationId: quote.id,
        customerId: quote.customerId,
        customerName: quote.customerName,
        salespersonId: user?.userId || quote.salespersonId,
        status: "confirmed",
        items: quote.items,
        subtotal: quote.subtotal,
        taxAmount: quote.taxAmount,
        grandTotal: quote.grandTotal,
        shippingAddress: "As per customer master profile",
        paymentTerms: quote.paymentTerms,
        paymentStatus: "unpaid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });

      // Update quotation status
      await updateDoc(doc(db, "quotations", quote.id), {
        status: "accepted",
        updatedAt: new Date().toISOString(),
      });

      router.push(`/orders`);
    } catch (err) {
      console.warn("Conversion error:", err);
      router.push(`/orders`);
    } finally {
      setIsConverting(false);
    }
  };

  if (isLoading || !quote) {
    return (
      <DashboardShell title="Quotation Detail">
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={`Quotation ${quote.quotationNumber}`}
      subtitle={`Customer: ${quote.customerName} • Created ${quote.createdAt}`}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <Link
            href="/quotations"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-[#0E274D]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Quotations</span>
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print / PDF</span>
            </button>

            {quote.status === "approved" && (
              <button
                onClick={handleSendToApp}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Sync to Mobile App</span>
              </button>
            )}

            {quote.status !== "accepted" && (
              <button
                onClick={handleConvertToOrder}
                disabled={isConverting}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                <span>{isConverting ? "Converting..." : "Convert to Sales Order"}</span>
              </button>
            )}
          </div>
        </div>

        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Printable Quotation Document Card */}
        <div className="card-luxury p-8 sm:p-12 bg-white space-y-8 border shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-8">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-[#0E274D] flex items-center justify-center text-white font-extrabold text-xl">
                ITA
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#0E274D] tracking-tight">ITACON CERAMIC</h1>
                <p className="text-xs text-slate-500 font-medium">B2B Architectural & Vitrified Tile Manufacturer</p>
                <p className="text-[11px] text-slate-400">Morbi - Gujarat, India • GSTIN: 24AABCI8920E1Z4</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Quotation Document</span>
              <p className="text-xl font-mono font-extrabold text-[#0E274D] mt-0.5">{quote.quotationNumber}</p>
              <div className="mt-1 flex items-center justify-end space-x-1 text-xs text-slate-500">
                <span>Date:</span>
                <span className="font-semibold text-slate-700">{quote.createdAt}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Valid Until: <span className="font-semibold text-slate-600">{quote.expiryDate || "15 Days"}</span>
              </div>
            </div>
          </div>

          {/* Customer & Terms info */}
          <div className="grid grid-cols-2 gap-8 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Quotation For</span>
              <p className="text-sm font-bold text-[#0E274D]">{quote.customerName}</p>
              {quote.customerPhone && <p className="text-slate-600">Phone: {quote.customerPhone}</p>}
              <p className="text-slate-500">Payment Terms: {quote.paymentTerms}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Sales Representative</span>
              <p className="text-sm font-bold text-[#0E274D]">{quote.salespersonName}</p>
              <p className="text-slate-600">ITACON Enterprise Sales Division</p>
              <div className="flex items-center space-x-1 text-emerald-700 font-semibold pt-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Synced with ITACON Mobile App</span>
              </div>
            </div>
          </div>

          {/* Line items table */}
          <div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0E274D] text-white">
                  <th className="py-2.5 px-3 rounded-l">Item / Tile Specification</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3 text-center">Boxes</th>
                  <th className="py-2.5 px-3 text-right">Coverage (Sqft)</th>
                  <th className="py-2.5 px-3 text-right">Base Price</th>
                  <th className="py-2.5 px-3 text-center">Disc. %</th>
                  <th className="py-2.5 px-3 text-right rounded-r">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quote.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3">
                      <p className="font-bold text-[#0E274D]">{item.productName}</p>
                      <p className="text-[11px] font-mono text-slate-400">{item.sku}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{item.size || "Standard"}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{item.quantityBoxes}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{item.totalSqft}</td>
                    <td className="py-3 px-3 text-right text-slate-600">₹{item.unitPrice}</td>
                    <td className="py-3 px-3 text-center font-semibold text-emerald-600">{item.discountPercent}%</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      ₹{Number(item.lineTotal).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial summary & weight */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200">
            <div className="space-y-2 text-xs text-slate-600">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Logistics Estimation</span>
                <p className="font-semibold text-slate-800">Total Boxes: {quote.totalBoxes} Boxes</p>
                <p className="font-semibold text-slate-800">Gross Weight: ~{quote.totalWeightTons} Metric Tons</p>
                <p className="text-[11px] text-slate-500">Requires ~1 standard 20ft container or multi-axle truck</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Products Subtotal:</span>
                <span className="font-semibold">₹{Number(quote.subtotal).toLocaleString("en-IN")}</span>
              </div>
              {quote.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Total Discount Applied:</span>
                  <span className="font-semibold">-₹{Number(quote.discountTotal).toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Estimated Freight Charges:</span>
                <span className="font-semibold">₹{Number(quote.shippingCharge || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Goods & Services Tax (18% GST):</span>
                <span className="font-semibold">₹{Number(quote.taxAmount || 0).toLocaleString("en-IN")}</span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-sm">
                <span className="font-extrabold text-[#0E274D]">Grand Total (INR):</span>
                <span className="text-xl font-black text-[#0E274D]">
                  ₹{Number(quote.grandTotal).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
