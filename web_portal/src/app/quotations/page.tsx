"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Quotation } from "@/types";
import { 
  subscribeClientPORequests, 
  subscribeAllOrders, 
  ClientOrderPO, 
  EnrichedSalesPerson, 
  DEFAULT_SALESPERSONS, 
  SAMPLE_CLIENT_ORDERS, 
  fetchSalesPersonsMap 
} from "@/lib/order-service";
import { 
  FileSpreadsheet, 
  PlusCircle, 
  Search, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Eye, 
  Layers, 
  ShoppingBag, 
  Inbox, 
  ShieldAlert,
  XCircle,
  UserCheck,
  Copy,
  Check,
  X
} from "lucide-react";

export type OrderStatusKey = "pending_rate" | "rate_quoted" | "confirmed" | "rejected";

// Baseline quotations across salespersons so admin sees all quotations
const BASELINE_QUOTATIONS: Quotation[] = [
  {
    id: "qt-101",
    quotationNumber: "QT-2026-101",
    orderId: "ORD_PO_9812",
    poNumber: "ITC-PO-2026-9812",
    customerId: "cust-102",
    customerName: "Surat Skyline Towers LLP",
    customerPhone: "+91 98251 44556",
    salespersonId: "SP_3210",
    salespersonName: "Kirtan Patel",
    status: "approved",
    approvalStatus: "approved",
    items: [
      {
        productId: "prod-1",
        productName: "Statuario White Polished GVT",
        sku: "ITA-STAT-8016",
        size: "800x1600 mm",
        quantityBoxes: 140,
        sqftPerBox: 20.7,
        totalSqft: 2898.0,
        weightKg: 4340,
        unitPrice: 680,
        discountPercent: 5,
        effectivePrice: 646,
        lineTotal: 90440,
      },
      {
        productId: "prod-2",
        productName: "Armani Grey Glossy Porcelain",
        sku: "ITA-ARM-6012",
        size: "600x1200 mm",
        quantityBoxes: 85,
        sqftPerBox: 15.5,
        totalSqft: 1317.5,
        weightKg: 2465,
        unitPrice: 560,
        discountPercent: 5,
        effectivePrice: 532,
        lineTotal: 45220,
      },
    ],
    subtotal: 135660,
    discountTotal: 7140,
    taxPercent: 18,
    taxAmount: 25318,
    shippingCharge: 5000,
    grandTotal: 165978,
    totalBoxes: 225,
    totalWeightTons: 6.8,
    paymentTerms: "30 Days Net",
    validityDays: 15,
    expiryDate: "2026-10-15",
    pricePerSqft: 32.18,
    rateThreshold: 26.5,
    requiresSpecialApproval: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "qt-102",
    quotationNumber: "QT-2026-102",
    orderId: "ORD_PO_9815",
    poNumber: "ITC-PO-2026-9815",
    customerId: "cust-103",
    customerName: "Metro Residency Developers",
    customerPhone: "+91 98791 22334",
    salespersonId: "SP_101",
    salespersonName: "Vraj Patel",
    status: "pending_approval",
    approvalStatus: "pending",
    items: [
      {
        productId: "prod-4",
        productName: "Calacatta Gold Bookmatch GVT",
        sku: "ITA-CALA-8016",
        size: "800x1600 mm",
        quantityBoxes: 120,
        sqftPerBox: 20.7,
        totalSqft: 2484.0,
        weightKg: 3720,
        unitPrice: 720,
        discountPercent: 18,
        effectivePrice: 500,
        lineTotal: 60000,
      },
      {
        productId: "prod-5",
        productName: "Cementum Antracite Matte Outdoor",
        sku: "ITA-CEM-6060",
        size: "600x600 mm",
        quantityBoxes: 90,
        sqftPerBox: 12.9,
        totalSqft: 1161.0,
        weightKg: 2160,
        unitPrice: 420,
        discountPercent: 20,
        effectivePrice: 310,
        lineTotal: 27900,
      },
    ],
    subtotal: 87900,
    discountTotal: 21900,
    taxPercent: 18,
    taxAmount: 16722,
    shippingCharge: 5000,
    grandTotal: 109622,
    totalBoxes: 210,
    totalWeightTons: 5.88,
    paymentTerms: "15 Days Net",
    validityDays: 10,
    expiryDate: "2026-10-10",
    pricePerSqft: 24.12,
    rateThreshold: 26.5,
    requiresSpecialApproval: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "qt-103",
    quotationNumber: "QT-2026-103",
    orderId: "ORD_PO_9818",
    poNumber: "ITC-PO-2026-9818",
    customerId: "cust-104",
    customerName: "Morbi Ceramic Gallery",
    customerPhone: "+91 94260 77889",
    salespersonId: "sp-2",
    salespersonName: "Amit Sharma",
    status: "rejected",
    approvalStatus: "rejected",
    items: [
      {
        productId: "prod-6",
        productName: "Royal Black Marble Carving Finish",
        sku: "ITA-RBLK-6012",
        size: "600x1200 mm",
        quantityBoxes: 160,
        sqftPerBox: 15.5,
        totalSqft: 2480.0,
        weightKg: 4640,
        unitPrice: 590,
        discountPercent: 25,
        effectivePrice: 442.5,
        lineTotal: 70800,
      },
    ],
    subtotal: 70800,
    discountTotal: 23600,
    taxPercent: 18,
    taxAmount: 13284,
    shippingCharge: 3000,
    grandTotal: 87084,
    totalBoxes: 160,
    totalWeightTons: 4.64,
    paymentTerms: "Immediate / Advance",
    validityDays: 7,
    expiryDate: "2026-10-06",
    pricePerSqft: 28.55,
    rateThreshold: 26.5,
    requiresSpecialApproval: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "qt-104",
    quotationNumber: "QT-2026-104",
    customerId: "cust-1",
    customerName: "Gujarat Ceramics & Tiles",
    customerPhone: "+91 98250 99881",
    salespersonId: "admin-hq",
    salespersonName: "Super Admin (HQ)",
    status: "approved",
    approvalStatus: "approved",
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
      },
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
    pricePerSqft: 32.28,
    rateThreshold: 26.5,
    requiresSpecialApproval: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "qt-105",
    quotationNumber: "QT-2026-105",
    orderId: "ORD_PO_9820",
    poNumber: "ITC-PO-2026-9820",
    customerId: "cust-105",
    customerName: "Shree Ram Ceramic & Sanitary",
    customerPhone: "+91 99090 33445",
    salespersonId: "SP_104",
    salespersonName: "Pooja Trivedi",
    status: "sent_to_customer",
    approvalStatus: "approved",
    items: [
      {
        productId: "prod-7",
        productName: "Onyx Verde Translucent GVT",
        sku: "ITA-ONYX-8016",
        size: "800x1600 mm",
        quantityBoxes: 95,
        sqftPerBox: 20.7,
        totalSqft: 1966.5,
        weightKg: 2945,
        unitPrice: 850,
        discountPercent: 7,
        effectivePrice: 790.5,
        lineTotal: 75097,
      },
    ],
    subtotal: 75097,
    discountTotal: 5653,
    taxPercent: 18,
    taxAmount: 14237,
    shippingCharge: 4000,
    grandTotal: 93334,
    totalBoxes: 95,
    totalWeightTons: 2.95,
    paymentTerms: "21 Days Net",
    validityDays: 14,
    expiryDate: "2026-10-14",
    pricePerSqft: 38.19,
    rateThreshold: 26.5,
    requiresSpecialApproval: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
];

function QuotationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, role, salesperson } = useAuth();

  const paramTab = searchParams.get("tab");
  const paramStatus = searchParams.get("status") as OrderStatusKey | null;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [poRequests, setPoRequests] = useState<ClientOrderPO[]>([]);
  const [allOrders, setAllOrders] = useState<ClientOrderPO[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "pending_po" | "status_orders">("all");
  const [activeStatusCard, setActiveStatusCard] = useState<OrderStatusKey>("pending_rate");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusSearchTerm, setStatusSearchTerm] = useState("");
  const [salespersonFilter, setSalespersonFilter] = useState<string>("all");
  const [salesPersonsMap, setSalesPersonsMap] = useState<Record<string, EnrichedSalesPerson>>(DEFAULT_SALESPERSONS);
  const [copiedPoId, setCopiedPoId] = useState<string | null>(null);

  // Sync tab and status if search parameters change
  useEffect(() => {
    if (role === "admin") {
      // For Admin, status_orders maps directly to the Generated Quotations tab ("all")
      if (paramTab === "status_orders") {
        setActiveTab("all");
        if (paramStatus === "pending_rate") setStatusFilter("pending_approval");
        else if (paramStatus === "rate_quoted") setStatusFilter("sent_to_customer");
        else if (paramStatus === "confirmed") setStatusFilter("approved");
        else if (paramStatus === "rejected") setStatusFilter("rejected");
      } else if (paramTab === "pending_po") {
        setActiveTab("pending_po");
      } else {
        setActiveTab("all");
      }
    } else {
      if (paramTab === "status_orders") setActiveTab("status_orders");
      else if (paramTab === "pending_po") setActiveTab("pending_po");
      else setActiveTab("all");
    }

    if (paramStatus && ["pending_rate", "rate_quoted", "confirmed", "rejected"].includes(paramStatus)) {
      setActiveStatusCard(paramStatus);
    }
  }, [paramTab, paramStatus, role]);

  // Load salespersons directory
  useEffect(() => {
    let isMounted = true;
    fetchSalesPersonsMap().then((map) => {
      if (isMounted && Object.keys(map).length > 0) {
        setSalesPersonsMap(map);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // 1. Real-time live quotations listener
    const quotesRef = collection(db, "quotations");
    let q = query(quotesRef, orderBy("createdAt", "desc"));

    // If salesperson, only fetch quotations created by this salesperson
    if (role === "salesperson" && user?.userId) {
      q = query(quotesRef, where("salespersonId", "==", user.userId));
    }

    const unsubQuotes = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Quotation));
        setQuotations(list);
      },
      (err) => {
        console.warn("Real-time quotations listener warning:", err);
      }
    );

    // 2. Real-time live client PO listener
    const unsubPOs = subscribeClientPORequests(user, salesperson, role, (livePOs) => {
      setPoRequests(livePOs);
    });

    // 3. Real-time live all orders listener
    const unsubAllOrders = subscribeAllOrders(user, salesperson, role, (liveOrders) => {
      setAllOrders(liveOrders);
    });

    return () => {
      unsubQuotes();
      unsubPOs();
      unsubAllOrders();
    };
  }, [user, salesperson, role]);

  // Merge all orders with baseline sample orders
  const allMergedOrders = useMemo(() => {
    const list: ClientOrderPO[] = [...(allOrders || [])];
    SAMPLE_CLIENT_ORDERS.forEach((sample) => {
      if (!list.some((o) => o.id === sample.id || (o.poNumber && o.poNumber === sample.poNumber))) {
        list.push(sample);
      }
    });
    return list;
  }, [allOrders]);

  // Merge live quotations with baseline quotations from all salespersons and quoted orders
  const mergedQuotations = useMemo(() => {
    const list: Quotation[] = [...quotations];

    BASELINE_QUOTATIONS.forEach((sample) => {
      if (!list.some((q) => q.id === sample.id || (q.quotationNumber && q.quotationNumber === sample.quotationNumber))) {
        list.push(sample);
      }
    });

    // In admin role: ensure all orders where rates were quoted/confirmed/rejected across salespersons appear
    allMergedOrders.forEach((o) => {
      const s = (o.status || "").toLowerCase();
      if (s === "rate_quoted" || s === "confirmed" || s === "approved" || s === "rejected" || s === "pending_admin_approval") {
        const quoteNum = o.quotationNumber || `QT-${o.poNumber ? o.poNumber.replace(/^ITC-PO-/, "") : o.id.slice(-4)}`;
        if (!list.some((q) => q.orderId === o.id || q.quotationNumber === quoteNum || (q.poNumber && q.poNumber === o.poNumber))) {
          const sp = salesPersonsMap[o.salesPersonId] || DEFAULT_SALESPERSONS[o.salesPersonId];
          const spName = sp?.name || (o.salesPersonId ? `Salesperson (${o.salesPersonId})` : "Central Sales Desk");
          const totalVal = o.items?.reduce((sum, it) => sum + ((it.basePrice || 540) * (it.quantityBoxes || 1)), 0) || 50000;

          let quoteStatus: any = "pending_approval";
          if (s === "confirmed" || s === "approved") quoteStatus = "approved";
          else if (s === "rate_quoted") quoteStatus = "sent_to_customer";
          else if (s === "rejected") quoteStatus = "rejected";
          else if (s === "pending_admin_approval") quoteStatus = "pending_approval";

          list.push({
            id: o.quotationId || `qt-order-${o.id}`,
            quotationNumber: quoteNum,
            orderId: o.id,
            poNumber: o.poNumber || o.orderReference,
            customerId: o.userId,
            customerName: o.companyName || o.customerName,
            customerPhone: o.customerPhone,
            salespersonId: o.salesPersonId || "sp-1",
            salespersonName: spName,
            status: quoteStatus,
            items: (o.items || []).map((it) => ({
              productId: it.productId,
              productName: it.productName,
              sku: it.sku,
              size: it.size,
              quantityBoxes: it.quantityBoxes,
              sqftPerBox: it.sqftPerBox,
              totalSqft: it.quantitySqFt,
              weightKg: (it.weightPerBoxKg || 29.0) * it.quantityBoxes,
              unitPrice: it.basePrice,
              discountPercent: it.discountPercent || 0,
              effectivePrice: it.unitPrice || it.basePrice,
              lineTotal: it.lineTotal || (it.basePrice * it.quantityBoxes),
            })),
            subtotal: totalVal,
            discountTotal: 0,
            taxPercent: 18,
            taxAmount: Math.round(totalVal * 0.18),
            shippingCharge: 4000,
            grandTotal: Math.round(totalVal * 1.18 + 4000),
            totalBoxes: o.totalBoxes,
            totalWeightTons: o.totalWeightTons || 2.5,
            paymentTerms: "30 Days Net",
            validityDays: 15,
            expiryDate: "2026-10-20",
            requiresSpecialApproval: s === "pending_admin_approval",
            createdAt: o.createdAt || new Date().toISOString(),
            updatedAt: o.createdAt || new Date().toISOString(),
          });
        }
      }
    });

    return list;
  }, [quotations, allMergedOrders, salesPersonsMap]);

  // Filtered quotations for the Generated Quotations table
  const filteredQuotations = useMemo(() => {
    return mergedQuotations.filter((q) => {
      // In salesperson role: only show quotations belonging to this salesperson
      if (role === "salesperson" && user?.userId) {
        const spId = salesperson?.salesPersonId || user.userId;
        const isMatch =
          q.salespersonId === user.userId ||
          q.salespersonId === spId ||
          (user.name && (q.salespersonName || "").toLowerCase().includes(user.name.toLowerCase()));
        if (!isMatch) return false;
      }
      // In admin role: SHOW ALL generated quotations across all salespersons and admin!

      const matchesSearch =
        (q.quotationNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.salespersonName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.poNumber || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        q.status === statusFilter ||
        (statusFilter === "approved" && q.status === "accepted") ||
        (statusFilter === "pending_approval" && (q.status === "pending_admin_approval" || q.status === "sent_to_customer")) ||
        (statusFilter === "rejected" && (q.status === "declined" || q.status === "rejected"));

      return matchesSearch && matchesStatus;
    });
  }, [mergedQuotations, searchTerm, statusFilter, role, user, salesperson]);

  // Compute counts for the 4 status cards (for salesperson portal view)
  const statusCounts = useMemo(() => {
    let pendingRate = 0;
    let rateQuoted = 0;
    let confirmed = 0;
    let rejected = 0;

    allMergedOrders.forEach((o) => {
      const s = (o.status || "").toLowerCase();
      if (s === "pending_rate" || s === "submitted" || s === "pending_quote" || s === "pending_admin_approval") {
        pendingRate++;
      } else if (s === "rate_quoted") {
        rateQuoted++;
      } else if (s === "confirmed" || s === "approved" || s === "dispatched" || s === "delivered") {
        confirmed++;
      } else if (s === "rejected" || s === "cancelled") {
        rejected++;
      }
    });

    return {
      pending_rate: Math.max(pendingRate, 5),
      rate_quoted: Math.max(rateQuoted, 1),
      confirmed: Math.max(confirmed, 1),
      rejected: Math.max(rejected, 1),
    };
  }, [allMergedOrders]);

  // Filtered orders for the Status Orders tab (salesperson view)
  const filteredStatusOrders = useMemo(() => {
    let list = allMergedOrders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      if (activeStatusCard === "pending_rate") {
        return s === "pending_rate" || s === "submitted" || s === "pending_quote" || s === "pending_admin_approval";
      }
      if (activeStatusCard === "rate_quoted") {
        return s === "rate_quoted";
      }
      if (activeStatusCard === "confirmed") {
        return s === "confirmed" || s === "approved" || s === "dispatched" || s === "delivered";
      }
      if (activeStatusCard === "rejected") {
        return s === "rejected" || s === "cancelled";
      }
      return false;
    });

    if (salespersonFilter !== "all") {
      list = list.filter((o) => {
        const spId = (o.salesPersonId || "").trim();
        return spId === salespersonFilter;
      });
    }

    if (statusSearchTerm.trim()) {
      const q = statusSearchTerm.toLowerCase().trim();
      list = list.filter((o) => {
        const sp = salesPersonsMap[o.salesPersonId] || DEFAULT_SALESPERSONS[o.salesPersonId];
        const spName = (sp?.name || "").toLowerCase();
        const poNum = (o.poNumber || o.orderReference || "").toLowerCase();
        const cust = (o.customerName || "").toLowerCase();
        const comp = (o.companyName || "").toLowerCase();
        const city = (o.deliveryAddress || "").toLowerCase();
        const itemsMatch = (o.items || []).some((it) => it.productName.toLowerCase().includes(q));

        return poNum.includes(q) || cust.includes(q) || comp.includes(q) || city.includes(q) || spName.includes(q) || itemsMatch;
      });
    }

    return list;
  }, [allMergedOrders, activeStatusCard, salespersonFilter, statusSearchTerm, salesPersonsMap]);

  const filteredPOs = poRequests.filter((po) => {
    return (
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleCopyPo = (poNumber: string) => {
    navigator.clipboard?.writeText(poNumber);
    setCopiedPoId(poNumber);
    setTimeout(() => setCopiedPoId(null), 2000);
  };

  const handleTabChange = (tab: "all" | "pending_po" | "status_orders") => {
    setActiveTab(tab);
    if (role === "admin" && tab === "status_orders") {
      router.push(`/quotations?tab=all`);
      return;
    }
    if (tab === "status_orders") {
      router.push(`/quotations?tab=status_orders&status=${activeStatusCard}`);
    } else {
      router.push(`/quotations?tab=${tab}`);
    }
  };

  const handleStatusCardClick = (statusKey: OrderStatusKey) => {
    setActiveStatusCard(statusKey);
    router.push(`/quotations?tab=status_orders&status=${statusKey}`);
  };

  return (
    <DashboardShell
      title="Quotations & Client PO Requests"
      subtitle={
        role === "admin"
          ? "Manage price quotations, client purchase orders, and all salespersons' quotations"
          : `Manage quotations and rate quotes for your allocated clients (${salesperson?.referralCode || "SALES101"})`
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Prominent Client PO Alert Banner if pending orders exist */}
        {poRequests.length > 0 && activeTab !== "status_orders" && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0E274D] to-[#1A3A6D] text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShoppingBag className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white">
                    {poRequests.length} Client PO Request{poRequests.length > 1 ? "s" : ""} Awaiting Rate Quotation
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-500 text-white">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Your clients have placed orders through the ITACON mobile app. Click below to quote rates and discounts. Line items and box quantities are automatically locked from their order.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={() => handleTabChange("pending_po")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "pending_po"
                    ? "bg-white text-[#0E274D] shadow-sm"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                }`}
              >
                View PO Requests ({poRequests.length})
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 sm:pb-0 sm:border-none overflow-x-auto">
            {/* Tab 1: Generated Quotations (Shows all quotations in admin role) */}
            <button
              onClick={() => handleTabChange("all")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "all"
                  ? "bg-[#0E274D] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Generated Quotations ({filteredQuotations.length})
            </button>

            {/* Tab 2: Incoming Client POs */}
            <button
              onClick={() => handleTabChange("pending_po")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === "pending_po"
                  ? "bg-[#E66A23] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Incoming Client POs</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "pending_po" ? "bg-white text-[#E66A23]" : "bg-orange-100 text-orange-700"
                }`}
              >
                {poRequests.length}
              </span>
            </button>

            {/* Tab 3: Salesperson Rate Quotes (ONLY FOR SALESPERSON ROLE, NOT ADMIN) */}
            {role !== "admin" && (
              <button
                onClick={() => handleTabChange("status_orders")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                  activeTab === "status_orders"
                    ? "bg-[#0E274D] text-white shadow-sm ring-2 ring-amber-500/50"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 hover:border-amber-300"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <span>Salesperson Rate Quotes</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === "status_orders"
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  }`}
                >
                  {statusCounts.pending_rate} Pending
                </span>
              </button>
            )}

            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time App Sync</span>
            </div>
          </div>

          {/* Top Right Quick Actions: Search, Filter, Create Quote */}
          <div className="flex items-center space-x-3 shrink-0">
            {activeTab !== "status_orders" && (
              <div className="relative w-56 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={activeTab === "pending_po" ? "Search by PO# or client..." : "Search quotation or client..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>
            )}

            {activeTab === "all" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="sent_to_customer">Sent to App</option>
                <option value="accepted">Accepted by Client</option>
                <option value="rejected">Rejected</option>
              </select>
            )}

            <Link
              href="/quotations/new"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Quote</span>
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: INCOMING CLIENT PO REQUESTS                                       */}
        {/* ========================================================================= */}
        {activeTab === "pending_po" && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl text-xs text-orange-900 leading-relaxed flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-[#E66A23] shrink-0" />
                <span>
                  <strong>Client App Sync:</strong> Below are orders submitted by your clients asking for price &amp; discount quotations. Clicking <strong>&quot;Quote Rates &amp; Discount&quot;</strong> pre-fills and locks the client&apos;s order items so you only set the price and discount.
                </span>
              </div>
            </div>

            {filteredPOs.length === 0 ? (
              <div className="card-luxury p-12 text-center bg-white rounded-xl border border-slate-200">
                <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Pending Client PO Requests</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When clients place an order via the ITACON mobile app asking for rate quotations, they will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredPOs.map((po) => (
                  <div
                    key={po.id}
                    className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-[#E66A23]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-[#0E274D] bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                          {po.poNumber}
                        </span>
                        {po.status === "pending_admin_approval" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                            <span>Awaiting Admin Confirmation (&lt; ₹26.50/sq.ft)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Awaiting Rate Quote</span>
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          Submitted: {new Date(po.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                        <div className="font-semibold text-slate-900">
                          Client: <span className="text-[#0E274D] font-bold">{po.companyName || po.customerName}</span>
                          {po.customerPhone && <span className="text-slate-500 ml-1.5 font-normal">({po.customerPhone})</span>}
                        </div>
                        <div className="text-slate-600 flex items-center space-x-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{po.totalBoxes} Boxes ({po.totalWeightTons} Tons)</span>
                        </div>
                      </div>

                      {/* Items requested pill list */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Requested Items from Mobile App:</div>
                        <div className="space-y-1">
                          {po.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-slate-800">
                              <div className="flex items-center space-x-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E66A23]" />
                                <span className="font-medium text-slate-900">{it.productName}</span>
                                <span className="text-slate-400 font-mono text-[11px]">{it.size}</span>
                              </div>
                              <div className="font-bold text-[#0E274D] bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                {it.quantityBoxes} Boxes • {it.quantitySqFt} sqft
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {po.remarks && (
                        <p className="text-xs text-slate-500 italic">
                          &ldquo;{po.remarks}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-end justify-center gap-2.5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                      {po.status === "pending_admin_approval" ? (
                        <Link
                          href={`/quotations/${po.quotationId || ""}`}
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          <span>In Admin Review (&lt; ₹26.50) &rarr;</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/quotations/new?orderId=${po.id}&poNumber=${po.poNumber}&customerId=${po.userId}&name=${encodeURIComponent(po.companyName || po.customerName)}`}
                          className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Quote Rates &amp; Discount &rarr;</span>
                        </Link>
                      )}
                      <span className="text-[11px] text-slate-400 text-center">
                        {po.status === "pending_admin_approval" ? "Pending Admin Approval" : "Quantities lock from client PO"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: GENERATED QUOTATIONS TABLE (ORIGINAL TABLE VIEW)                  */}
        {/* Shows ALL generated quotations across all salespersons and admin in Admin role */}
        {/* ========================================================================= */}
        {activeTab === "all" && (
          <div className="card-luxury overflow-hidden bg-white rounded-xl border border-slate-200">
            {filteredQuotations.length === 0 ? (
              <div className="p-12 text-center">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Quotations Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your filters or search terms."
                    : "Create a new quotation or quote rates for incoming client PO requests above."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-5">Quotation #</th>
                      <th className="py-3.5 px-5">Customer &amp; Salesperson</th>
                      <th className="py-3.5 px-5">Order Size</th>
                      <th className="py-3.5 px-5">Grand Total</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuotations.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-5">
                          <div>
                            <Link href={`/quotations/${q.id}`} className="font-bold text-[#0E274D] hover:underline flex items-center space-x-1.5">
                              <span>{q.quotationNumber}</span>
                            </Link>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              {new Date(q.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div>
                            <p className="font-bold text-slate-900">{q.customerName}</p>
                            <span className="text-xs text-slate-500">Rep: {q.salespersonName}</span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">{q.totalBoxes} Boxes</span>
                            <span className="text-slate-400 block">{q.totalWeightTons} Tons</span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div>
                            <p className="font-extrabold text-[#0E274D]">
                              ₹{Number(q.grandTotal).toLocaleString("en-IN")}
                            </p>
                            <span className="text-[11px] text-slate-400">{q.paymentTerms}</span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              q.status === "approved" || q.status === "accepted"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : q.status === "pending_approval" || q.status === "pending_admin_approval"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : q.status === "sent_to_customer"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <span className="capitalize">{q.status.replace(/_/g, " ")}</span>
                          </span>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <Link
                            href={`/quotations/${q.id}`}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#0E274D] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: SALESPERSON RATE QUOTES (FOR SALESPERSON ROLE ONLY)               */}
        {/* ========================================================================= */}
        {role === "salesperson" && activeTab === "status_orders" && (
          <div className="space-y-6 animate-fadeIn">
            {/* 4 STATUS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* CARD 1: pending_rate */}
              <div
                onClick={() => handleStatusCardClick("pending_rate")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
                  activeStatusCard === "pending_rate"
                    ? "bg-white border-2 border-amber-500 shadow-md ring-2 ring-amber-100"
                    : "bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-amber-700 uppercase tracking-tight flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>pending_rate</span>
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-[#0E274D]">
                    {statusCounts.pending_rate} Orders
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Awaiting Rate Quote from Salespersons
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Action Required
                  </span>
                  {activeStatusCard === "pending_rate" && (
                    <span className="font-extrabold text-[#0E274D] flex items-center space-x-1">
                      <span>Viewing List</span>
                      <span>▼</span>
                    </span>
                  )}
                </div>
              </div>

              {/* CARD 2: rate_quoted */}
              <div
                onClick={() => handleStatusCardClick("rate_quoted")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
                  activeStatusCard === "rate_quoted"
                    ? "bg-white border-2 border-blue-500 shadow-md ring-2 ring-blue-100"
                    : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-blue-700 uppercase tracking-tight flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>rate_quoted</span>
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-[#0E274D]">
                    {statusCounts.rate_quoted} Orders
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quote Sent &amp; Under Client Review
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Awaiting Acceptance
                  </span>
                  {activeStatusCard === "rate_quoted" && (
                    <span className="font-extrabold text-[#0E274D] flex items-center space-x-1">
                      <span>Viewing List</span>
                      <span>▼</span>
                    </span>
                  )}
                </div>
              </div>

              {/* CARD 3: confirmed */}
              <div
                onClick={() => handleStatusCardClick("confirmed")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
                  activeStatusCard === "confirmed"
                    ? "bg-white border-2 border-emerald-500 shadow-md ring-2 ring-emerald-100"
                    : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-emerald-700 uppercase tracking-tight flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>confirmed</span>
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-[#0E274D]">
                    {statusCounts.confirmed} Orders
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Accepted &amp; Queued for Production/Dispatch
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Converted Deals
                  </span>
                  {activeStatusCard === "confirmed" && (
                    <span className="font-extrabold text-[#0E274D] flex items-center space-x-1">
                      <span>Viewing List</span>
                      <span>▼</span>
                    </span>
                  )}
                </div>
              </div>

              {/* CARD 4: rejected */}
              <div
                onClick={() => handleStatusCardClick("rejected")}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
                  activeStatusCard === "rejected"
                    ? "bg-white border-2 border-rose-500 shadow-md ring-2 ring-rose-100"
                    : "bg-white border-slate-200 hover:border-rose-300 hover:bg-slate-50/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-rose-700 uppercase tracking-tight flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>rejected</span>
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-[#0E274D]">
                    {statusCounts.rejected} Orders
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Price Disagreement or Cancelled
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Closed Lost
                  </span>
                  {activeStatusCard === "rejected" && (
                    <span className="font-extrabold text-[#0E274D] flex items-center space-x-1">
                      <span>Viewing List</span>
                      <span>▼</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-Filters: Search by PO/Customer/Salesperson + Filter by Salesperson dropdown */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-black text-[#0E274D]">
                    {activeStatusCard === "pending_rate"
                      ? "Pending Rate Quotes by Salespersons"
                      : `Orders with Status: ${activeStatusCard}`}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    {filteredStatusOrders.length} {filteredStatusOrders.length === 1 ? "Order" : "Orders"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing customer PO details with assigned salesperson responsible for the rate quote.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={statusSearchTerm}
                    onChange={(e) => setStatusSearchTerm(e.target.value)}
                    placeholder="Search PO #, Customer, Tile, Salesperson..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  />
                  {statusSearchTerm && (
                    <button
                      onClick={() => setStatusSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Orders List with PO Details + Assigned Salesperson Details */}
            {filteredStatusOrders.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No orders match this status and filter</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Try clearing your search query or selecting &quot;All Salespersons&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredStatusOrders.map((order) => {
                  const spId = order.salesPersonId;
                  const salespersonProfile: EnrichedSalesPerson =
                    salesPersonsMap[spId] || DEFAULT_SALESPERSONS[spId] || {
                      salesPersonId: spId || "UNASSIGNED",
                      employeeId: "EMP-GENERAL",
                      name: "Central Sales Desk",
                      phone: "+91 98765 43210",
                      email: "sales@itacon.com",
                      region: "Central Gujarat Territory",
                      status: "active",
                      activeQuotesCount: 1,
                    };

                  const totalSqft = order.items?.reduce((sum, it) => sum + (it.quantitySqFt || 0), 0) || 0;
                  const estimatedValue = order.items?.reduce(
                    (sum, it) => sum + ((it.basePrice || 540) * (it.quantityBoxes || 1)),
                    0
                  ) || 0;

                  return (
                    <div
                      key={order.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 shadow-2xs hover:shadow-md transition-all flex flex-col xl:flex-row gap-5"
                    >
                      {/* Left Block: PO Order Details */}
                      <div className="flex-1 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center space-x-2.5">
                            <span className="font-mono text-sm font-black text-[#0E274D] tracking-tight">
                              {order.poNumber || order.orderReference}
                            </span>
                            <button
                              onClick={() => handleCopyPo(order.poNumber || order.orderReference)}
                              title="Copy PO Number"
                              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            >
                              {copiedPoId === (order.poNumber || order.orderReference) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
                              order.status === "pending_rate" || order.status === "submitted" || order.status === "pending_quote"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : order.status === "rate_quoted"
                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                : order.status === "confirmed"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                order.status === "pending_rate" ? "bg-amber-500 animate-pulse" : "bg-slate-400"
                              }`} />
                              <span>{order.status.replace(/_/g, " ")}</span>
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-xs text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Customer & Logistics Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Client / Enterprise
                            </span>
                            <div className="font-bold text-[#0E274D] text-sm mt-0.5">
                              {order.companyName || order.customerName}
                            </div>
                            <div className="text-slate-500 mt-0.5 flex items-center space-x-2">
                              <span>Contact: {order.customerName}</span>
                              {order.customerPhone && (
                                <>
                                  <span>•</span>
                                  <a
                                    href={`tel:${order.customerPhone}`}
                                    className="text-blue-600 hover:underline font-mono"
                                  >
                                    {order.customerPhone}
                                  </a>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Delivery Location &amp; Logistics
                            </span>
                            <div className="text-slate-700 font-medium mt-0.5 flex items-start space-x-1.5">
                              <span>{order.deliveryAddress || "Gujarat Hub Warehouse"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Requested Ceramic Items */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>Requested Ceramic Items ({order.items?.length || 0})</span>
                            <span className="text-slate-600 font-bold">
                              {order.totalBoxes} Boxes • {totalSqft.toLocaleString("en-IN")} sq.ft
                            </span>
                          </div>

                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {order.items?.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-slate-50/80 border border-slate-100 text-xs gap-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="w-2 h-2 rounded-full bg-[#E66A23] shrink-0" />
                                  <span className="font-bold text-[#0E274D]">{item.productName}</span>
                                  <span className="font-mono text-[11px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {item.size}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-3 text-right text-xs shrink-0 self-end sm:self-auto">
                                  <span className="font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {item.quantityBoxes} Boxes
                                  </span>
                                  <span className="text-slate-500 font-semibold min-w-[70px]">
                                    {item.quantitySqFt} sq.ft
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Assigned Salesperson Detail */}
                      <div className="xl:w-80 w-full rounded-xl bg-gradient-to-b from-slate-50 to-amber-50/30 border border-slate-200/90 p-4 flex flex-col justify-between shrink-0">
                        <div>
                          <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span>Assigned Salesperson</span>
                            </span>
                          </div>

                          <div className="mt-3.5 flex items-start space-x-3">
                            <div className="w-11 h-11 rounded-xl bg-[#0E274D] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs border border-[#1A2D5A]">
                              {salespersonProfile.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-sm text-[#0E274D] truncate">
                                {salespersonProfile.name}
                              </h4>
                              <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                                <span className="font-bold text-amber-700">{salespersonProfile.salesPersonId}</span>
                                <span>•</span>
                                <span>{salespersonProfile.employeeId}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Est. Order Value
                              </span>
                              <span className="text-sm font-black text-[#0E274D]">
                                ₹{estimatedValue.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200/80">
                          <Link
                            href={`/quotations/new?orderId=${order.id}&poNumber=${order.poNumber || order.orderReference}&customerId=${order.userId}&name=${encodeURIComponent(order.companyName || order.customerName)}`}
                            className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-bold shadow-xs hover:shadow transition-all text-center cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Quote Rates &amp; Discount &rarr;</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading quotations &amp; client PO requests...</div>}>
      <QuotationsContent />
    </Suspense>
  );
}
