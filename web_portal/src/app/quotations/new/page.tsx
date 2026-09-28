"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Smartphone,
  ShieldAlert,
  Weight,
  Layers,
  FileSpreadsheet,
  Lock
} from "lucide-react";
import { Customer, QuotationItem } from "@/types";
import { fetchLiveCustomers } from "@/lib/customer-service";
import { fetchOrderById, linkQuotationToOrder, ClientOrderPO } from "@/lib/order-service";

function QuotationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, salesperson, role } = useAuth();

  const prefillCustomerId = searchParams.get("customerId");
  const prefillCustomerName = searchParams.get("name");
  const orderId = searchParams.get("orderId");
  const poNumber = searchParams.get("poNumber");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(prefillCustomerId || "");
  const [paymentTerms, setPaymentTerms] = useState("30 Days Net");
  const [validityDays, setValidityDays] = useState(15);
  const [linkedOrder, setLinkedOrder] = useState<ClientOrderPO | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(!!orderId);

  // Line items state
  const [items, setItems] = useState<QuotationItem[]>([
    {
      productId: "prod-3",
      productName: "Travertino Grigio Rustic",
      sku: "ITA-TRAV-6012",
      size: "600x1200 mm",
      quantityBoxes: 98,
      sqftPerBox: 15.5,
      totalSqft: 1519,
      weightKg: 2842,
      unitPrice: 540,
      discountPercent: 5,
      effectivePrice: 513,
      lineTotal: 50274,
    }
  ]);

  // Available tiles catalogue for adding items manually (if not from client PO)
  const tileTemplates = [
    {
      productId: "prod-1",
      productName: "Statuario White Marble Porcelain",
      sku: "ITA-STAT-6012",
      size: "600x1200 mm",
      sqftPerBox: 15.5,
      weightPerBoxKg: 29.5,
      basePrice: 580,
    },
    {
      productId: "prod-2",
      productName: "Nero Marquina Grand Slab",
      sku: "ITA-NERO-8016",
      size: "800x1600 mm",
      sqftPerBox: 27.56,
      weightPerBoxKg: 54.0,
      basePrice: 920,
    },
    {
      productId: "prod-3",
      productName: "Travertino Grigio Rustic",
      sku: "ITA-TRAV-6012",
      size: "600x1200 mm",
      sqftPerBox: 15.5,
      weightPerBoxKg: 29.0,
      basePrice: 540,
    },
    {
      productId: "prod-4",
      productName: "Calacatta Gold Vitrified",
      sku: "ITA-CALA-6060",
      size: "600x600 mm",
      sqftPerBox: 15.5,
      weightPerBoxKg: 27.5,
      basePrice: 420,
    },
  ];

  const [freightCharges, setFreightCharges] = useState<number>(4500);
  const [taxPercent] = useState<number>(18);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load live customers
  useEffect(() => {
    async function loadCustomers() {
      try {
        const list = await fetchLiveCustomers(user, salesperson, role);
        setCustomers(list);
        if (list.length > 0 && !selectedCustomerId && !orderId) {
          setSelectedCustomerId(list[0].id);
        }
      } catch (err) {
        console.warn("Could not load customers:", err);
        setCustomers([]);
      }
    }

    loadCustomers();
  }, [user, salesperson, role, selectedCustomerId, orderId]);

  // Load client PO if orderId is provided in URL
  useEffect(() => {
    if (!orderId) return;
    let isMounted = true;

    async function loadOrder() {
      setLoadingOrder(true);
      try {
        const po = await fetchOrderById(orderId!);
        if (po && isMounted) {
          setLinkedOrder(po);
          if (po.userId) {
            setSelectedCustomerId(po.userId);
          }

          // Populate line items directly from the client order
          if (po.items && po.items.length > 0) {
            const mappedItems: QuotationItem[] = po.items.map((pi) => {
              const qty = Number(pi.quantityBoxes) || 1;
              const sqftPerBox = Number(pi.sqftPerBox) || 15.5;
              const sqft = Number(pi.quantitySqFt) || Number((qty * sqftPerBox).toFixed(2));
              const weightKg = Number((qty * (pi.weightPerBoxKg || 29.0)).toFixed(1));
              const basePrice = Number(pi.basePrice) || 540;
              const disc = pi.discountPercent !== undefined ? Number(pi.discountPercent) : 5;
              const effPrice = Number((basePrice * (1 - disc / 100)).toFixed(2));
              const total = Number((qty * effPrice).toFixed(2));

              return {
                productId: pi.productId || "prod-po",
                productName: pi.productName || "Tile Item",
                sku: pi.sku || "ITA-SKU",
                size: pi.size || "600x1200 mm",
                finish: pi.surface || "Rustic",
                quantityBoxes: qty,
                sqftPerBox: sqftPerBox,
                totalSqft: sqft,
                weightKg: weightKg,
                unitPrice: basePrice,
                discountPercent: disc,
                effectivePrice: effPrice,
                lineTotal: total,
              };
            });
            setItems(mappedItems);
          }
        }
      } catch (err) {
        console.error("Could not fetch PO details:", err);
      } finally {
        if (isMounted) setLoadingOrder(false);
      }
    }

    loadOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleAddItem = (templateIndex = 0) => {
    // Adding custom items disabled when linked to a client PO
    if (linkedOrder) return;

    const t = tileTemplates[templateIndex % tileTemplates.length];
    const qty = 100;
    const sqft = Number((qty * t.sqftPerBox).toFixed(2));
    const weight = Number((qty * t.weightPerBoxKg).toFixed(1));
    const disc = 5;
    const effPrice = Number((t.basePrice * (1 - disc / 100)).toFixed(2));
    const total = Number((qty * effPrice).toFixed(2));

    setItems(prev => [
      ...prev,
      {
        productId: t.productId,
        productName: t.productName,
        sku: t.sku,
        size: t.size,
        quantityBoxes: qty,
        sqftPerBox: t.sqftPerBox,
        totalSqft: sqft,
        weightKg: weight,
        unitPrice: t.basePrice,
        discountPercent: disc,
        effectivePrice: effPrice,
        lineTotal: total,
      }
    ]);
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    setItems(prev => {
      const copy = [...prev];
      const item = { ...copy[index] };

      // If linked to an order, box count is strictly locked to client order!
      const qty = linkedOrder ? item.quantityBoxes : (field === "quantityBoxes" ? (parseInt(val, 10) || 0) : item.quantityBoxes);
      const uPrice = field === "unitPrice" ? (parseFloat(val) || 0) : item.unitPrice;
      const disc = field === "discountPercent" ? (parseFloat(val) || 0) : item.discountPercent;

      const sqftPerBox = item.sqftPerBox || 15.5;
      const weightPerBoxKg = 29;

      item.quantityBoxes = qty;
      item.unitPrice = uPrice;
      item.discountPercent = disc;
      item.totalSqft = Number((qty * sqftPerBox).toFixed(2));
      item.weightKg = Number((qty * weightPerBoxKg).toFixed(1));
      item.effectivePrice = Number((uPrice * (1 - disc / 100)).toFixed(2));
      item.lineTotal = Number((qty * item.effectivePrice).toFixed(2));

      copy[index] = item;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (linkedOrder) return; // Prevent deleting items from customer PO
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Totals calculations
  const totalBoxes = items.reduce((sum, i) => sum + (i.quantityBoxes || 0), 0);
  const totalWeightKg = items.reduce((sum, i) => sum + (i.weightKg || 0), 0);
  const totalWeightTons = Number((totalWeightKg / 1000).toFixed(2));
  const totalSqft = Number(items.reduce((sum, i) => sum + (i.totalSqft || 0), 0).toFixed(1));

  const subtotal = items.reduce((sum, i) => sum + (i.lineTotal || 0), 0);
  const maxDiscountGiven = items.reduce((max, i) => Math.max(max, i.discountPercent || 0), 0);
  const requiresSpecialApproval = maxDiscountGiven > 15;

  const taxAmount = Number(((subtotal + freightCharges) * (taxPercent / 100)).toFixed(2));
  const grandTotal = Number((subtotal + freightCharges + taxAmount).toFixed(2));

  // Determine active customer
  const foundCust = customers.find(c => c.id === selectedCustomerId);
  const selectedCust: Customer | undefined = foundCust || (linkedOrder ? {
    id: linkedOrder.userId || "cust-po",
    customerNumber: `CUST-${(linkedOrder.userId || "0000").slice(-4)}`,
    name: linkedOrder.customerName || "Valued Client",
    companyName: linkedOrder.companyName || linkedOrder.customerName || "Client Enterprise",
    phone: linkedOrder.customerPhone || "",
    email: "",
    city: "Ahmedabad",
    state: "Gujarat",
    category: "Dealer",
    priceTier: "A",
    creditLimit: 500000,
    paymentTerms: "30 Days Net",
    assignedSalespersonId: linkedOrder.salesPersonId || user?.userId || "",
    status: "active",
    createdAt: linkedOrder.createdAt || new Date().toISOString(),
    updatedAt: linkedOrder.createdAt || new Date().toISOString(),
  } : customers[0]);

  const handleSubmitQuotation = async () => {
    if (!selectedCust) {
      setErrorMsg("Please select a customer.");
      return;
    }

    if (items.length === 0) {
      setErrorMsg("Please add at least one tile product item.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const quoteNumber = `QT-2026-${Math.floor(100 + Math.random() * 900)}`;
      const status = requiresSpecialApproval ? "pending_approval" : "approved";
      const discountTotal = items.reduce((sum, i) => sum + ((i.quantityBoxes * i.unitPrice) - i.lineTotal), 0);

      const docRef = await addDoc(collection(db, "quotations"), {
        quotationNumber: quoteNumber,
        orderId: linkedOrder ? linkedOrder.id : null,
        poNumber: linkedOrder ? (linkedOrder.poNumber || linkedOrder.orderReference) : null,
        customerId: selectedCust.id,
        customerName: selectedCust.companyName || selectedCust.name,
        customerPhone: selectedCust.phone,
        salespersonId: user?.userId || salesperson?.salesPersonId || "sp-1",
        salespersonName: user?.name || salesperson?.name || "Senior Sales Executive",
        status,
        items,
        subtotal,
        discountTotal,
        taxPercent,
        taxAmount,
        shippingCharge: freightCharges,
        grandTotal,
        totalBoxes,
        totalWeightTons,
        paymentTerms,
        validityDays,
        expiryDate: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        requiresSpecialApproval,
        approvalStatus: requiresSpecialApproval ? "pending" : "approved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });

      // If linked to a client order, transition order to rate_quoted in Firestore
      if (linkedOrder) {
        await linkQuotationToOrder(
          linkedOrder.id,
          docRef.id,
          quoteNumber,
          items,
          subtotal,
          discountTotal,
          grandTotal
        );
      }

      // If approval required, create approval request record for Admin
      if (requiresSpecialApproval) {
        await addDoc(collection(db, "approvalRequests"), {
          referenceType: "quotation",
          referenceId: docRef.id,
          referenceNumber: quoteNumber,
          salespersonId: user?.userId || "sp-1",
          salespersonName: user?.name || "Sales Executive",
          customerId: selectedCust.id,
          customerName: selectedCust.companyName || selectedCust.name,
          discountRequested: maxDiscountGiven,
          totalValue: grandTotal,
          reason: `Special discount of ${maxDiscountGiven}% requested (exceeds default 15% threshold)`,
          status: "pending",
          assignedToRole: "admin",
          createdAt: new Date().toISOString(),
          timestamp: serverTimestamp(),
        });
      }

      router.push(`/quotations?quoted=success`);
    } catch (err: any) {
      console.error("Failed to create quotation:", err);
      setErrorMsg(err?.message || "Failed to submit quotation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell
      title="Quotation Builder"
      subtitle={linkedOrder 
        ? `Quoting rates for Client PO: ${linkedOrder.poNumber || linkedOrder.orderReference} (${linkedOrder.customerName})`
        : "Step-by-step tile estimation, live weight/sqft calculation, and instant app sync"
      }
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href="/quotations"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-[#0E274D]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Quotations</span>
        </Link>

        {/* Linked PO Header Alert if quoting client order */}
        {linkedOrder && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-start space-x-3 shadow-xs">
            <FileSpreadsheet className="w-5 h-5 text-[#0E274D] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#0E274D]">
                  Quoting Rates for Client PO: {linkedOrder.poNumber || linkedOrder.orderReference}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-bold uppercase tracking-wide">
                  Mobile App Order
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-medium">
                  {linkedOrder.totalBoxes} Boxes Requested
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Requested by <strong>{linkedOrder.customerName}</strong> ({linkedOrder.companyName || "Direct Client"}). The customer and product box quantities are locked to their order. You can only edit the <strong>Base Price</strong> and <strong>Discount %</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Wizard Steps Bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { num: 1, label: "Customer & Terms" },
            { num: 2, label: "Tile Line Items" },
            { num: 3, label: "Taxes & Review" },
          ].map((s) => (
            <div
              key={s.num}
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2.5 transition-all ${
                step === s.num
                  ? "bg-[#0E274D] text-white border-[#0E274D] shadow-xs"
                  : step > s.num
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-white text-slate-400 border-slate-200"
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step === s.num ? "bg-white text-[#0E274D]" : step > s.num ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
              }`}>
                {step > s.num ? "✓" : s.num}
              </div>
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{errorMsg}</div>
          </div>
        )}

        {/* Step 1: Customer Selection & Payment Terms */}
        {step === 1 && (
          <div className="card-luxury p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-[#0E274D]">Step 1: Client & Quotation Terms</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {linkedOrder 
                  ? "Client account is automatically bound to the incoming order request" 
                  : "Select the account and agree on credit period"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Customer / Dealer Account *
                  </label>
                  {linkedOrder && (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked to Client PO
                    </span>
                  )}
                </div>

                {linkedOrder ? (
                  <div className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#0E274D]">{selectedCust?.companyName || linkedOrder.companyName}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        ({selectedCust?.name || linkedOrder.customerName} • {selectedCust?.phone || linkedOrder.customerPhone})
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                      Tier {selectedCust?.priceTier || "A"}
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.name} • {c.city}, Tier {c.priceTier})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="Immediate / Advance">Immediate / 100% Advance</option>
                  <option value="50% Advance, 50% Before Dispatch">50% Advance, 50% Before Dispatch</option>
                  <option value="30 Days Net">30 Days Net</option>
                  <option value="45 Days Net">45 Days Net</option>
                  <option value="60 Days Net (Requires Credit Check)">60 Days Net (Requires Credit Check)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Quotation Validity (Days)
                </label>
                <input
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value, 10) || 15)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center space-x-2 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <span>Continue to Tile Items</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Line Item Selection (Salesperson edits rate & discount only) */}
        {step === 2 && (
          <div className="card-luxury p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#0E274D]">Step 2: Tile Items & Calculations</h2>
                  {linkedOrder && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-200">
                      Rate & Discount Editing Only
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {linkedOrder
                    ? "Product details and box quantities are fixed to client order. Enter Base Price and Discount % to quote."
                    : "Input box quantities to calculate coverage and transport weight"}
                </p>
              </div>

              {!linkedOrder && (
                <button
                  type="button"
                  onClick={() => handleAddItem(items.length)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Tile Line Item</span>
                </button>
              )}
            </div>

            {/* Line items table */}
            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#0E274D]">{item.productName}</span>
                      <span className="ml-2 text-[11px] font-mono text-slate-500">{item.size} • {item.sku}</span>
                    </div>

                    {linkedOrder ? (
                      <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Client PO Item
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    {/* BOXES - Read-only if linkedOrder */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Boxes {linkedOrder && <span className="text-slate-400 font-normal">(Locked)</span>}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantityBoxes}
                        disabled={!!linkedOrder}
                        readOnly={!!linkedOrder}
                        onChange={(e) => handleUpdateItem(idx, "quantityBoxes", e.target.value)}
                        className={`w-full px-2.5 py-1.5 border rounded text-xs font-bold ${
                          linkedOrder 
                            ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed" 
                            : "bg-white text-slate-800 border-slate-200"
                        }`}
                        title={linkedOrder ? "Box count is fixed to customer PO request" : ""}
                      />
                    </div>

                    {/* COVERAGE - Calculated sqft */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Coverage</label>
                      <span className="text-xs font-semibold text-slate-700 block py-1.5">{item.totalSqft} sqft</span>
                    </div>

                    {/* BASE PRICE - EDITABLE BY SALESPERSON */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-700 block mb-1 flex items-center justify-between">
                        <span>Base Price</span>
                        {linkedOrder && <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">Edit</span>}
                      </label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(idx, "unitPrice", e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#0E274D] focus:ring-2 focus:ring-[#0E274D] rounded text-xs font-bold text-slate-900"
                        placeholder="Rate (₹)"
                      />
                    </div>

                    {/* DISCOUNT % - EDITABLE BY SALESPERSON */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-700 block mb-1 flex items-center justify-between">
                        <span>Discount %</span>
                        {linkedOrder && <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">Edit</span>}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={item.discountPercent}
                        onChange={(e) => handleUpdateItem(idx, "discountPercent", e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#0E274D] focus:ring-2 focus:ring-[#0E274D] rounded text-xs font-bold text-slate-900"
                        placeholder="0"
                      />
                    </div>

                    {/* LINE TOTAL - Dynamically calculated */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Line Total</label>
                      <span className="text-xs font-bold text-[#0E274D] block py-1.5">
                        ₹{Number(item.lineTotal).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Metrics Capsule */}
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-700">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <span>Total Boxes: <strong className="text-[#0E274D]">{totalBoxes}</strong></span>
              </div>
              <div className="flex items-center space-x-2">
                <Weight className="w-4 h-4 text-slate-500" />
                <span>Estimated Weight: <strong className="text-[#0E274D]">{totalWeightTons} Tons</strong></span>
              </div>
              <div>
                <span>Total Area: <strong className="text-[#0E274D]">{totalSqft} Sqft</strong></span>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-[#0E274D]">Subtotal: ₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                &larr; Back
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center space-x-2 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <span>Continue to Taxes & Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Freight, Taxes & Review */}
        {step === 3 && (
          <div className="card-luxury p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-[#0E274D]">Step 3: Taxes, Freight & Review</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {linkedOrder 
                  ? "Finalize quotation and sync rate quote directly to client mobile app" 
                  : "Finalize transport charges and check approval criteria"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Freight input and parameters */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Estimated Freight / Transport Charge (₹)
                  </label>
                  <input
                    type="number"
                    value={freightCharges}
                    onChange={(e) => setFreightCharges(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Based on ~{totalWeightTons} Tons shipment weight</p>
                </div>

                {requiresSpecialApproval ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center space-x-2 font-bold text-xs text-amber-800">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span>Admin Approval Required</span>
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      You have offered a discount of <strong>{maxDiscountGiven}%</strong> on at least one line item, which exceeds your standard 15% salesperson authorization limit. Upon submission, this quotation will be routed to Admin for signoff before customer app visibility.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                    <div className="flex items-center space-x-2 font-bold text-xs text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Instant Approval & Customer App Sync</span>
                    </div>
                    <p className="text-xs text-emerald-700">
                      Discount is within authorized thresholds (≤15%). Rates will immediately reflect in the client&apos;s mobile app order!
                    </p>
                  </div>
                )}

                {linkedOrder && (
                  <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>Live Mobile App Order Sync</span>
                    </div>
                    <p className="text-[11px] text-blue-700 leading-normal">
                      Submitting will automatically transition client order <strong>{linkedOrder.poNumber || linkedOrder.orderReference}</strong> status to <span className="font-mono font-bold bg-blue-100 px-1 rounded">rate_quoted</span> in Firebase.
                    </p>
                  </div>
                )}
              </div>

              {/* Bill breakdown summary card */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Summary</h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Products Subtotal ({items.length} items):</span>
                    <span className="font-semibold">₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Freight / Transport:</span>
                    <span className="font-semibold">₹{freightCharges.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (18%):</span>
                    <span className="font-semibold">₹{taxAmount.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-sm">
                    <span className="font-bold text-[#0E274D]">Grand Total:</span>
                    <span className="text-xl font-extrabold text-[#0E274D]">
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 flex items-center space-x-2">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Destination: {selectedCust?.companyName || selectedCust?.name}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                &larr; Back
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitQuotation}
                className="flex items-center space-x-2 px-6 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSubmitting 
                    ? "Generating Quotation..." 
                    : (linkedOrder ? "Submit Rates to Client App" : "Create & Submit Quotation")}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function NewQuotationPage() {
  return (
    <Suspense fallback={
      <DashboardShell title="Quotation Builder">
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin" />
        </div>
      </DashboardShell>
    }>
      <QuotationForm />
    </Suspense>
  );
}
