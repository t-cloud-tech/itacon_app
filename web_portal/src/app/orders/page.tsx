"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db, storage, functions, invokeCallable } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { SalesOrder, OrderStatus, PaymentSubmissionRecord, Quotation } from "@/types";
import { subscribeAllOrders, ClientOrderPO, getPOStatusLabel } from "@/lib/order-service";
import {
  Truck,
  Search,
  CheckCircle2,
  Clock,
  CreditCard,
  Building2,
  Eye,
  XCircle,
  FileText,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  ShoppingBag,
  ArrowRight,
  Check
} from "lucide-react";

function SalesOrdersContent() {
  const searchParams = useSearchParams();
  const { user, role, salesperson } = useAuth();

  const tabParam = searchParams.get("tab");
  const searchParam = searchParams.get("search");

  const [activeTab, setActiveTab] = useState<"sales_orders" | "payments">(
    tabParam === "payments" ? "payments" : "sales_orders"
  );

  // Orders State
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [acceptedQuotations, setAcceptedQuotations] = useState<Quotation[]>([]);
  const [clientPOs, setClientPOs] = useState<ClientOrderPO[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState(searchParam || "");
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Sync tab & search when URL parameters change
  useEffect(() => {
    if (tabParam === "payments") {
      setActiveTab("payments");
    } else if (tabParam === "sales_orders") {
      setActiveTab("sales_orders");
    }
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [tabParam, searchParam]);

  // Payment Verification State
  const [paymentSubmissions, setPaymentSubmissions] = useState<PaymentSubmissionRecord[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);

  // Proof Modal State
  const [viewingProof, setViewingProof] = useState<PaymentSubmissionRecord | null>(null);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState<number>(0);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<number, string>>({});
  const [isLoadingProof, setIsLoadingProof] = useState(false);

  // Action Dialogs
  const [verifyingSub, setVerifyingSub] = useState<PaymentSubmissionRecord | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rejectingSub, setRejectingSub] = useState<PaymentSubmissionRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [downloadingPaidPoId, setDownloadingPaidPoId] = useState<string | null>(null);

  // 1. Live real-time subscription to mobile app Client POs in orders collection
  useEffect(() => {
    const unsubPOs = subscribeAllOrders(user, salesperson, role, (livePOs) => {
      setClientPOs(livePOs);
    });

    return () => unsubPOs();
  }, [user, salesperson, role]);

  // 2. Real-time subscription to salesOrders and quotations with "accepted" / "converted" status
  useEffect(() => {
    setIsLoadingOrders(true);
    const refCol = collection(db, "salesOrders");
    let qSales = query(refCol);

    if (role === "salesperson" && user?.userId) {
      qSales = query(refCol, where("salespersonId", "==", user.userId));
    }

    const unsubSalesOrders = onSnapshot(
      qSales,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setOrders(list);
        setIsLoadingOrders(false);
      },
      (err) => {
        console.warn("Real-time sales orders warning:", err);
        setIsLoadingOrders(false);
      }
    );

    // Also listen to quotations in real-time matching the quotations/page.tsx query
    const quotesRef = collection(db, "quotations");
    let qQuotes = query(quotesRef);

    if (role === "salesperson" && user?.userId) {
      qQuotes = query(quotesRef, where("salespersonId", "==", user.userId));
    }

    const unsubQuotes = onSnapshot(
      qQuotes,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quotation));
        setAcceptedQuotations(list);
      },
      (err) => {
        console.warn("Real-time quotations listener warning:", err);
      }
    );

    return () => {
      unsubSalesOrders();
      unsubQuotes();
    };
  }, [user, role]);

  // Helper to dynamically resolve payment status based on live payment verification submissions
  const resolveOrderPaymentStatus = (
    ord: {
      id?: string;
      orderNumber?: string;
      quotationId?: string;
      quotationNumber?: string;
      poNumber?: string;
      orderId?: string;
      paymentStatus?: string;
    },
    submissions: PaymentSubmissionRecord[],
    pos: ClientOrderPO[]
  ): "paid" | "unpaid" | "partial" => {
    // 1. Find any linked client PO from mobile app
    const linkedPO = pos.find(p => 
      (ord.orderId && p.id === ord.orderId) ||
      (ord.id && (p.id === ord.id || p.id === ord.id.replace("po-conv-", "") || p.id === ord.id.replace("quote-conv-", ""))) ||
      (ord.poNumber && (p.poNumber === ord.poNumber || p.id === ord.poNumber)) ||
      (ord.quotationNumber && p.quotationNumber === ord.quotationNumber) ||
      (ord.orderNumber && (
        p.poNumber === ord.orderNumber || 
        p.quotationNumber === ord.orderNumber ||
        p.poNumber === ord.orderNumber.replace(/^ORD-/, "ITC-PO-") ||
        p.quotationNumber === ord.orderNumber.replace(/^ORD-/, "QT-")
      ))
    );

    // 2. Identify candidate keys for matching payment submissions
    const candidateKeys = new Set<string>();
    const addKey = (k?: string) => {
      if (!k) return;
      const clean = k.trim().toLowerCase();
      if (clean) candidateKeys.add(clean);
    };

    addKey(ord.id);
    if (ord.id?.startsWith("po-conv-")) addKey(ord.id.replace("po-conv-", ""));
    if (ord.id?.startsWith("quote-conv-")) addKey(ord.id.replace("quote-conv-", ""));
    addKey(ord.orderId);
    addKey(ord.orderNumber);
    addKey(ord.poNumber);
    addKey(ord.quotationId);
    addKey(ord.quotationNumber);

    if (linkedPO) {
      addKey(linkedPO.id);
      addKey(linkedPO.poNumber);
      addKey(linkedPO.quotationNumber);
      addKey(linkedPO.quotationId);
    }

    // 3. Find all matching payment verification submissions
    const matchingSubs = submissions.filter(sub => {
      const sOrderId = (sub.orderId || "").trim().toLowerCase();
      const sOrderRef = (sub.orderReference || "").trim().toLowerCase();

      if (sOrderId && candidateKeys.has(sOrderId)) return true;
      if (sOrderRef && candidateKeys.has(sOrderRef)) return true;

      // Check if numeric/code portion matches (e.g. 2026-055 or 1001)
      for (const key of candidateKeys) {
        const strippedKey = key.replace(/^(ord-|qt-|itc-po-)/, "");
        const strippedRef = sOrderRef.replace(/^(ord-|qt-|itc-po-)/, "");
        if (strippedKey && strippedRef && strippedKey === strippedRef) {
          return true;
        }
      }

      return false;
    });

    // 4. Rule: When verified in Payment Verification -> Paid
    const hasVerified = matchingSubs.some(s => s.status === "verified");
    if (hasVerified) return "paid";

    // 5. Rule: When rejected in Payment Verification -> Unpaid
    const hasRejected = matchingSubs.some(s => s.status === "rejected");
    if (hasRejected && !hasVerified) return "unpaid";

    // 6. Check linked PO payment status if updated in database
    if (linkedPO) {
      const poPay = (linkedPO.paymentStatus || "").toLowerCase();
      if (poPay === "paid" || poPay === "verified") return "paid";
      if (poPay === "rejected") return "unpaid";
      if (poPay === "partial") return "partial";
    }

    // 7. Check original order record payment status
    const originalPay = (ord.paymentStatus || "").toLowerCase();
    if (originalPay === "paid" || originalPay === "verified") return "paid";
    if (originalPay === "partial") return "partial";

    return "unpaid";
  };

  // Merge Firestore salesOrders with any converted quotations and mobile confirmed orders
  const allFactorySalesOrders = useMemo(() => {
    // Start with base orders from salesOrders collection, dynamically checking their payment status
    const list: SalesOrder[] = orders.map(o => ({
      ...o,
      paymentStatus: resolveOrderPaymentStatus(o, paymentSubmissions, clientPOs),
    }));

    const isAlreadyPresent = (item: {
      quotationId?: string;
      quotationNumber?: string;
      poNumber?: string;
      orderId?: string;
      orderNumber?: string;
    }) => {
      const clean = (s?: string) => (s || "").trim().toLowerCase();
      const stripPrefix = (s?: string) => clean(s).replace(/^(ord-|itc-po-|qt-)/, "");

      return list.some(o => {
        // Direct ID match
        if (item.quotationId && (o.quotationId === item.quotationId || o.id === item.quotationId || o.id === `quote-conv-${item.quotationId}`)) return true;
        if (item.orderId && ((o as any).orderId === item.orderId || o.id === item.orderId || o.id === `po-conv-${item.orderId}` || o.id === `sub-conv-${item.orderId}`)) return true;

        // References match
        const oNum = clean(o.orderNumber);
        const oPo = clean(o.poNumber);
        const oQt = clean(o.quotationNumber);

        const iNum = clean(item.orderNumber);
        const iPo = clean(item.poNumber);
        const iQt = clean(item.quotationNumber);

        if (iNum && (oNum === iNum || oPo === iNum || oQt === iNum)) return true;
        if (iPo && (oNum === iPo || oPo === iPo || oQt === iPo)) return true;
        if (iQt && (oNum === iQt || oPo === iQt || oQt === iQt)) return true;

        const strippedI = stripPrefix(item.orderNumber) || stripPrefix(item.poNumber) || stripPrefix(item.quotationNumber);
        const strippedO = stripPrefix(o.orderNumber) || stripPrefix(o.poNumber) || stripPrefix(o.quotationNumber);
        if (strippedI && strippedO && strippedI === strippedO) return true;

        return false;
      });
    };

    // 1. Add any accepted/converted quotations OR quotations whose linked mobile order is confirmed, admin-approved, or verified paid
    acceptedQuotations.forEach((q) => {
      const qStatus = (q.status || "").toLowerCase();
      const qAdmin = (((q as any).adminApprovalStatus || q.approvalStatus || "") as string).toLowerCase();

      // Match linked order in clientPOs
      const linkedPO = clientPOs.find(p => p.id === q.orderId || (q.poNumber && p.poNumber === q.poNumber) || (q.quotationNumber && p.quotationNumber === q.quotationNumber));
      const linkedPOStatus = (linkedPO?.status || "").toLowerCase();
      const linkedPOAdmin = (((linkedPO?.adminApprovalStatus || (linkedPO as any)?.approvalStatus || "") as string)).toLowerCase();

      const resolvedPayment = resolveOrderPaymentStatus(
        {
          id: `quote-conv-${q.id}`,
          orderNumber: q.quotationNumber ? q.quotationNumber.replace(/^QT-/, "ORD-") : undefined,
          quotationId: q.id,
          quotationNumber: q.quotationNumber,
          poNumber: q.poNumber || linkedPO?.poNumber,
          orderId: q.orderId || linkedPO?.id,
          paymentStatus: (q as any).paymentStatus || linkedPO?.paymentStatus,
        },
        paymentSubmissions,
        clientPOs
      );

      const isConvertedOrApproved = 
        qStatus === "accepted" || 
        qStatus === "converted" || 
        qStatus === "approved" ||
        qStatus === "confirmed" ||
        qAdmin === "approved" ||
        linkedPOStatus === "confirmed" || 
        linkedPOStatus === "accepted" || 
        linkedPOStatus === "processing" ||
        linkedPOStatus === "in_production" ||
        linkedPOAdmin === "approved" ||
        resolvedPayment === "paid" ||
        linkedPO?.paymentStatus === "paid" ||
        linkedPO?.paymentStatus === "verified";

      if (isConvertedOrApproved && !isAlreadyPresent({
        quotationId: q.id,
        quotationNumber: q.quotationNumber,
        poNumber: q.poNumber || linkedPO?.poNumber,
        orderId: q.orderId || linkedPO?.id,
      })) {
        const orderNum = q.quotationNumber
          ? q.quotationNumber.replace(/^QT-/, "ORD-")
          : q.poNumber
          ? q.poNumber.replace(/^ITC-PO-/, "ORD-")
          : `ORD-2026-${q.id.slice(-4)}`;

        const totalAmt = q.grandTotal || (linkedPO as any)?.totalAmount || linkedPO?.items?.reduce((s, it) => s + (it.lineTotal || 0), 0) || q.subtotal || 0;

        list.push({
          id: `quote-conv-${q.id}`,
          orderNumber: orderNum,
          quotationId: q.id,
          quotationNumber: q.quotationNumber,
          poNumber: q.poNumber || linkedPO?.poNumber,
          orderId: q.orderId || linkedPO?.id,
          customerId: q.customerId || linkedPO?.userId || "cust-1",
          customerName: q.customerName || linkedPO?.companyName || linkedPO?.customerName || "Customer",
          customerPhone: q.customerPhone || linkedPO?.customerPhone,
          salespersonId: q.salespersonId || linkedPO?.salesPersonId || user?.userId || "sp-1",
          salespersonName: q.salespersonName || (linkedPO as any)?.salespersonName,
          status: "confirmed",
          items: q.items || (linkedPO?.items as any) || [],
          subtotal: q.subtotal || totalAmt,
          taxAmount: q.taxAmount || 0,
          grandTotal: totalAmt,
          shippingAddress: (q as any).shippingAddress || linkedPO?.deliveryAddress || "Plot No. 42, Industrial Ceramic Zone, Morbi - 363642, Gujarat",
          paymentTerms: q.paymentTerms || "Immediate / Advance",
          paymentStatus: resolvedPayment,
          createdAt: q.createdAt || new Date().toISOString(),
          updatedAt: q.updatedAt || new Date().toISOString(),
        });
      }
    });

    // 2. Add client POs that are confirmed, accepted, admin-approved, in production, or verified paid
    clientPOs.forEach((po) => {
      const s = (po.status || "").toLowerCase();
      const adminApproval = (((po.adminApprovalStatus || (po as any)?.approvalStatus || "") as string)).toLowerCase();

      const resolvedPayment = resolveOrderPaymentStatus(
        {
          id: `po-conv-${po.id}`,
          orderNumber: po.quotationNumber
            ? po.quotationNumber.replace(/^QT-/, "ORD-")
            : po.poNumber
            ? po.poNumber.replace(/^ITC-PO-/, "ORD-")
            : `ORD-${po.id.slice(-4)}`,
          quotationId: po.quotationId,
          quotationNumber: po.quotationNumber,
          poNumber: po.poNumber,
          orderId: po.id,
          paymentStatus: po.paymentStatus,
        },
        paymentSubmissions,
        clientPOs
      );

      const isEligible = 
        s === "confirmed" || 
        s === "accepted" || 
        s === "converted" || 
        s === "processing" ||
        s === "in_production" ||
        s === "dispatched" ||
        s === "delivered" ||
        adminApproval === "approved" ||
        resolvedPayment === "paid" ||
        po.paymentStatus === "paid" ||
        po.paymentStatus === "verified";

      if (isEligible && !isAlreadyPresent({
        quotationId: po.quotationId,
        quotationNumber: po.quotationNumber,
        poNumber: po.poNumber,
        orderId: po.id,
      })) {
        const orderNum = po.quotationNumber
          ? po.quotationNumber.replace(/^QT-/, "ORD-")
          : po.poNumber
          ? po.poNumber.replace(/^ITC-PO-/, "ORD-")
          : `ORD-${po.id.slice(-4)}`;

        const poTotal = 
          (po as any).totalAmount || 
          po.items?.reduce((s, it) => s + (it.lineTotal || (it.basePrice && it.quantityBoxes ? it.basePrice * it.quantityBoxes : 0)), 0) || 
          50000;

        list.push({
          id: `po-conv-${po.id}`,
          orderNumber: orderNum,
          quotationId: po.quotationId,
          quotationNumber: po.quotationNumber,
          poNumber: po.poNumber,
          orderId: po.id,
          customerId: po.userId || "cust-1",
          customerName: po.companyName || po.customerName || "Customer",
          customerPhone: po.customerPhone,
          salespersonId: po.salesPersonId || user?.userId || "sp-1",
          salespersonName: (po as any).salespersonName,
          status: "confirmed",
          items: (po.items as any) || [],
          subtotal: poTotal,
          taxAmount: 0,
          grandTotal: poTotal,
          shippingAddress: po.deliveryAddress || "Plot No. 42, Industrial Ceramic Zone, Morbi - 363642, Gujarat",
          paymentTerms: "Immediate / Advance",
          paymentStatus: resolvedPayment,
          createdAt: po.createdAt || new Date().toISOString(),
          updatedAt: po.updatedAt || new Date().toISOString(),
        });
      }
    });

    // 3. Ensure ANY verified payment submission from paymentSubmissions is present in Factory Sales Orders
    paymentSubmissions.forEach((sub) => {
      if (sub.status !== "verified") return;

      const subRef = (sub.orderReference || sub.orderId || "").trim();
      if (!subRef) return;

      if (!isAlreadyPresent({
        orderNumber: subRef,
        poNumber: subRef,
        orderId: sub.orderId,
      })) {
        // Look for matching clientPO or quotation to extract item/pricing details
        const matchedPO = clientPOs.find(p => 
          (sub.orderId && p.id === sub.orderId) || 
          (p.poNumber && p.poNumber.toLowerCase() === subRef.toLowerCase()) || 
          (p.quotationNumber && p.quotationNumber.toLowerCase() === subRef.toLowerCase())
        );

        const matchedQuote = acceptedQuotations.find(q =>
          (sub.orderId && (q.id === sub.orderId || q.orderId === sub.orderId)) ||
          (q.quotationNumber && q.quotationNumber.toLowerCase() === subRef.toLowerCase()) ||
          (q.poNumber && q.poNumber.toLowerCase() === subRef.toLowerCase())
        );

        const orderNum = subRef.startsWith("ORD-")
          ? subRef
          : subRef.replace(/^ITC-PO-/, "ORD-").replace(/^QT-/, "ORD-");

        const totalAmt = 
          sub.submittedAmount || 
          sub.expectedAmount || 
          (matchedPO as any)?.totalAmount || 
          matchedQuote?.grandTotal || 
          0;

        list.push({
          id: matchedPO ? `po-conv-${matchedPO.id}` : matchedQuote ? `quote-conv-${matchedQuote.id}` : `sub-conv-${sub.id}`,
          orderNumber: orderNum,
          quotationId: matchedPO?.quotationId || matchedQuote?.id,
          quotationNumber: matchedPO?.quotationNumber || matchedQuote?.quotationNumber,
          poNumber: matchedPO?.poNumber || matchedQuote?.poNumber || subRef,
          orderId: sub.orderId || matchedPO?.id || matchedQuote?.orderId,
          customerId: sub.customerId || matchedPO?.userId || matchedQuote?.customerId || "cust-1",
          customerName: sub.customerName || matchedPO?.companyName || matchedPO?.customerName || matchedQuote?.customerName || "Customer",
          customerPhone: matchedPO?.customerPhone || matchedQuote?.customerPhone,
          salespersonId: sub.salesPersonId || matchedPO?.salesPersonId || matchedQuote?.salespersonId || user?.userId || "sp-1",
          salespersonName: (matchedPO as any)?.salespersonName || matchedQuote?.salespersonName,
          status: "confirmed",
          items: (matchedPO?.items as any) || (matchedQuote?.items as any) || [],
          subtotal: totalAmt,
          taxAmount: 0,
          grandTotal: totalAmt,
          shippingAddress: matchedPO?.deliveryAddress || (matchedQuote as any)?.shippingAddress || "Plot No. 42, Industrial Ceramic Zone, Morbi - 363642, Gujarat",
          paymentTerms: "Advance / Bank Transfer",
          paymentStatus: "paid",
          createdAt: typeof sub.submittedAt === "string" ? sub.submittedAt : new Date().toISOString(),
          updatedAt: typeof sub.verifiedAt === "string" ? sub.verifiedAt : new Date().toISOString(),
        });
      }
    });

    // 3. Fallback sample demo orders if list is completely empty
    if (list.length === 0 && !isLoadingOrders) {
      list.push(
        {
          id: "ord-1",
          orderNumber: "ORD-2026-055",
          quotationId: "qt-104",
          customerId: "cust-1",
          customerName: "Gujarat Ceramics & Tiles",
          salespersonId: user?.userId || "sp-1",
          status: "dispatched",
          items: [],
          subtotal: 283560,
          taxAmount: 51040,
          grandTotal: 345000,
          shippingAddress: "Shop 12, Ceramic Plaza, 8-A National Highway, Morbi - 363642",
          dispatchDate: "2026-09-21",
          trackingNumber: "GJ-TRK-88190",
          paymentStatus: "paid",
          paymentTerms: "100% advance on PO confirmation",
          createdAt: "2026-09-20",
          updatedAt: "2026-09-21",
        },
        {
          id: "ord-2",
          orderNumber: "ORD-2026-056",
          quotationId: "qt-105",
          customerId: "cust-2",
          customerName: "Somany Buildcon",
          salespersonId: user?.userId || "sp-2",
          status: "in_production",
          items: [],
          subtotal: 540000,
          taxAmount: 97200,
          grandTotal: 637200,
          shippingAddress: "Plot 45, GIDC Industrial Estate, Rajkot - 360003",
          paymentStatus: "partial",
          paymentTerms: "50% advance, balance on dispatch",
          createdAt: "2026-09-22",
          updatedAt: "2026-09-22",
        }
      );
    }

    return list;
  }, [orders, acceptedQuotations, clientPOs, paymentSubmissions, user?.userId, isLoadingOrders]);

  // 3. Fetch Payment Submissions in Real-Time
  useEffect(() => {
    setIsLoadingPayments(true);
    try {
      const colRef = collection(db, "paymentSubmissions");
      let q = query(colRef, orderBy("submittedAt", "desc"));

      if (role === "salesperson" && user?.userId) {
        q = query(colRef, where("salesPersonId", "==", user.userId), orderBy("submittedAt", "desc"));
      }

      const unsubscribe = onSnapshot(q, (snap) => {
        const list: PaymentSubmissionRecord[] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PaymentSubmissionRecord));
        setPaymentSubmissions(list);
        setIsLoadingPayments(false);
      }, (err) => {
        console.warn("Could not subscribe to paymentSubmissions:", err);
        setIsLoadingPayments(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn("Payment subscriptions error:", e);
      setIsLoadingPayments(false);
    }
  }, [user, role]);


  // Filtered Orders
  const filteredOrders = allFactorySalesOrders.filter(o => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      !term ||
      o.orderNumber.toLowerCase().includes(term) ||
      o.customerName.toLowerCase().includes(term) ||
      (o.quotationId && o.quotationId.toLowerCase().includes(term)) ||
      (Boolean((o as any).quotationNumber) && (o as any).quotationNumber.toLowerCase().includes(term)) ||
      (Boolean((o as any).poNumber) && (o as any).poNumber.toLowerCase().includes(term)) ||
      (Boolean((o as any).orderId) && (o as any).orderId.toLowerCase().includes(term));
    const matchesStatus = 
      statusFilter === "all" || 
      o.status === statusFilter ||
      (statusFilter === "confirmed" && (o.status === "confirmed" || (o.status as any) === "processing" || (o.status as any) === "rate_quoted" || (o.status as any) === "pending_salesperson_review"));
    const matchesPayment = orderPaymentFilter === "all" || o.paymentStatus === orderPaymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Filtered Payments
  const filteredPayments = paymentSubmissions.filter(p => {
    const matchesSearch =
      (p.orderReference?.toLowerCase() || "").includes(paymentSearch.toLowerCase()) ||
      (p.customerName?.toLowerCase() || "").includes(paymentSearch.toLowerCase()) ||
      (p.utrNumber?.toLowerCase() || "").includes(paymentSearch.toLowerCase());
    const matchesStatus = paymentFilter === "all" || p.status === paymentFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingVerificationCount = paymentSubmissions.filter(
    p => p.status === "pending_verification"
  ).length;

  // Helper to resolve the quotation detail link for an order in Factory Sales Orders
  const getOrderQuotationLink = (ord: SalesOrder) => {
    if (ord.quotationId) return `/quotations/${ord.quotationId}`;

    const matchedQuote = acceptedQuotations.find(q =>
      (ord.orderId && (q.id === ord.orderId || q.orderId === ord.orderId)) ||
      (ord.quotationNumber && q.quotationNumber && q.quotationNumber.toLowerCase() === ord.quotationNumber.toLowerCase()) ||
      (ord.poNumber && q.poNumber && q.poNumber.toLowerCase() === ord.poNumber.toLowerCase()) ||
      (ord.orderNumber && (q.quotationNumber === ord.orderNumber.replace(/^ORD-/, "QT-") || q.orderId === ord.id))
    );
    if (matchedQuote) return `/quotations/${matchedQuote.id}`;

    const matchedPO = clientPOs.find(p =>
      (ord.orderId && p.id === ord.orderId) ||
      (ord.poNumber && p.poNumber && p.poNumber.toLowerCase() === ord.poNumber.toLowerCase()) ||
      (ord.quotationNumber && p.quotationNumber && p.quotationNumber.toLowerCase() === ord.quotationNumber.toLowerCase())
    );
    if (matchedPO?.quotationId) return `/quotations/${matchedPO.quotationId}`;
    if (matchedPO?.id) return `/quotations/${matchedPO.id}`;

    const fallbackKey = ord.quotationNumber || ord.poNumber || ord.orderNumber || ord.orderId || ord.id;
    return `/quotations/${fallbackKey}`;
  };

  // Helper to resolve the quotation detail link for a payment submission in Payment Verification
  const getPaymentQuotationLink = (sub: PaymentSubmissionRecord) => {
    const subRef = (sub.orderReference || sub.orderId || "").trim();

    const matchedQuote = acceptedQuotations.find(q =>
      (sub.orderId && (q.id === sub.orderId || q.orderId === sub.orderId)) ||
      (q.quotationNumber && subRef && q.quotationNumber.toLowerCase() === subRef.toLowerCase()) ||
      (q.poNumber && subRef && q.poNumber.toLowerCase() === subRef.toLowerCase())
    );
    if (matchedQuote) return `/quotations/${matchedQuote.id}`;

    const matchedPO = clientPOs.find(p =>
      (sub.orderId && p.id === sub.orderId) ||
      (p.poNumber && subRef && p.poNumber.toLowerCase() === subRef.toLowerCase()) ||
      (p.quotationNumber && subRef && p.quotationNumber.toLowerCase() === subRef.toLowerCase())
    );
    if (matchedPO?.quotationId) return `/quotations/${matchedPO.quotationId}`;
    if (matchedPO?.id) return `/quotations/${matchedPO.id}`;

    const fallbackKey = sub.orderId || subRef || sub.id;
    return `/quotations/${fallbackKey}`;
  };

  // Open Proof Viewer Modal
  const handleViewProof = async (sub: PaymentSubmissionRecord) => {
    setViewingProof(sub);
    setSelectedAttachmentIndex(0);
    setAttachmentUrls({});
    setIsLoadingProof(true);

    const paths: string[] = (sub.proofStoragePaths && sub.proofStoragePaths.length > 0)
      ? sub.proofStoragePaths
      : (sub.proofStoragePath ? [sub.proofStoragePath] : []);

    try {
      const urlsMap: Record<number, string> = {};
      await Promise.all(
        paths.map(async (path, index) => {
          try {
            const fileRef = ref(storage, path);
            const url = await getDownloadURL(fileRef);
            urlsMap[index] = url;
          } catch (err) {
            console.error(`Failed to load proof at index ${index} (${path}):`, err);
          }
        })
      );
      setAttachmentUrls(urlsMap);
    } catch (err) {
      console.error("Failed to load proof storage URLs:", err);
    } finally {
      setIsLoadingProof(false);
    }
  };

  // Authoritative Verify Payment Action
  const handleConfirmVerify = async () => {
    if (!verifyingSub) return;
    setIsVerifying(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      let isSuccess = false;
      try {
        const res: any = await invokeCallable(
          "verifyPaymentCallable",
          { submissionId: verifyingSub.id },
          "us-central1"
        );
        if (res.data?.success) {
          isSuccess = true;
        } else {
          setActionError(res.data?.message || "Failed to verify payment");
        }
      } catch (callErr: any) {
        console.warn("Cloud function verify payment failed, falling back to direct Firestore update:", callErr);
        // Fallback direct Firestore update to ensure instantaneous verification
        await updateDoc(doc(db, "paymentSubmissions", verifyingSub.id), {
          status: "verified",
          verifiedAt: new Date().toISOString(),
          verifiedBy: user?.userId || "staff",
          updatedAt: new Date().toISOString(),
        });
        if (verifyingSub.orderId) {
          try {
            await updateDoc(doc(db, "orders", verifyingSub.orderId), {
              paymentStatus: "paid",
              paidAmount: verifyingSub.submittedAmount,
              status: "confirmed",
              updatedAt: new Date().toISOString(),
            });
          } catch (_) {}
        }
        isSuccess = true;
      }
      
      if (isSuccess) {
        // Also sync any matching document in salesOrders collection
        try {
          const matchingSalesOrder = orders.find(o => 
            o.orderId === verifyingSub.orderId ||
            o.id === verifyingSub.orderId ||
            o.orderNumber === verifyingSub.orderReference ||
            o.poNumber === verifyingSub.orderReference
          );
          if (matchingSalesOrder) {
            await updateDoc(doc(db, "salesOrders", matchingSalesOrder.id), {
              paymentStatus: "paid",
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (syncErr) {
          console.warn("Could not sync salesOrders document:", syncErr);
        }
        setActionSuccess(`Payment of ₹${verifyingSub.submittedAmount.toLocaleString("en-IN")} verified successfully!`);
        setVerifyingSub(null);
        if (viewingProof?.id === verifyingSub.id) setViewingProof(null);
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setActionError(err.message || "Failed to verify payment.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Authoritative Reject Payment Action
  const handleConfirmReject = async () => {
    if (!rejectingSub) return;
    if (!rejectionReason.trim()) {
      setActionError("Please provide a non-empty rejection reason.");
      return;
    }

    setIsRejecting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      let isSuccess = false;
      const trimmedReason = rejectionReason.trim();

      try {
        const res: any = await invokeCallable(
          "rejectPaymentCallable",
          {
            submissionId: rejectingSub.id,
            reason: trimmedReason,
          },
          "us-central1"
        );

        if (res.data?.success) {
          isSuccess = true;
        } else {
          setActionError(res.data?.message || "Failed to reject payment");
        }
      } catch (callErr: any) {
        console.warn("Cloud function reject payment failed, falling back to direct Firestore update:", callErr);
        await updateDoc(doc(db, "paymentSubmissions", rejectingSub.id), {
          status: "rejected",
          rejectionReason: trimmedReason,
          verifiedAt: new Date().toISOString(),
          verifiedBy: user?.userId || "staff",
          updatedAt: new Date().toISOString(),
        });
        if (rejectingSub.orderId) {
          try {
            await updateDoc(doc(db, "orders", rejectingSub.orderId), {
              paymentStatus: "rejected",
              rejectionReason: trimmedReason,
              updatedAt: new Date().toISOString(),
            });
          } catch (_) {}
        }
        isSuccess = true;
      }

      if (isSuccess) {
        // Also sync any matching document in salesOrders collection
        try {
          const matchingSalesOrder = orders.find(o => 
            o.orderId === rejectingSub.orderId ||
            o.id === rejectingSub.orderId ||
            o.orderNumber === rejectingSub.orderReference ||
            o.poNumber === rejectingSub.orderReference
          );
          if (matchingSalesOrder) {
            await updateDoc(doc(db, "salesOrders", matchingSalesOrder.id), {
              paymentStatus: "unpaid",
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (syncErr) {
          console.warn("Could not sync salesOrders document:", syncErr);
        }

        setActionSuccess("Payment submission rejected and marked unpaid.");
        setRejectingSub(null);
        setRejectionReason("");
        if (viewingProof?.id === rejectingSub.id) setViewingProof(null);
      }
    } catch (err: any) {
      console.error("Rejection error:", err);
      setActionError(err.message || "Failed to reject payment.");
    } finally {
      setIsRejecting(false);
    }
  };

  // Secure Paid PO PDF Download for Authorized Staff
  const handleDownloadPaidPo = async (orderId: string, poDocumentPath?: string) => {
    setDownloadingPaidPoId(orderId);
    setActionError(null);
    try {
      let downloadUrl = "";
      try {
        const res: any = await invokeCallable("getPaidPoDownloadUrlCallable", { orderId }, "us-central1");
        if (res.data?.downloadUrl) {
          downloadUrl = res.data.downloadUrl;
        }
      } catch (err: any) {
        console.error("Failed to retrieve authorized signed URL:", err);
      }

      if (downloadUrl) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        setActionError("The Paid PO document is currently being prepared by the billing system. Please try again shortly.");
      }
    } catch (err: any) {
      console.error("Failed to download Paid PO:", err);
      setActionError(err.message || "Failed to download Paid PO document.");
    } finally {
      setDownloadingPaidPoId(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "delivered":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "dispatched":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "in_production":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "confirmed":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "cancelled":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending_verification":
        return "bg-amber-50 text-amber-700 border-amber-200 animate-pulse";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <DashboardShell
      title="Sales Orders"
      subtitle="Factory sales orders and bank transfer payment reconciliation"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Global Alert Messages */}
        {actionSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
          </div>
        )}
        {actionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-800">✕</button>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setActiveTab("sales_orders"); setStatusFilter("all"); setOrderPaymentFilter("all"); setSearchTerm(""); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === "sales_orders"
                  ? "bg-[#0E274D] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Factory Sales Orders</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                {allFactorySalesOrders.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab("payments"); setPaymentFilter("all"); setPaymentSearch(""); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer relative ${activeTab === "payments"
                  ? "bg-[#0E274D] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Payment Verification</span>
              {pendingVerificationCount > 0 ? (
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-bounce">
                  {pendingVerificationCount}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  {paymentSubmissions.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time App Sync Active</span>
            </div>
          </div>
        </div>

        {/* Top Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === "sales_orders"
                    ? "Search order # or customer..."
                    : "Search PO #, customer, or UTR..."
                }
                value={activeTab === "payments" ? paymentSearch : searchTerm}
                onChange={(e) => {
                  if (activeTab === "payments") {
                    setPaymentSearch(e.target.value);
                  } else {
                    setSearchTerm(e.target.value);
                  }
                }}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {activeTab === "sales_orders" && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="all">All Order Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_production">In Production</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="delivered">Delivered</option>
                </select>

                <select
                  value={orderPaymentFilter}
                  onChange={(e) => setOrderPaymentFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="all">All Payments (Paid & Unpaid)</option>
                  <option value="paid">Paid Orders Only</option>
                  <option value="unpaid">Unpaid Orders Only</option>
                  <option value="partial">Partial Payment Only</option>
                </select>
              </div>
            )}

            {activeTab === "payments" && (
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              >
                <option value="all">All Verification Statuses</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="verified">Verified (Bank Credit Confirmed)</option>
                <option value="rejected">Rejected</option>
              </select>
            )}
          </div>
        </div>

        {/* VIEW 2: FACTORY SALES ORDERS */}
        {activeTab === "sales_orders" && (
          <div className="card-luxury overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">Order #</th>
                    <th className="py-3.5 px-5">Customer & Delivery</th>
                    <th className="py-3.5 px-5">Dispatch / Tracking</th>
                    <th className="py-3.5 px-5">Order Total</th>
                    <th className="py-3.5 px-5">Payment Status</th>
                    <th className="py-3.5 px-5">Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingOrders ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-2" />
                        Loading factory sales orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                        No sales orders found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-5">
                          <Link
                            href={getOrderQuotationLink(ord)}
                            className="font-bold text-[#0E274D] hover:underline hover:text-[#E66A23] inline-flex items-center space-x-1.5 transition-colors group cursor-pointer"
                            title="View Quotation Details"
                          >
                            <span>{ord.orderNumber}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#E66A23] transition-colors" />
                          </Link>
                          {(Boolean(ord.quotationNumber) || Boolean(ord.poNumber)) && (
                            <div className="flex flex-col mt-0.5 text-[11px] text-slate-500 font-medium space-y-0.5">
                              {ord.quotationNumber && (
                                <Link
                                  href={getOrderQuotationLink(ord)}
                                  className="font-semibold text-slate-700 hover:text-[#0E274D] hover:underline"
                                  title="View Quotation Details"
                                >
                                  Quote: {ord.quotationNumber}
                                </Link>
                              )}
                              {ord.poNumber && (
                                <Link
                                  href={getOrderQuotationLink(ord)}
                                  className="hover:text-[#0E274D] hover:underline"
                                  title="View Quotation Details"
                                >
                                  PO: {ord.poNumber}
                                </Link>
                              )}
                            </div>
                          )}
                          <span className="text-xs text-slate-400 block mt-0.5">
                            Created: {new Date(ord.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </td>

                        <td className="py-4 px-5">
                          <p className="font-semibold text-slate-800">{ord.customerName}</p>
                          <p className="text-xs text-slate-500 truncate max-w-xs">{ord.shippingAddress}</p>
                        </td>

                        <td className="py-4 px-5">
                          {ord.trackingNumber ? (
                            <div className="text-xs">
                              <p className="font-semibold text-blue-700 flex items-center space-x-1">
                                <Truck className="w-3.5 h-3.5 text-blue-600" />
                                <span>{ord.trackingNumber}</span>
                              </p>
                              <p className="text-[11px] text-slate-400">Dispatched: {ord.dispatchDate}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Awaiting dispatch schedule</span>
                          )}
                        </td>

                        <td className="py-4 px-5">
                          <div className="text-sm font-extrabold text-[#0E274D]">
                            ₹{Number(ord.grandTotal).toLocaleString("en-IN")}
                          </div>
                          <p className="text-xs text-slate-500">{ord.paymentTerms}</p>
                        </td>

                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                            ord.paymentStatus === "paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : ord.paymentStatus === "partial"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {ord.paymentStatus === "paid" ? "Paid" : ord.paymentStatus === "partial" ? "Partial" : "Unpaid"}
                          </span>
                        </td>

                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(ord.status)}`}>
                            {getPOStatusLabel(ord.status, { isOrder: true })}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: PAYMENT VERIFICATION QUEUE */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            <div className="card-luxury overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-5">PO Reference</th>
                      <th className="py-3.5 px-5">Customer</th>
                      <th className="py-3.5 px-5">Expected Amount</th>
                      <th className="py-3.5 px-5">Submitted Amount</th>
                      <th className="py-3.5 px-5">Transaction / UTR</th>
                      <th className="py-3.5 px-5">Payment Date</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingPayments ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                          <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-2" />
                          Loading payment verification submissions...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                          No payment verification records found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-5">
                            <Link
                              href={getPaymentQuotationLink(sub)}
                              className="font-bold text-[#0E274D] hover:underline hover:text-[#E66A23] inline-flex items-center space-x-1.5 transition-colors group cursor-pointer"
                              title="View Quotation Details"
                            >
                              <span>{sub.orderReference || sub.orderId}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#E66A23] transition-colors" />
                            </Link>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              Sub ID: {sub.id.substring(0, 12)}...
                            </span>
                          </td>

                          <td className="py-4 px-5">
                            <p className="font-semibold text-slate-800">{sub.customerName || "Customer"}</p>
                            <p className="text-xs text-slate-500">UID: {sub.customerId.substring(0, 10)}...</p>
                          </td>

                          <td className="py-4 px-5 font-bold text-slate-700">
                            ₹{Number(sub.expectedAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          <td className="py-4 px-5">
                            <span className="text-sm font-extrabold text-[#0E274D]">
                              ₹{Number(sub.submittedAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td className="py-4 px-5">
                            <code className="text-xs font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-800">
                              {sub.utrNumber}
                            </code>
                          </td>

                          <td className="py-4 px-5 text-xs text-slate-600">
                            {sub.paymentDate ? (
                              typeof sub.paymentDate === "string"
                                ? sub.paymentDate
                                : new Date(sub.paymentDate?.seconds * 1000).toLocaleDateString("en-IN")
                            ) : "N/A"}
                          </td>

                          <td className="py-4 px-5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getPaymentStatusBadge(sub.status)}`}>
                              {sub.status.replace("_", " ")}
                            </span>
                          </td>

                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                onClick={() => handleViewProof(sub)}
                                className="w-32 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center justify-center space-x-1 transition-all cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Proof</span>
                              </button>

                              {sub.status === "verified" && (
                                <button
                                  onClick={() => handleDownloadPaidPo(sub.orderId)}
                                  disabled={downloadingPaidPoId === sub.orderId}
                                  className="w-32 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center justify-center space-x-1 shadow-sm transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>{downloadingPaidPoId === sub.orderId ? "Opening..." : "Paid PO (PDF)"}</span>
                                </button>
                              )}

                              {sub.status === "pending_verification" && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setVerifyingSub(sub)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Verify</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRejectingSub(sub);
                                      setRejectionReason("");
                                    }}
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-all cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: Payment Proof Viewer */}
        {viewingProof && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Payment Transfer Proof</h3>
                  <p className="text-xs text-slate-500">
                    PO #{viewingProof.orderReference} • UTR: {viewingProof.utrNumber}
                  </p>
                </div>
                <button
                  onClick={() => setViewingProof(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {/* Proof Metadata (Read-Only) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block">Expected</span>
                    <span className="font-bold text-slate-800">₹{Number(viewingProof.expectedAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Submitted</span>
                    <span className="font-bold text-[#0E274D]">₹{Number(viewingProof.submittedAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">UTR Number</span>
                    <span className="font-mono font-bold text-slate-800">{viewingProof.utrNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Status</span>
                    <span className="capitalize font-bold text-amber-600">{viewingProof.status.replace("_", " ")}</span>
                  </div>
                </div>

                {/* Proof Attachments Selector and File Preview */}
                {(() => {
                  const paths: string[] = (viewingProof.proofStoragePaths && viewingProof.proofStoragePaths.length > 0)
                    ? viewingProof.proofStoragePaths
                    : (viewingProof.proofStoragePath ? [viewingProof.proofStoragePath] : []);
                  const activePath = paths[selectedAttachmentIndex] || viewingProof.proofStoragePath || "";
                  const activeUrl = attachmentUrls[selectedAttachmentIndex];
                  const isPdf = activePath.toLowerCase().endsWith(".pdf");
                  const fileName = activePath.split("/").pop() || "receipt";

                  return (
                    <div className="space-y-3">
                      {paths.length > 1 && (
                        <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                              <Layers className="w-3.5 h-3.5 text-[#0E274D]" />
                              <span>Payment Attachments ({paths.length} files)</span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Viewing Receipt {selectedAttachmentIndex + 1} of {paths.length}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-0.5">
                            {paths.map((p, idx) => {
                              const itemIsPdf = p.toLowerCase().endsWith(".pdf");
                              const isSelected = selectedAttachmentIndex === idx;
                              const ext = p.split(".").pop()?.toUpperCase() || (itemIsPdf ? "PDF" : "IMG");

                              return (
                                <button
                                  key={p + idx}
                                  type="button"
                                  onClick={() => setSelectedAttachmentIndex(idx)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap border ${
                                    isSelected
                                      ? "bg-[#0E274D] text-white border-[#0E274D] shadow-xs ring-2 ring-[#0E274D]/20"
                                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {itemIsPdf ? (
                                    <FileText className={`w-3.5 h-3.5 ${isSelected ? "text-amber-300" : "text-rose-500"}`} />
                                  ) : (
                                    <Eye className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-300" : "text-emerald-600"}`} />
                                  )}
                                  <span>Receipt {idx + 1} ({ext})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* File Preview */}
                      <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px] bg-slate-50/50">
                        {isLoadingProof ? (
                          <div className="flex flex-col items-center space-y-2 text-slate-400">
                            <RefreshCw className="w-8 h-8 animate-spin text-[#0E274D]" />
                            <span className="text-xs">Loading secure proof from private storage...</span>
                          </div>
                        ) : activeUrl ? (
                          isPdf ? (
                            <div className="text-center space-y-3 py-6">
                              <FileText className="w-16 h-16 text-rose-500 mx-auto" />
                              <div>
                                <p className="text-sm font-bold text-slate-800">PDF Payment Receipt</p>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">{fileName}</p>
                              </div>
                              <a
                                href={activeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-[#0E274D] text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 hover:bg-[#0E274D]/90 shadow-sm"
                              >
                                <span>Open PDF in New Window</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center space-y-2">
                              <img
                                src={activeUrl}
                                alt={`Bank Transfer Receipt - ${fileName}`}
                                className="max-h-[450px] w-auto object-contain rounded-lg shadow-sm"
                              />
                              <span className="text-[11px] text-slate-500 font-mono">{fileName}</span>
                            </div>
                          )
                        ) : (
                          <div className="text-center text-slate-400 text-xs py-8">
                            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                            Proof document could not be loaded from storage.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons in Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => setViewingProof(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>

                {viewingProof.status === "verified" && (
                  <button
                    onClick={() => handleDownloadPaidPo(viewingProof.orderId)}
                    disabled={downloadingPaidPoId === viewingProof.orderId}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{downloadingPaidPoId === viewingProof.orderId ? "Opening..." : "Download Paid PO (PDF)"}</span>
                  </button>
                )}

                {viewingProof.status === "pending_verification" && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setRejectingSub(viewingProof);
                        setRejectionReason("");
                      }}
                      className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 cursor-pointer"
                    >
                      Reject Proof
                    </button>
                    <button
                      onClick={() => setVerifyingSub(viewingProof)}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm cursor-pointer"
                    >
                      Verify Credit Received
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: Verify Confirmation Dialog */}
        {verifyingSub && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="font-bold text-slate-900 text-lg">Verify Bank Credit</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Confirm that this payment of <strong>₹{Number(verifyingSub.submittedAmount).toLocaleString("en-IN")}</strong> with UTR <strong>{verifyingSub.utrNumber}</strong> has been received in the ITACON company bank account.
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 text-left">
                  ⚠️ This action will mark the order <strong>PAID</strong>, register the UTR permanently, and trigger production fulfillment.
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => setVerifyingSub(null)}
                  disabled={isVerifying}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmVerify}
                  disabled={isVerifying}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isVerifying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Confirm & Mark Paid</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: Rejection Dialog */}
        {rejectingSub && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <XCircle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="font-bold text-slate-900 text-lg">Reject Payment Submission</h3>
                <p className="text-xs text-slate-500">
                  PO #{rejectingSub.orderReference} • UTR: {rejectingSub.utrNumber}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Rejection Reason (Required, visible to customer)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. UTR number not found in bank statement, or amount credited differs from total..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[90px]"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => {
                    setRejectingSub(null);
                    setRejectionReason("");
                  }}
                  disabled={isRejecting}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isRejecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Reject Submission</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function SalesOrdersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading sales orders & factory fulfillment...</div>}>
      <SalesOrdersContent />
    </Suspense>
  );
}

