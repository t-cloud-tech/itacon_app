"use client";

import { invalidateFirestoreCache } from "@/lib/firestore-cache";
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
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
import { PAYMENT_TERM_OPTIONS } from "@/lib/payment-terms";
import { fetchLiveCustomers } from "@/lib/customer-service";
import { fetchAppTiles, isAdhesiveProduct } from "@/lib/catalogue-service";
import { DefaulterCheckCard } from "@/components/customers/defaulter-check-card";
import { fetchOrderById, linkQuotationToOrder, ClientOrderPO, MIN_RATE_PER_SQFT } from "@/lib/order-service";

interface ClearableInputProps {
  value: number;
  isIntegerOnly?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onChangeNumber: (val: number) => void;
  onBlurValidate: (rawText: string) => number;
  className?: string;
  placeholder?: string;
  title?: string;
}

function ClearableInput({
  value,
  isIntegerOnly = false,
  disabled,
  readOnly,
  onChangeNumber,
  onBlurValidate,
  className,
  placeholder,
  title,
}: ClearableInputProps) {
  const [text, setText] = useState<string>(() => {
    if (value === undefined || value === null) return "";
    return String(value);
  });
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      setText(value !== undefined && value !== null ? String(value) : "");
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (isIntegerOnly) {
      // Whole numbers only: no minus, no decimals, no letters
      raw = raw.replace(/\D/g, "");
    } else {
      // Positive decimals: digits and at most one decimal point
      raw = raw.replace(/[^\d.]/g, "");
      const parts = raw.split(".");
      if (parts.length > 2) {
        raw = parts[0] + "." + parts.slice(1).join("");
      }
    }
    setText(raw);
    if (raw === "") {
      onChangeNumber(0);
    } else {
      const parsed = isIntegerOnly ? parseInt(raw, 10) : parseFloat(raw);
      onChangeNumber(isNaN(parsed) ? 0 : parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const validatedNum = onBlurValidate(text);
    setText(String(validatedNum));
    onChangeNumber(validatedNum);
  };

  return (
    <input
      type="text"
      inputMode={isIntegerOnly ? "numeric" : "decimal"}
      value={text}
      disabled={disabled}
      readOnly={readOnly}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      title={title}
    />
  );
}

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
  const [quotationMode, setQuotationMode] = useState<"standard" | "mrp">("standard");
  const isMrpMode = quotationMode === "mrp";
  const [linkedOrder, setLinkedOrder] = useState<ClientOrderPO | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(!!orderId);

  // Line items state
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [availableTiles, setAvailableTiles] = useState<any[]>([]);
  const [loadingTiles, setLoadingTiles] = useState(true);
  const [itemError, setItemError] = useState<{ [key: number]: string }>({});
  const [designSearch, setDesignSearch] = useState<{ [key: number]: string }>({});

  const [freightCharges, setFreightCharges] = useState<number>(0);
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
              const boxWeightKg = Number(pi.weightPerBoxKg || 27.0);
              const weightKg = Number((qty * boxWeightKg).toFixed(1));

              // Base price is per SQFT (e.g. 35/sqft). If legacy data has box price (> 150), convert to per sqft.
              let basePricePerSqft = Number(pi.basePrice) || 35;
              if (basePricePerSqft > 150 && sqftPerBox > 0) {
                basePricePerSqft = Number((basePricePerSqft / sqftPerBox).toFixed(2));
              }

              const disc = pi.discountPercent !== undefined ? Number(pi.discountPercent) : 0;
              // 35/sqf means: 35 x 15.5 (sqf per box) = 542.50 per box
              const effRateSqft = Number((basePricePerSqft * (1 - disc / 100)).toFixed(2));
              const effPricePerBox = Number((effRateSqft * sqftPerBox).toFixed(2));
              const total = Number((qty * effPricePerBox).toFixed(2));

              return {
                productId: pi.productId || "prod-po",
                productName: pi.productName || "Tile Item",
                sku: pi.sku || "ITA-SKU",
                size: pi.size || "600x1200 mm",
                finish: pi.surface || "Rustic",
                quantityBoxes: qty,
                sqftPerBox: sqftPerBox,
                totalSqft: sqft,
                boxWeightKg,
                weightKg: weightKg,
                unitPrice: basePricePerSqft, // Rate per sq.ft (e.g. 35)
                discountPercent: disc,
                effectivePrice: effPricePerBox, // Price per box (e.g. 542.50)
                lineTotal: total, // Quantity boxes * Price per box
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

  // Load real tiles from Firestore
  useEffect(() => {
    let isMounted = true;
    async function loadRealTiles() {
      setLoadingTiles(true);
      try {
        const tiles = await fetchAppTiles(false);
        const validTiles = tiles.filter(
          (t) => !isAdhesiveProduct(t) && t.isActive !== false && t.isAdhesive !== true
        );
        if (isMounted) {
          setAvailableTiles(validTiles);

          // If opened with prefilled productId from catalogue and no items:
          const prefillId = searchParams.get("productId");
          if (prefillId && !orderId) {
            const match = validTiles.find((t) => t.id === prefillId || t.sku === prefillId);
            if (match) {
              const sqftPerBox = Number(match.sqFtPerBox || match.packingDetails?.coverageSqFt || 15.5);
              const boxWeightKg = Number(match.boxWeightKg || match.packingDetails?.boxWeightKg || match.weightPerBoxKg || 27.0);
              let price = Number(match.basePrice || match.price || 35);
              if (price > 150 && sqftPerBox > 0) price = Number((price / sqftPerBox).toFixed(2));
              setItems([
                {
                  productId: match.id,
                  productName: match.name || match.productName || "Tile",
                  sku: match.sku || "",
                  size: match.size || "600x1200 mm",
                  surface: match.surface || match.finish || "Standard",
                  finish: match.surface || match.finish || "Standard",
                  quantityBoxes: 1,
                  sqftPerBox,
                  totalSqft: sqftPerBox,
                  weightKg: boxWeightKg,
                  boxWeightKg,
                  pcsPerBox: Number(match.pcsPerBox || 2),
                  unitPrice: price,
                  discountPercent: 0,
                  effectivePrice: Number((price * sqftPerBox).toFixed(2)),
                  lineTotal: Number((price * sqftPerBox).toFixed(2)),
                },
              ]);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load tiles from Firestore:", err);
      } finally {
        if (isMounted) setLoadingTiles(false);
      }
    }

    loadRealTiles();
    return () => {
      isMounted = false;
    };
  }, [searchParams, orderId]);

  // Distinct sizes from loaded real tiles
  const distinctSizes: string[] = useMemo(() => {
    const set = new Set<string>();
    availableTiles.forEach((t) => {
      if (t.size && typeof t.size === "string") {
        set.add(t.size.trim());
      }
    });
    return Array.from(set).sort();
  }, [availableTiles]);

  const handleAddItem = () => {
    if (linkedOrder) return;
    const defaultSize = distinctSizes.length > 0 ? distinctSizes[0] : "600x1200 mm";
    setItems((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
        sku: "",
        size: defaultSize,
        surface: "",
        finish: "",
        quantityBoxes: 1,
        sqftPerBox: 15.5,
        totalSqft: 15.5,
        weightKg: 27,
        boxWeightKg: 27,
        pcsPerBox: 2,
        unitPrice: 35,
        discountPercent: 0,
        effectivePrice: 542.5,
        lineTotal: 542.5,
      },
    ]);
  };

  const handleSizeSelect = (index: number, newSize: string) => {
    setItemError((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
    setDesignSearch((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        size: newSize,
        productId: "",
        productName: "",
        sku: "",
      };
      return copy;
    });
  };

  const handleDesignSelect = (index: number, tileId: string) => {
    if (!tileId) return;
    const alreadyExists = items.some((it, i) => i !== index && it.productId === tileId);
    if (alreadyExists) {
      setItemError((prev) => ({
        ...prev,
        [index]: "This tile is already added. Update its quantity instead.",
      }));
      return;
    }

    const tile = availableTiles.find((t) => t.id === tileId);
    if (!tile) return;

    setItemError((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });

    const sqftPerBox = Number(tile.sqFtPerBox || tile.packingDetails?.coverageSqFt || 15.5);
    const boxWeightKg = Number(tile.boxWeightKg || tile.packingDetails?.boxWeightKg || tile.weightPerBoxKg || 27.0);
    const pcsPerBox = Number(tile.pcsPerBox || tile.packingDetails?.pcsPerBox || 2);
    let basePricePerSqft = Number(tile.basePrice || tile.price || 35);
    if (basePricePerSqft > 150 && sqftPerBox > 0) {
      basePricePerSqft = Number((basePricePerSqft / sqftPerBox).toFixed(2));
    }

    setItems((prev) => {
      const copy = [...prev];
      const current = copy[index] || {};
      const boxes = current.quantityBoxes && current.quantityBoxes >= 1 ? current.quantityBoxes : 1;
      const totalSqft = Number((boxes * sqftPerBox).toFixed(2));
      const disc = current.discountPercent || 0;
      const effRateSqft = Number((basePricePerSqft * (1 - disc / 100)).toFixed(2));
      const effPricePerBox = Number((effRateSqft * sqftPerBox).toFixed(2));
      const lineTotal = Number((totalSqft * effRateSqft).toFixed(2));
      const weightKg = Number((boxes * boxWeightKg).toFixed(1));

      copy[index] = {
        productId: tile.id,
        productName: tile.name || tile.productName || "Tile Design",
        sku: tile.sku || "",
        size: tile.size || current.size || "600x1200 mm",
        surface: tile.surface || tile.finish || "Standard",
        finish: tile.surface || tile.finish || "Standard",
        quantityBoxes: boxes,
        sqftPerBox,
        totalSqft,
        weightKg,
        boxWeightKg,
        pcsPerBox,
        unitPrice: basePricePerSqft,
        discountPercent: disc,
        effectivePrice: effPricePerBox,
        lineTotal,
        catalogueSqftPerBox: sqftPerBox,
        catalogueBasePrice: basePricePerSqft,
        roundUpNote: undefined,
      };
      return copy;
    });
  };

  const handleResetSqft = (index: number) => {
    if (linkedOrder) return;
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      const resetSqft = item.catalogueSqftPerBox ?? 15.5;
      item.sqftPerBox = resetSqft;
      const boxes = item.quantityBoxes || 0;
      item.totalSqft = Number((boxes * resetSqft).toFixed(2));
      const effRateSqft = Number((item.unitPrice * (1 - (item.discountPercent || 0) / 100)).toFixed(2));
      item.effectivePrice = Number((effRateSqft * resetSqft).toFixed(2));
      item.lineTotal = Number((item.totalSqft * effRateSqft).toFixed(2));
      copy[index] = item;
      return copy;
    });
  };

  const handleUpdateItem = (index: number, field: string, val: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      const boxWeightKg = item.boxWeightKg || 27.0;

      if (field === "quantityBoxes") {
        if (linkedOrder) return copy;
        item.quantityBoxes = val;
      } else if (field === "sqftPerBox") {
        if (linkedOrder) return copy;
        item.sqftPerBox = val;
      } else if (field === "unitPrice") {
        item.unitPrice = val;
      } else if (field === "discountPercent") {
        item.discountPercent = val;
      } else if (field === "mrp") {
        item.mrp = val;
      }

      // Calculations:
      // Line total area = Boxes * Sq.ft/Box
      // Line Total (₹) = Boxes * Sq.ft/Box * Base Price * (1 - Discount% / 100)
      const boxes = item.quantityBoxes || 0;
      const sqftPerBox = item.sqftPerBox || 0;
      const totalSqft = Number((boxes * sqftPerBox).toFixed(2));
      item.totalSqft = totalSqft;

      const effRateSqft = Number((item.unitPrice * (1 - (item.discountPercent || 0) / 100)).toFixed(2));
      const effPricePerBox = Number((effRateSqft * sqftPerBox).toFixed(2));
      item.effectivePrice = effPricePerBox;
      item.lineTotal = Number((totalSqft * effRateSqft).toFixed(2));
      item.weightKg = Number((boxes * boxWeightKg).toFixed(1));

      copy[index] = item;
      return copy;
    });
  };

  const handleProceedToStep3 = () => {
    setItems((prev) =>
      prev.map((it) => {
        const boxes = Math.max(1, it.quantityBoxes || 1);
        const sqftPerBox = it.sqftPerBox > 0 ? it.sqftPerBox : (it.catalogueSqftPerBox || 15.5);
        const unitPrice = it.unitPrice > 0 ? it.unitPrice : (it.catalogueBasePrice || 35);
        const disc = Math.min(100, Math.max(0, it.discountPercent || 0));
        const totalSqft = Number((boxes * sqftPerBox).toFixed(2));
        const effRateSqft = Number((unitPrice * (1 - disc / 100)).toFixed(2));
        const effPricePerBox = Number((effRateSqft * sqftPerBox).toFixed(2));
        const lineTotal = Number((totalSqft * effRateSqft).toFixed(2));
        const boxWeightKg = it.boxWeightKg || 27.0;
        const weightKg = Number((boxes * boxWeightKg).toFixed(1));
        return {
          ...it,
          quantityBoxes: boxes,
          sqftPerBox,
          unitPrice,
          discountPercent: disc,
          totalSqft,
          effectivePrice: effPricePerBox,
          lineTotal,
          weightKg,
        };
      })
    );
    setStep(3);
  };

  const handleRemoveItem = (index: number) => {
    if (linkedOrder) return; // Prevent deleting items from customer PO
    setItemError((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
    setDesignSearch((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Totals calculations
  const totalBoxes = items.reduce((sum, i) => sum + (i.quantityBoxes || 0), 0);
  const totalWeightKg = items.reduce((sum, i) => sum + (i.weightKg || 0), 0);
  const totalWeightTons = Number((totalWeightKg / 1000).toFixed(2));
  const totalSqft = Number(items.reduce((sum, i) => sum + (i.totalSqft || 0), 0).toFixed(1));

  const subtotal = Number(items.reduce((sum, i) => sum + (i.lineTotal || 0), 0).toFixed(2));
  const maxDiscountGiven = items.reduce((max, i) => Math.max(max, i.discountPercent || 0), 0);

  // Per Sq. Ft Rate Analysis (< ₹26.50/sq.ft threshold rule)
  const avgRatePerSqft = totalSqft > 0 ? Number((subtotal / totalSqft).toFixed(2)) : 0;
  const itemsBelowMinRate = items.filter(i => {
    const rate = i.unitPrice * (1 - (i.discountPercent || 0) / 100);
    return rate < MIN_RATE_PER_SQFT;
  });
  const isRateBelowThreshold = avgRatePerSqft < MIN_RATE_PER_SQFT || itemsBelowMinRate.length > 0;

  // Special discount approval rule (> 15% discount)
  const requiresSpecialApproval = maxDiscountGiven > 15;

  // Mandatory Admin Confirmation applies if cost < ₹26.50/sq.ft OR discount > 15%
  const requiresAdminConfirmation = isRateBelowThreshold || requiresSpecialApproval;

  // MRP-based quotation: Basic amount = sum of boxes * MRP * sqft per box
  const mrpLineTotal = (i: QuotationItem) => {
    const lineArea = i.totalSqft || ((i.quantityBoxes || 0) * (i.sqftPerBox || 15.5));
    return Number((lineArea * (i.mrp || 0)).toFixed(2));
  };
  const basicAmount = Number(items.reduce((sum, i) => sum + mrpLineTotal(i), 0).toFixed(2));
  const insuranceAmount = Number((basicAmount * 0.0035).toFixed(2));
  const basicPlusInsurance = Number((basicAmount + insuranceAmount).toFixed(2));
  const mrpGstAmount = Number((basicPlusInsurance * 0.18).toFixed(2));
  const estimatedTotal = Number((basicPlusInsurance + mrpGstAmount).toFixed(2));
  const packagingCharges = Number(((subtotal - estimatedTotal) / 100).toFixed(2));

  const taxAmount = isMrpMode
    ? mrpGstAmount
    : Number(((subtotal + freightCharges) * (taxPercent / 100)).toFixed(2));
  const grandTotal = isMrpMode
    ? estimatedTotal
    : Number((subtotal + freightCharges + taxAmount).toFixed(2));

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
    createdAt: linkedOrder.createdAt || "2026-01-01T00:00:00.000Z",
    updatedAt: linkedOrder.createdAt || "2026-01-01T00:00:00.000Z",
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
      // If cost < 26.50 / sq.ft, status is strictly pending_admin_approval
      const quoteStatus = requiresAdminConfirmation ? "pending_admin_approval" : "approved";
      const discountTotal = items.reduce((sum, i) => {
        const sqftPerBox = i.sqftPerBox || 15.5;
        const lineArea = i.totalSqft || ((i.quantityBoxes || 0) * sqftPerBox);
        const undiscountedLineTotal = lineArea * i.unitPrice;
        return sum + Math.max(0, undiscountedLineTotal - i.lineTotal);
      }, 0);

      invalidateFirestoreCache();
      const docRef = await addDoc(collection(db, "quotations"), {
        quotationNumber: quoteNumber,
        orderId: linkedOrder ? linkedOrder.id : null,
        poNumber: linkedOrder ? (linkedOrder.poNumber || linkedOrder.orderReference) : null,
        customerId: selectedCust.id,
        customerName: selectedCust.companyName || selectedCust.name,
        customerPhone: selectedCust.phone,
        salespersonId: user?.userId || salesperson?.salesPersonId || "sp-1",
        salespersonName: user?.name || salesperson?.name || "Senior Sales Executive",
        status: quoteStatus,
        items,
        subtotal,
        discountTotal,
        taxPercent,
        taxAmount,
        shippingCharge: isMrpMode ? 0 : freightCharges,
        grandTotal,
        quotationMode,
        ...(isMrpMode
          ? { basicAmount, insuranceAmount, basicPlusInsurance, packagingCharges }
          : {}),
        totalBoxes,
        totalWeightTons,
        paymentTerms,
        validityDays,
        expiryDate: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        pricePerSqft: avgRatePerSqft,
        rateThreshold: MIN_RATE_PER_SQFT,
        requiresSpecialApproval: requiresAdminConfirmation,
        approvalStatus: requiresAdminConfirmation ? "pending" : "approved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });

      // If linked to a client order:
      // If cost < 26.50/sq.ft -> order status = 'pending_admin_approval' (customer cannot see confirmed yet)
      // If cost >= 26.50/sq.ft -> order status = 'rate_quoted' (customer can see immediately on app)
      if (linkedOrder) {
        await linkQuotationToOrder(
          linkedOrder.id,
          docRef.id,
          quoteNumber,
          items,
          subtotal,
          discountTotal,
          grandTotal,
          {
            requiresAdminConfirmation: requiresAdminConfirmation,
            pricePerSqft: avgRatePerSqft,
            salespersonId: user?.userId || salesperson?.salesPersonId,
            salespersonName: user?.name || salesperson?.name,
            taxAmount: taxAmount,
            quotationMode,
            ...(isMrpMode
              ? { basicAmount, insuranceAmount, basicPlusInsurance, packagingCharges }
              : {}),
          }
        );
      }

      // If admin confirmation required, create an approval request record for Admin
      if (requiresAdminConfirmation) {
        invalidateFirestoreCache();
        await addDoc(collection(db, "approvalRequests"), {
          referenceType: isRateBelowThreshold ? "low_rate_po" : "quotation",
          referenceId: docRef.id,
          referenceNumber: linkedOrder ? (linkedOrder.poNumber || quoteNumber) : quoteNumber,
          orderId: linkedOrder ? linkedOrder.id : null,
          salespersonId: user?.userId || salesperson?.salesPersonId || "sp-1",
          salespersonName: user?.name || salesperson?.name || "Sales Executive",
          customerId: selectedCust.id,
          customerName: selectedCust.companyName || selectedCust.name,
          discountRequested: maxDiscountGiven,
          pricePerSqft: avgRatePerSqft,
          rateThreshold: MIN_RATE_PER_SQFT,
          totalValue: grandTotal,
          reason: isRateBelowThreshold
            ? `PO effective rate is ₹${avgRatePerSqft.toFixed(2)}/sq.ft, which is below the mandatory ₹${MIN_RATE_PER_SQFT.toFixed(2)}/sq.ft threshold. Requires Admin confirmation before customer app release.`
            : `Special discount of ${maxDiscountGiven}% requested (exceeds default 15% salesperson threshold)`,
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

              <div className="md:col-span-2">
                <DefaulterCheckCard gstNumber={selectedCust?.gstNumber} />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Pricing Method
                </label>
                <select
                  value={quotationMode}
                  onChange={(e) => setQuotationMode(e.target.value as "standard" | "mrp")}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="standard">Simple</option>
                  <option value="mrp">MRP Linked (Reduced Basic)</option>
                </select>
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
                  {PAYMENT_TERM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  {paymentTerms && !PAYMENT_TERM_OPTIONS.some((o) => o.value === paymentTerms) && (
                    <option value={paymentTerms}>{paymentTerms}</option>
                  )}




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
                    : "Select real tiles from catalogue and input box or sq.ft quantities"}
                </p>
              </div>

              {!linkedOrder && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-[#E66A23] to-[#F59E0B] hover:opacity-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Tile Line Item</span>
                </button>
              )}
            </div>

            {/* Line items list / empty state */}
            {items.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
                <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  No tiles added yet. Click &apos;Add Tile Line Item&apos; to start.
                </p>
                {!linkedOrder && (
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Tile Line Item</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    {!item.productId ? (
                      /* Selection Mode inside the new line item */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-[#E66A23]" />
                            <span className="text-xs font-bold text-[#0E274D]">Select Tile from Firestore Catalogue</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* 1. Tile Size Dropdown */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-700 block mb-1">
                              1. Tile Size *
                            </label>
                            <select
                              value={item.size || ""}
                              onChange={(e) => handleSizeSelect(idx, e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-[#0E274D] focus:outline-none"
                            >
                              <option value="">-- Choose Tile Size --</option>
                              {distinctSizes.map((s: string) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 2. Tile Design Dropdown (Searchable) */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-700 block mb-1">
                              2. Tile Design *
                            </label>
                            <input
                              type="text"
                              placeholder="Filter designs by name or SKU..."
                              disabled={!item.size}
                              value={designSearch[idx] || ""}
                              onChange={(e) => setDesignSearch((prev) => ({ ...prev, [idx]: e.target.value }))}
                              className="w-full px-2.5 py-1 mb-1.5 border border-slate-200 rounded text-xs bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0E274D] disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                            <select
                              value=""
                              disabled={!item.size}
                              onChange={(e) => handleDesignSelect(idx, e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#0E274D] focus:outline-none ${
                                !item.size
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                  : "bg-white text-slate-800 border-slate-300"
                              }`}
                            >
                              <option value="">
                                {!item.size
                                  ? "-- Select Tile Size First --"
                                  : `-- Select Tile Design (${
                                      availableTiles
                                        .filter((t) => t.size === item.size)
                                        .filter(
                                          (t) =>
                                            !designSearch[idx] ||
                                            (t.name || t.productName || "")
                                              .toLowerCase()
                                              .includes(designSearch[idx].toLowerCase()) ||
                                            (t.sku || "").toLowerCase().includes(designSearch[idx].toLowerCase())
                                        ).length
                                    } available) --`}
                              </option>
                              {availableTiles
                                .filter((t) => t.size === item.size)
                                .filter(
                                  (t) =>
                                    !designSearch[idx] ||
                                    (t.name || t.productName || "")
                                      .toLowerCase()
                                      .includes(designSearch[idx].toLowerCase()) ||
                                    (t.sku || "").toLowerCase().includes(designSearch[idx].toLowerCase())
                                )
                                .map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name || t.productName} • {t.sku} • {t.surface || t.finish || "Standard"}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        {itemError[idx] && (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{itemError[idx]}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Configured Line Item */
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-[#0E274D]">
                              {item.productName} {item.size} • {item.sku}
                              {item.surface ? ` • ${item.surface}` : ""}
                            </span>
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
                              className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              title="Delete line item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isMrpMode ? "lg:grid-cols-6" : "lg:grid-cols-5"} gap-3 pt-2`}>
                          {/* 1. BOXES */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Boxes {linkedOrder && <span className="text-slate-400 font-normal">(Locked)</span>}
                            </label>
                            <ClearableInput
                              value={item.quantityBoxes}
                              isIntegerOnly={true}
                              disabled={!!linkedOrder}
                              readOnly={!!linkedOrder}
                              onChangeNumber={(n) => handleUpdateItem(idx, "quantityBoxes", n)}
                              onBlurValidate={(raw) => {
                                const parsed = parseInt(raw, 10);
                                return isNaN(parsed) || parsed < 1 ? 1 : parsed;
                              }}
                              className={`w-full px-2.5 py-1.5 border rounded text-xs font-bold ${
                                linkedOrder
                                  ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                                  : "bg-white text-slate-800 border-slate-200 focus:ring-1 focus:ring-[#0E274D]"
                              }`}
                              title={linkedOrder ? "Box count is fixed to customer PO request" : ""}
                            />
                          </div>

                          {/* 2. SQ.FT / BOX */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              SQ.FT / BOX {linkedOrder && <span className="text-slate-400 font-normal">(Locked)</span>}
                            </label>
                            <ClearableInput
                              value={item.sqftPerBox}
                              isIntegerOnly={false}
                              disabled={!!linkedOrder}
                              readOnly={!!linkedOrder}
                              onChangeNumber={(n) => handleUpdateItem(idx, "sqftPerBox", n)}
                              onBlurValidate={(raw) => {
                                const parsed = parseFloat(raw);
                                return isNaN(parsed) || parsed <= 0 ? (item.catalogueSqftPerBox ?? 15.5) : parsed;
                              }}
                              className={`w-full px-2.5 py-1.5 border rounded text-xs font-bold ${
                                linkedOrder
                                  ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                                  : "bg-white text-slate-800 border-slate-200 focus:ring-1 focus:ring-[#0E274D]"
                              }`}
                              title={linkedOrder ? "Sq.ft / box is fixed to customer PO request" : ""}
                            />
                            {item.catalogueSqftPerBox !== undefined &&
                              Math.abs(item.sqftPerBox - item.catalogueSqftPerBox) > 0.001 &&
                              !linkedOrder && (
                                <button
                                  type="button"
                                  onClick={() => handleResetSqft(idx)}
                                  className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium block mt-0.5 cursor-pointer text-left"
                                >
                                  Reset to {item.catalogueSqftPerBox}
                                </button>
                              )}
                          </div>

                          {/* 3. BASE PRICE */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-700 block mb-1 flex items-center justify-between">
                              <span>Base Price (₹/sq.ft)</span>
                              {linkedOrder && <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">Edit</span>}
                            </label>
                            <ClearableInput
                              value={item.unitPrice}
                              isIntegerOnly={false}
                              onChangeNumber={(n) => handleUpdateItem(idx, "unitPrice", n)}
                              onBlurValidate={(raw) => {
                                const parsed = parseFloat(raw);
                                return isNaN(parsed) || parsed <= 0 ? (item.catalogueBasePrice ?? 35) : parsed;
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-[#0E274D] focus:ring-2 focus:ring-[#0E274D] rounded text-xs font-bold text-slate-900"
                              placeholder="Rate (₹/sqft)"
                            />
                          </div>

                          {/* MRP (if applicable) */}
                          {isMrpMode && (
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-700 block mb-1">
                                MRP (₹/sq.ft)
                              </label>
                              <ClearableInput
                                value={item.mrp ?? 0}
                                isIntegerOnly={false}
                                onChangeNumber={(n) => handleUpdateItem(idx, "mrp", n)}
                                onBlurValidate={(raw) => {
                                  const parsed = parseFloat(raw);
                                  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#0E274D] focus:ring-2 focus:ring-[#0E274D] rounded text-xs font-bold text-slate-900"
                                placeholder="MRP"
                              />
                            </div>
                          )}

                          {/* 4. DISCOUNT % */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-700 block mb-1 flex items-center justify-between">
                              <span>Discount %</span>
                              {linkedOrder && <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">Edit</span>}
                            </label>
                            <ClearableInput
                              value={item.discountPercent}
                              isIntegerOnly={false}
                              onChangeNumber={(n) => handleUpdateItem(idx, "discountPercent", n)}
                              onBlurValidate={(raw) => {
                                const parsed = parseFloat(raw);
                                if (isNaN(parsed) || parsed < 0) return 0;
                                if (parsed > 100) return 100;
                                return parsed;
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-[#0E274D] focus:ring-2 focus:ring-[#0E274D] rounded text-xs font-bold text-slate-900"
                              placeholder="0"
                            />
                          </div>

                          {/* 5. LINE TOTAL */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Line Total</label>
                            <span className="text-xs font-bold text-[#0E274D] block py-1.5">
                              ₹{Number(isMrpMode ? mrpLineTotal(item) : item.lineTotal).toLocaleString("en-IN")}
                            </span>
                          </div>

                          {/* RATE PER SQ. FT INDICATOR */}
                          <div className={`col-span-2 sm:col-span-3 ${isMrpMode ? "lg:col-span-6" : "lg:col-span-5"} pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px]`}>
                            <div className="flex items-center space-x-2">
                              <span className="text-slate-500">Effective Rate per Sq. Ft:</span>
                              <strong className="text-[#0E274D] font-bold">
                                ₹{(item.unitPrice * (1 - (item.discountPercent || 0) / 100)).toFixed(2)} / sq.ft
                              </strong>
                              <span className="text-slate-500 font-medium text-[11px]">(₹{item.effectivePrice.toFixed(2)}/box)</span>
                            </div>
                            {(item.unitPrice * (1 - (item.discountPercent || 0) / 100)) < MIN_RATE_PER_SQFT ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-amber-700" />
                                Rate &lt; ₹26.50 / sq.ft (Admin Confirmation Required)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Rate &ge; ₹26.50 / sq.ft (Direct App Sync)
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

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
              <div className="flex items-center space-x-1.5">
                <span>Avg Rate:</span>
                <strong className={`px-2 py-0.5 rounded text-xs ${avgRatePerSqft < MIN_RATE_PER_SQFT ? 'bg-amber-100 text-amber-900 font-extrabold border border-amber-300' : 'bg-emerald-100 text-emerald-800'}`}>
                  ₹{avgRatePerSqft.toFixed(2)}/sq.ft
                </strong>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-[#0E274D]">Subtotal: ₹{subtotal.toLocaleString("en-IN")}</span>
                {isMrpMode && (
                  <span className="block text-sm font-extrabold text-[#0E274D]">Basic amount: ₹{basicAmount.toLocaleString("en-IN")}</span>
                )}
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
                disabled={items.length === 0 || items.some((i) => !i.productId)}
                onClick={handleProceedToStep3}
                className={`flex items-center space-x-2 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all ${
                  items.length === 0 || items.some((i) => !i.productId)
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
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
                {!isMrpMode && (
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
                )}

                {/* DYNAMIC APPROVAL RULES BANNER */}
                {isRateBelowThreshold ? (
                  <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-2.5">
                    <div className="flex items-center space-x-2 font-bold text-xs text-amber-900">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Admin Confirmation Required (Cost &lt; ₹26.50 / Sq. Ft)</span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Effective price is <strong>₹{avgRatePerSqft.toFixed(2)} per sq. foot</strong>, which is below the minimum authorization threshold of <strong>₹{MIN_RATE_PER_SQFT.toFixed(2)}/sq.ft</strong>.
                    </p>
                    <div className="p-2.5 rounded-lg bg-amber-100/80 border border-amber-300 text-xs text-amber-950 font-medium leading-relaxed">
                      🔒 <strong>Direct App Protection Policy:</strong> When quoting &lt; ₹26.50/sq.ft, this request goes to Admin for confirmation. When Admin accepts or rejects, the update returns to your <strong>Salesperson Approval Tab</strong>. <strong>Admin cannot directly update or alter the PO details on the customer app</strong>. You maintain full authority to review Admin notes and release the finalized quote to your client.
                    </div>
                  </div>
                ) : requiresSpecialApproval ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center space-x-2 font-bold text-xs text-amber-800">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Special Discount Approval Required</span>
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Discount of <strong>{maxDiscountGiven}%</strong> exceeds your standard 15% salesperson authorization limit. Routed to Admin for approval.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1.5">
                    <div className="flex items-center space-x-2 font-bold text-xs text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Direct Customer App Visibility (Price &gt; ₹26.50 / Sq. Ft)</span>
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Effective rate is <strong>₹{avgRatePerSqft.toFixed(2)}/sq.ft</strong> (&gt; ₹26.50). Once submitted, the confirmed PO and quoted rates will immediately be visible to the customer on the mobile app.
                    </p>
                  </div>
                )}

                {linkedOrder && (
                  <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Live Mobile App Order Sync</span>
                    </div>
                    <p className="text-[11px] text-blue-700 leading-normal">
                      Linked to Client PO <strong>{linkedOrder.poNumber || linkedOrder.orderReference}</strong>. 
                      {isRateBelowThreshold 
                        ? " Will transition to pending_admin_approval. Once confirmed by Admin, returns to your Salesperson Approval Tab."
                        : " Will transition to rate_quoted for instant client review."}
                    </p>
                  </div>
                )}
              </div>

              {/* Bill breakdown summary card */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Summary</h3>
                
                {isMrpMode ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Basic amount:</span>
                      <span className="font-semibold">₹{basicAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Insurance:</span>
                      <span className="font-semibold">₹{insuranceAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Basic + insurance:</span>
                      <span className="font-semibold">₹{basicPlusInsurance.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>18% GST:</span>
                      <span className="font-semibold">₹{mrpGstAmount.toLocaleString("en-IN")}</span>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-sm">
                      <span className="font-bold text-[#0E274D]">Estimated total<sup className="text-[10px]">*</sup>:</span>
                      <span className="text-xl font-extrabold text-[#0E274D]">
                        ₹{estimatedTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      *Premium packaging charges: ₹{packagingCharges.toLocaleString("en-IN")}
                    </p>
                  </div>
                ) : (
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
                )}

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
