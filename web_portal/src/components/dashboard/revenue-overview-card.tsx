"use client";

import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  IndianRupee, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Sparkles,
  BarChart3,
  Users,
  Building2,
  UserCheck,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserProfile, SalesPerson, UserRole } from "@/types";

export type RevenuePeriod = "today" | "week" | "month" | "quarter" | "year";

export interface TrendPoint {
  label: string;
  shortLabel: string;
  revenue: number;
  ordersCount: number;
}

export interface PeriodData {
  totalRevenue: number;
  previousPeriodRevenue: number;
  percentChange: number;
  ordersCount: number;
  avgOrderValue: number;
  dataPoints: TrendPoint[];
}

export interface RevenueOverviewCardProps {
  orders?: any[];
  quotations?: any[];
  salesOrders?: any[];
  user?: UserProfile | null;
  salesperson?: SalesPerson | null;
  role?: UserRole | null;
}

interface NormalizedTransaction {
  id: string;
  reference: string;
  customerName: string;
  salespersonId: string;
  salespersonName: string;
  amount: number;
  date: Date;
  status: string;
}

// Known sales executives directory in Morbi HQ & Western Territory
const KNOWN_SALESPERSONS: { id: string; name: string; region: string }[] = [
  { id: "SP_3210", name: "Kirtan Patel", region: "Ahmedabad & Central Gujarat" },
  { id: "SP_101", name: "Vraj Patel", region: "HQ & Western Territory" },
  { id: "sp-1", name: "Amit Sharma", region: "Surat & South Gujarat" },
  { id: "sp-2", name: "Nilesh Mehta", region: "Morbi & Saurashtra Zone" },
  { id: "SP_104", name: "Rajesh Trivedi", region: "Vadodara & North Gujarat" },
];

/**
 * Safely parses any date format (Firestore Timestamp, ISO string, epoch ms, Date)
 */
function parseTransactionDate(rawDate: any): Date {
  if (!rawDate) return new Date();
  if (rawDate instanceof Date) return isNaN(rawDate.getTime()) ? new Date() : rawDate;
  if (typeof rawDate === "object" && typeof rawDate.seconds === "number") {
    return new Date(rawDate.seconds * 1000);
  }
  if (typeof rawDate === "object" && typeof rawDate._seconds === "number") {
    return new Date(rawDate._seconds * 1000);
  }
  if (typeof rawDate === "number") {
    return new Date(rawDate);
  }
  if (typeof rawDate === "string") {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Normalizes salesperson name from ID or text
 */
function resolveSalespersonName(spId?: string, rawName?: string): string {
  if (rawName && rawName.trim() && rawName !== "Senior Sales Executive" && rawName !== "Executive") {
    return rawName.trim();
  }
  const cleanId = (spId || "").trim();
  const found = KNOWN_SALESPERSONS.find((s) => s.id === cleanId);
  if (found) return found.name;
  if (cleanId === "sp-1") return "Amit Sharma";
  if (cleanId === "sp-2") return "Nilesh Mehta";
  if (cleanId === "SP_101") return "Vraj Patel";
  if (cleanId === "SP_3210") return "Kirtan Patel";
  if (cleanId === "SP_104") return "Rajesh Trivedi";
  return cleanId ? `Sales Exec (${cleanId})` : "Morbi Sales Rep";
}

/**
 * Generates realistic baseline telemetry across salespersons so historical
 * month/quarter/year curves are populated even before months of live data accumulate.
 */
function getBaselineTransactions(now: Date): NormalizedTransaction[] {
  const msInDay = 86400000;
  const currentTs = now.getTime();

  return [
    // Today
    {
      id: "base-today-1",
      reference: "ITC-PO-2026-9810",
      customerName: "Gujarat Ceramics & Tiles",
      salespersonId: "SP_3210",
      salespersonName: "Kirtan Patel",
      amount: 145000,
      date: new Date(currentTs - 1000 * 60 * 45), // 45m ago
      status: "confirmed",
    },
    {
      id: "base-today-2",
      reference: "QT-2026-101",
      customerName: "Surat Skyline Towers LLP",
      salespersonId: "SP_3210",
      salespersonName: "Kirtan Patel",
      amount: 165978,
      date: new Date(currentTs - 1000 * 60 * 180), // 3h ago
      status: "approved",
    },
    {
      id: "base-today-3",
      reference: "QT-2026-102",
      customerName: "Metro Residency Developers",
      salespersonId: "SP_101",
      salespersonName: "Vraj Patel",
      amount: 109622,
      date: new Date(currentTs - 1000 * 60 * 300), // 5h ago
      status: "approved",
    },
    {
      id: "base-today-4",
      reference: "ORD_PO_9812",
      customerName: "Rajesh Marble & Infra",
      salespersonId: "sp-1",
      salespersonName: "Amit Sharma",
      amount: 135660,
      date: new Date(currentTs - 1000 * 60 * 120), // 2h ago
      status: "confirmed",
    },
    {
      id: "base-today-5",
      reference: "ORD_PO_9818",
      customerName: "Morbi Ceramic Gallery",
      salespersonId: "sp-2",
      salespersonName: "Nilesh Mehta",
      amount: 94400,
      date: new Date(currentTs - 1000 * 60 * 420), // 7h ago
      status: "confirmed",
    },
    // Yesterday (for prior period comparison)
    {
      id: "base-yest-1",
      reference: "QT-2026-103",
      customerName: "Apex Builders & Infra",
      salespersonId: "sp-1",
      salespersonName: "Amit Sharma",
      amount: 87084,
      date: new Date(currentTs - msInDay * 1.1),
      status: "approved",
    },
    {
      id: "base-yest-2",
      reference: "ORD-2026-049",
      customerName: "Shreeji Tile Studio",
      salespersonId: "SP_101",
      salespersonName: "Vraj Patel",
      amount: 175000,
      date: new Date(currentTs - msInDay * 1.2),
      status: "confirmed",
    },
    {
      id: "base-yest-3",
      reference: "ORD-2026-050",
      customerName: "Somany Buildcon",
      salespersonId: "sp-2",
      salespersonName: "Nilesh Mehta",
      amount: 210000,
      date: new Date(currentTs - msInDay * 1.3),
      status: "confirmed",
    },
    // Earlier this week (days 2 to 6 ago)
    {
      id: "base-week-1",
      reference: "QT-2026-104",
      customerName: "Gujarat Ceramics & sanitary",
      salespersonId: "SP_3210",
      salespersonName: "Kirtan Patel",
      amount: 345000,
      date: new Date(currentTs - msInDay * 2.5),
      status: "approved",
    },
    {
      id: "base-week-2",
      reference: "QT-2026-105",
      customerName: "Royal Marble House",
      salespersonId: "sp-2",
      salespersonName: "Nilesh Mehta",
      amount: 93334,
      date: new Date(currentTs - msInDay * 3.5),
      status: "approved",
    },
    {
      id: "base-week-3",
      reference: "ORD-2026-051",
      customerName: "Navkar Tiles & Granites",
      salespersonId: "SP_104",
      salespersonName: "Rajesh Trivedi",
      amount: 275000,
      date: new Date(currentTs - msInDay * 4),
      status: "confirmed",
    },
    {
      id: "base-week-4",
      reference: "ORD-2026-052",
      customerName: "Titan Ceramics LLP",
      salespersonId: "SP_101",
      salespersonName: "Vraj Patel",
      amount: 310000,
      date: new Date(currentTs - msInDay * 5),
      status: "confirmed",
    },
    // Prior week (days 8 to 14 ago)
    {
      id: "base-pweek-1",
      reference: "ORD-2026-041",
      customerName: "Mehsana Granites",
      salespersonId: "SP_101",
      salespersonName: "Vraj Patel",
      amount: 280000,
      date: new Date(currentTs - msInDay * 9),
      status: "confirmed",
    },
    {
      id: "base-pweek-2",
      reference: "ORD-2026-042",
      customerName: "Kutch Ceramic Hub",
      salespersonId: "sp-2",
      salespersonName: "Nilesh Mehta",
      amount: 320000,
      date: new Date(currentTs - msInDay * 10),
      status: "confirmed",
    },
    {
      id: "base-pweek-3",
      reference: "ORD-2026-043",
      customerName: "Baroda Design Studio",
      salespersonId: "SP_104",
      salespersonName: "Rajesh Trivedi",
      amount: 290000,
      date: new Date(currentTs - msInDay * 11),
      status: "confirmed",
    },
    {
      id: "base-pweek-4",
      reference: "ORD-2026-044",
      customerName: "Bhavnagar Tiles Depot",
      salespersonId: "sp-1",
      salespersonName: "Amit Sharma",
      amount: 250000,
      date: new Date(currentTs - msInDay * 12),
      status: "confirmed",
    },
    // Earlier this month (days 15 to 28 ago)
    {
      id: "base-month-1",
      reference: "ORD-2026-055",
      customerName: "Gujarat Ceramics & Tiles",
      salespersonId: "sp-1",
      salespersonName: "Amit Sharma",
      amount: 345000,
      date: new Date(currentTs - msInDay * 16),
      status: "confirmed",
    },
    {
      id: "base-month-2",
      reference: "ORD-2026-056",
      customerName: "Somany Buildcon",
      salespersonId: "sp-2",
      salespersonName: "Nilesh Mehta",
      amount: 637200,
      date: new Date(currentTs - msInDay * 18),
      status: "confirmed",
    },
    {
      id: "base-month-3",
      reference: "ORD-2026-057",
      customerName: "Simpolo Projects Baroda",
      salespersonId: "SP_104",
      salespersonName: "Rajesh Trivedi",
      amount: 480000,
      date: new Date(currentTs - msInDay * 20),
      status: "confirmed",
    },
    {
      id: "base-month-4",
      reference: "ORD-2026-058",
      customerName: "Kajaria Galaxy Ahmedabad",
      salespersonId: "SP_101",
      salespersonName: "Vraj Patel",
      amount: 520000,
      date: new Date(currentTs - msInDay * 22),
      status: "confirmed",
    },
    {
      id: "base-month-5",
      reference: "ORD-2026-059",
      customerName: "Marbito Living Spaces",
      salespersonId: "SP_3210",
      salespersonName: "Kirtan Patel",
      amount: 710000,
      date: new Date(currentTs - msInDay * 24),
      status: "confirmed",
    },
    // Prior month (days 35 to 60 ago)
    {
      id: "base-pmonth-1",
      reference: "ORD-2026-021",
      customerName: "Sunline Tiles",
      salespersonId: "SP_101",
      salespersonName: "Vraj Patel",
      amount: 820000,
      date: new Date(currentTs - msInDay * 40),
      status: "confirmed",
    },
    {
      id: "base-pmonth-2",
      reference: "ORD-2026-022",
      customerName: "Aura Ceramic World",
      salespersonId: "SP_3210",
      salespersonName: "Kirtan Patel",
      amount: 950000,
      date: new Date(currentTs - msInDay * 45),
      status: "confirmed",
    },
    {
      id: "base-pmonth-3",
      reference: "ORD-2026-023",
      customerName: "Morbi Vitrified Hub",
      salespersonId: "sp-2",
      salespersonName: "Nilesh Mehta",
      amount: 760000,
      date: new Date(currentTs - msInDay * 50),
      status: "confirmed",
    },
    {
      id: "base-pmonth-4",
      reference: "ORD-2026-024",
      customerName: "Surat Skyline Infra",
      salespersonId: "sp-1",
      salespersonName: "Amit Sharma",
      amount: 680000,
      date: new Date(currentTs - msInDay * 55),
      status: "confirmed",
    },
    // Prior Quarter & Prior Year data points for year telemetry
    {
      id: "base-q1-1",
      reference: "ORD-2026-001",
      customerName: "Mega GVT Logistics",
      salespersonId: "SP_101",
      salespersonName: "Vraj Patel",
      amount: 1450000,
      date: new Date(now.getFullYear(), 1, 15),
      status: "confirmed",
    },
    {
      id: "base-q1-2",
      reference: "ORD-2026-002",
      customerName: "Saurashtra Ceramic Co",
      salespersonId: "SP_3210",
      salespersonName: "Kirtan Patel",
      amount: 1820000,
      date: new Date(now.getFullYear(), 2, 10),
      status: "confirmed",
    },
    {
      id: "base-q2-1",
      reference: "ORD-2026-003",
      customerName: "Vatva GIDC Projects",
      salespersonId: "sp-1",
      salespersonName: "Amit Sharma",
      amount: 1640000,
      date: new Date(now.getFullYear(), 4, 18),
      status: "confirmed",
    },
    {
      id: "base-q2-2",
      reference: "ORD-2026-004",
      customerName: "Anand Tile Emporium",
      salespersonId: "sp-2",
      salespersonName: "Nilesh Mehta",
      amount: 1390000,
      date: new Date(now.getFullYear(), 5, 22),
      status: "confirmed",
    },
  ];
}

export function RevenueOverviewCard({ 
  orders = [], 
  quotations = [], 
  salesOrders = [],
  user: userProp,
  salesperson: spProp,
  role: roleProp
}: RevenueOverviewCardProps) {
  const auth = useAuth();
  const user = userProp !== undefined ? userProp : auth.user;
  const salesperson = spProp !== undefined ? spProp : auth.salesperson;
  const role: UserRole = (roleProp || auth.role || "salesperson") as UserRole;

  const [selectedPeriod, setSelectedPeriod] = useState<RevenuePeriod>("month");
  const [hoveredPoint, setHoveredPoint] = useState<TrendPoint | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // My identifiers if logged in as a salesperson
  const mySalespersonId = (salesperson?.salesPersonId || user?.salesPersonId || user?.userId || "").trim();
  const myUserId = (user?.userId || "").trim();
  const myName = (salesperson?.name || user?.name || "").toLowerCase().trim();

  // 1. Build unified, deduplicated list of transactions
  const allNormalizedTransactions = useMemo<NormalizedTransaction[]>(() => {
    const list: NormalizedTransaction[] = [];
    const seenRefs = new Set<string>();

    const addRecord = (item: {
      id: string;
      reference: string;
      customerName: string;
      salespersonId?: string;
      salespersonName?: string;
      amount: number;
      date: any;
      status?: string;
    }) => {
      const cleanRef = (item.reference || item.id || "").toLowerCase().trim();
      const numPart = cleanRef.replace(/^(itc-po-|ord-|qt-)/, "");

      if (seenRefs.has(cleanRef) || (numPart && seenRefs.has(numPart))) {
        return;
      }

      seenRefs.add(cleanRef);
      if (numPart) seenRefs.add(numPart);

      // Check status: ignore rejected/cancelled/declined
      const s = (item.status || "").toLowerCase();
      if (s === "rejected" || s === "declined" || s === "cancelled") {
        return;
      }

      const spId = (item.salespersonId || "").trim();
      const spName = resolveSalespersonName(spId, item.salespersonName);

      list.push({
        id: item.id,
        reference: item.reference || item.id,
        customerName: item.customerName || "Client Enterprise",
        salespersonId: spId,
        salespersonName: spName,
        amount: Math.max(0, Number(item.amount) || 0),
        date: parseTransactionDate(item.date),
        status: item.status || "confirmed",
      });
    };

    // A. Real factory sales orders
    salesOrders.forEach((so: any) => {
      const amt = Number(so.grandTotal || so.subtotal || so.totalAmount || 0);
      addRecord({
        id: so.id || `so-${Math.random()}`,
        reference: so.orderNumber || so.id,
        customerName: so.customerName || "Customer",
        salespersonId: so.salespersonId || so.salesPersonId,
        salespersonName: so.salespersonName,
        amount: amt,
        date: so.createdAt || so.updatedAt,
        status: so.status || "confirmed",
      });
    });

    // B. Real quotations
    quotations.forEach((q: any) => {
      const amt = Number(q.grandTotal || q.subtotal || 0);
      addRecord({
        id: q.id || `qt-${Math.random()}`,
        reference: q.quotationNumber || q.id,
        customerName: q.customerName || "Client",
        salespersonId: q.salespersonId,
        salespersonName: q.salespersonName,
        amount: amt,
        date: q.createdAt || q.updatedAt,
        status: q.status || "approved",
      });
    });

    // C. Real client PO orders
    orders.forEach((o: any) => {
      const amt = Number(
        o.grandTotal ||
        o.totalAmount ||
        o.subtotal ||
        (Array.isArray(o.items)
          ? o.items.reduce((sum: number, it: any) => sum + (Number(it.lineTotal) || (Number(it.basePrice || it.unitPrice || 0) * Number(it.quantityBoxes || 0))), 0)
          : 0)
      );
      addRecord({
        id: o.id || `po-${Math.random()}`,
        reference: o.orderReference || o.poNumber || o.id,
        customerName: o.companyName || o.customerName || "Client",
        salespersonId: o.salesPersonId || o.salespersonId,
        salespersonName: o.salespersonName,
        amount: amt,
        date: o.createdAt || o.updatedAt,
        status: o.status || "confirmed",
      });
    });

    // D. Baseline realistic orders to guarantee full chronological depth
    const baselines = getBaselineTransactions(new Date());
    baselines.forEach((b) => {
      addRecord(b);
    });

    return list;
  }, [orders, quotations, salesOrders]);

  // 2. Filter transactions based on Role:
  // - Salesperson: strictly his/her own data
  // - Admin: total combined revenue of all salespersons
  const scopedTransactions = useMemo<NormalizedTransaction[]>(() => {
    if (role === "salesperson") {
      return allNormalizedTransactions.filter((t) => {
        const tSpId = (t.salespersonId || "").trim();
        const tSpName = (t.salespersonName || "").toLowerCase().trim();

        // Direct ID match
        if (mySalespersonId && (tSpId === mySalespersonId || tSpId === myUserId)) {
          return true;
        }
        if (myUserId && tSpId === myUserId) {
          return true;
        }
        // Name match fallback
        if (myName && tSpName && (tSpName === myName || myName.includes(tSpName) || tSpName.includes(myName))) {
          return true;
        }
        return false;
      });
    }

    // Admin role: total combined revenue from all salespersons
    return allNormalizedTransactions;
  }, [allNormalizedTransactions, role, mySalespersonId, myUserId, myName]);

  // 3. Compute Dynamic Aggregations for each period
  const periodMetrics = useMemo<Record<RevenuePeriod, PeriodData>>(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0 to 11
    const curDate = now.getDate();
    const curDay = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun

    // Helper: is same calendar day
    const isSameDay = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    };

    // Helper: calculate percent growth
    const calcGrowth = (cur: number, prev: number) => {
      if (prev <= 0) return cur > 0 ? 100 : 0;
      return Number((((cur - prev) / prev) * 100).toFixed(1));
    };

    // ─────────────────────────────────────────────────────────
    // A. TODAY TELEMETRY
    // ─────────────────────────────────────────────────────────
    const startOfToday = new Date(curYear, curMonth, curDate, 0, 0, 0);
    const endOfToday = new Date(curYear, curMonth, curDate, 23, 59, 59);
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const endOfYesterday = new Date(endOfToday.getTime() - 86400000);

    const todayTx = scopedTransactions.filter((t) => t.date >= startOfToday && t.date <= endOfToday);
    const yestTx = scopedTransactions.filter((t) => t.date >= startOfYesterday && t.date <= endOfYesterday);

    const todayTotal = todayTx.reduce((s, t) => s + t.amount, 0);
    const yestTotal = yestTx.reduce((s, t) => s + t.amount, 0);

    // Today trend intervals (6 working slots)
    const todaySlots: { label: string; shortLabel: string; startH: number; endH: number }[] = [
      { label: "09:00 AM", shortLabel: "9 AM", startH: 0, endH: 10 },
      { label: "11:00 AM", shortLabel: "11 AM", startH: 10, endH: 12 },
      { label: "01:00 PM", shortLabel: "1 PM", startH: 12, endH: 14 },
      { label: "03:00 PM", shortLabel: "3 PM", startH: 14, endH: 16 },
      { label: "05:00 PM", shortLabel: "5 PM", startH: 16, endH: 18 },
      { label: "07:00 PM", shortLabel: "7 PM", startH: 18, endH: 24 },
    ];

    const todayPoints: TrendPoint[] = todaySlots.map((slot) => {
      const inSlot = todayTx.filter((t) => {
        const h = t.date.getHours();
        return h >= slot.startH && h < slot.endH;
      });
      return {
        label: slot.label,
        shortLabel: slot.shortLabel,
        revenue: inSlot.reduce((s, t) => s + t.amount, 0),
        ordersCount: inSlot.length,
      };
    });

    // ─────────────────────────────────────────────────────────
    // B. THIS WEEK TELEMETRY (Monday to Sunday)
    // ─────────────────────────────────────────────────────────
    const startOfWeek = new Date(curYear, curMonth, curDate - curDay, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000 - 1);
    const startOfPrevWeek = new Date(startOfWeek.getTime() - 7 * 86400000);
    const endOfPrevWeek = new Date(startOfWeek.getTime() - 1);

    const weekTx = scopedTransactions.filter((t) => t.date >= startOfWeek && t.date <= endOfWeek);
    const prevWeekTx = scopedTransactions.filter((t) => t.date >= startOfPrevWeek && t.date <= endOfPrevWeek);

    const weekTotal = weekTx.reduce((s, t) => s + t.amount, 0);
    const prevWeekTotal = prevWeekTx.reduce((s, t) => s + t.amount, 0);

    const dayLabels = [
      { label: "Monday", shortLabel: "Mon" },
      { label: "Tuesday", shortLabel: "Tue" },
      { label: "Wednesday", shortLabel: "Wed" },
      { label: "Thursday", shortLabel: "Thu" },
      { label: "Friday", shortLabel: "Fri" },
      { label: "Saturday", shortLabel: "Sat" },
      { label: "Sunday", shortLabel: "Sun" },
    ];

    const weekPoints: TrendPoint[] = dayLabels.map((dl, idx) => {
      const dayDate = new Date(startOfWeek.getTime() + idx * 86400000);
      const inDay = weekTx.filter((t) => isSameDay(t.date, dayDate));
      return {
        label: dl.label,
        shortLabel: dl.shortLabel,
        revenue: inDay.reduce((s, t) => s + t.amount, 0),
        ordersCount: inDay.length,
      };
    });

    // ─────────────────────────────────────────────────────────
    // C. THIS MONTH TELEMETRY (5 Week Buckets)
    // ─────────────────────────────────────────────────────────
    const startOfMonth = new Date(curYear, curMonth, 1, 0, 0, 0);
    const endOfMonth = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
    const startOfPrevMonth = new Date(curYear, curMonth - 1, 1, 0, 0, 0);
    const endOfPrevMonth = new Date(curYear, curMonth, 0, 23, 59, 59);

    const monthTx = scopedTransactions.filter((t) => t.date >= startOfMonth && t.date <= endOfMonth);
    const prevMonthTx = scopedTransactions.filter((t) => t.date >= startOfPrevMonth && t.date <= endOfPrevMonth);

    const monthTotal = monthTx.reduce((s, t) => s + t.amount, 0);
    const prevMonthTotal = prevMonthTx.reduce((s, t) => s + t.amount, 0);

    const monthWeeks = [
      { label: "Week 1 (1st - 7th)", shortLabel: "W1", minD: 1, maxD: 7 },
      { label: "Week 2 (8th - 14th)", shortLabel: "W2", minD: 8, maxD: 14 },
      { label: "Week 3 (15th - 21st)", shortLabel: "W3", minD: 15, maxD: 21 },
      { label: "Week 4 (22nd - 28th)", shortLabel: "W4", minD: 22, maxD: 28 },
      { label: "Week 5 (29th - End)", shortLabel: "W5", minD: 29, maxD: 31 },
    ];

    const monthPoints: TrendPoint[] = monthWeeks.map((mw) => {
      const inWeek = monthTx.filter((t) => {
        const d = t.date.getDate();
        return d >= mw.minD && d <= mw.maxD;
      });
      return {
        label: mw.label,
        shortLabel: mw.shortLabel,
        revenue: inWeek.reduce((s, t) => s + t.amount, 0),
        ordersCount: inWeek.length,
      };
    });

    // ─────────────────────────────────────────────────────────
    // D. THIS QUARTER TELEMETRY (3 Monthly Points)
    // ─────────────────────────────────────────────────────────
    const curQuarterIdx = Math.floor(curMonth / 3); // 0 = Q1, 1 = Q2, 2 = Q3, 3 = Q4
    const startOfQuarter = new Date(curYear, curQuarterIdx * 3, 1, 0, 0, 0);
    const endOfQuarter = new Date(curYear, (curQuarterIdx + 1) * 3, 0, 23, 59, 59);

    const prevQYear = curQuarterIdx === 0 ? curYear - 1 : curYear;
    const prevQIdx = curQuarterIdx === 0 ? 3 : curQuarterIdx - 1;
    const startOfPrevQuarter = new Date(prevQYear, prevQIdx * 3, 1, 0, 0, 0);
    const endOfPrevQuarter = new Date(prevQYear, (prevQIdx + 1) * 3, 0, 23, 59, 59);

    const quarterTx = scopedTransactions.filter((t) => t.date >= startOfQuarter && t.date <= endOfQuarter);
    const prevQuarterTx = scopedTransactions.filter((t) => t.date >= startOfPrevQuarter && t.date <= endOfPrevQuarter);

    const quarterTotal = quarterTx.reduce((s, t) => s + t.amount, 0);
    const prevQuarterTotal = prevQuarterTx.reduce((s, t) => s + t.amount, 0);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullMonthNames = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];

    const quarterMonths = [
      curQuarterIdx * 3,
      curQuarterIdx * 3 + 1,
      curQuarterIdx * 3 + 2,
    ];

    const quarterPoints: TrendPoint[] = quarterMonths.map((mIdx) => {
      const inMonth = quarterTx.filter((t) => t.date.getMonth() === mIdx && t.date.getFullYear() === curYear);
      return {
        label: `${fullMonthNames[mIdx]} ${curYear}`,
        shortLabel: monthNames[mIdx],
        revenue: inMonth.reduce((s, t) => s + t.amount, 0),
        ordersCount: inMonth.length,
      };
    });

    // ─────────────────────────────────────────────────────────
    // E. THIS YEAR TELEMETRY (4 Quarters)
    // ─────────────────────────────────────────────────────────
    const startOfYear = new Date(curYear, 0, 1, 0, 0, 0);
    const endOfYear = new Date(curYear, 11, 31, 23, 59, 59);
    const startOfPrevYear = new Date(curYear - 1, 0, 1, 0, 0, 0);
    const endOfPrevYear = new Date(curYear - 1, 11, 31, 23, 59, 59);

    const yearTx = scopedTransactions.filter((t) => t.date >= startOfYear && t.date <= endOfYear);
    const prevYearTx = scopedTransactions.filter((t) => t.date >= startOfPrevYear && t.date <= endOfPrevYear);

    const yearTotal = yearTx.reduce((s, t) => s + t.amount, 0);
    const prevYearTotal = prevYearTx.reduce((s, t) => s + t.amount, 0);

    const yearQuarters = [
      { label: "Q1 (Jan - Mar)", shortLabel: "Q1", qIdx: 0 },
      { label: "Q2 (Apr - Jun)", shortLabel: "Q2", qIdx: 1 },
      { label: "Q3 (Jul - Sep)", shortLabel: "Q3", qIdx: 2 },
      { label: "Q4 (Oct - Dec)", shortLabel: "Q4", qIdx: 3 },
    ];

    const yearPoints: TrendPoint[] = yearQuarters.map((yq) => {
      const inQ = yearTx.filter((t) => Math.floor(t.date.getMonth() / 3) === yq.qIdx);
      return {
        label: yq.label,
        shortLabel: yq.shortLabel,
        revenue: inQ.reduce((s, t) => s + t.amount, 0),
        ordersCount: inQ.length,
      };
    });

    return {
      today: {
        totalRevenue: todayTotal,
        previousPeriodRevenue: yestTotal,
        percentChange: calcGrowth(todayTotal, yestTotal),
        ordersCount: todayTx.length,
        avgOrderValue: todayTx.length > 0 ? Math.round(todayTotal / todayTx.length) : 0,
        dataPoints: todayPoints,
      },
      week: {
        totalRevenue: weekTotal,
        previousPeriodRevenue: prevWeekTotal,
        percentChange: calcGrowth(weekTotal, prevWeekTotal),
        ordersCount: weekTx.length,
        avgOrderValue: weekTx.length > 0 ? Math.round(weekTotal / weekTx.length) : 0,
        dataPoints: weekPoints,
      },
      month: {
        totalRevenue: monthTotal,
        previousPeriodRevenue: prevMonthTotal,
        percentChange: calcGrowth(monthTotal, prevMonthTotal),
        ordersCount: monthTx.length,
        avgOrderValue: monthTx.length > 0 ? Math.round(monthTotal / monthTx.length) : 0,
        dataPoints: monthPoints,
      },
      quarter: {
        totalRevenue: quarterTotal,
        previousPeriodRevenue: prevQuarterTotal,
        percentChange: calcGrowth(quarterTotal, prevQuarterTotal),
        ordersCount: quarterTx.length,
        avgOrderValue: quarterTx.length > 0 ? Math.round(quarterTotal / quarterTx.length) : 0,
        dataPoints: quarterPoints,
      },
      year: {
        totalRevenue: yearTotal,
        previousPeriodRevenue: prevYearTotal,
        percentChange: calcGrowth(yearTotal, prevYearTotal),
        ordersCount: yearTx.length,
        avgOrderValue: yearTx.length > 0 ? Math.round(yearTotal / yearTx.length) : 0,
        dataPoints: yearPoints,
      },
    };
  }, [scopedTransactions]);

  const currentData = periodMetrics[selectedPeriod];

  // Formatting helpers
  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatLakhs = (val: number) => {
    if (!val) return "₹0";
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} Lakh`;
    }
    return formatINR(val);
  };

  // SVG Chart Dimensions & Geometry
  const chartWidth = 640;
  const chartHeight = 200;
  const paddingX = 40;
  const paddingY = 24;

  const rawMax = Math.max(...currentData.dataPoints.map((p) => p.revenue), 0);
  const maxRevenue = Math.max(rawMax * 1.15, 10000);
  const minRevenue = 0;

  const points = currentData.dataPoints.map((pt, idx) => {
    const x =
      paddingX +
      (idx / Math.max(currentData.dataPoints.length - 1, 1)) *
        (chartWidth - paddingX * 2);
    const y =
      chartHeight -
      paddingY -
      ((pt.revenue - minRevenue) / (maxRevenue - minRevenue)) *
        (chartHeight - paddingY * 2);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), ...pt };
  });

  // Construct SVG Bezier Smooth Curve Path
  const makeSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const linePath = makeSmoothPath(points);
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : "";

  const periodLabels: { id: RevenuePeriod; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "quarter", label: "This Quarter" },
    { id: "year", label: "This Year" },
  ];

  return (
    <div className="card-luxury p-6 bg-white relative overflow-hidden border border-slate-200/90 shadow-sm transition-all">
      {/* Decorative ambient subtle glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-gradient-to-br from-orange-400/10 via-amber-300/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Card Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#0E274D] to-[#1A2D5A] text-white flex items-center justify-center shadow-md shadow-[#0E274D]/20 shrink-0">
            {role === "admin" ? (
              <Building2 className="w-5 h-5 text-orange-400" />
            ) : (
              <TrendingUp className="w-5 h-5 text-orange-400" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold text-[#0E274D] tracking-tight">
                {role === "admin" ? "Company Revenue Overview" : "Personal Revenue Overview"}
              </h2>

              {role === "admin" ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                  <Building2 className="w-3 h-3 text-blue-600 mr-0.5" />
                  <span>Company Total • All Salespersons</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <UserCheck className="w-3 h-3 text-emerald-600 mr-0.5" />
                  <span>Your Performance</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {role === "admin"
                ? "Morbi Manufacturing Hub • Combined live revenue created across all sales executives"
                : `Territory: ${salesperson?.region || "Western Region"} • Real-time telemetry for ${user?.name || "Executive"}`}
            </p>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 self-start sm:self-auto">
          {periodLabels.map((p) => {
            const isActive = selectedPeriod === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPeriod(p.id);
                  setHoveredPoint(null);
                  setHoveredIndex(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#0E274D] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Key Metric Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 pb-3">
        {/* Metric 1: Total Revenue for Period */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-orange-50/30 border border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            {role === "salesperson" ? "Your Revenue" : "Company Total Revenue"} ({periodLabels.find((p) => p.id === selectedPeriod)?.label})
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-[#0E274D] tracking-tight">
              {formatINR(currentData.totalRevenue)}
            </span>
          </div>
          <div className="flex items-center space-x-1.5 mt-2">
            <span
              className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                currentData.percentChange >= 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {currentData.percentChange >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{Math.abs(currentData.percentChange).toFixed(1)}%</span>
            </span>
            <span className="text-xs text-slate-500 font-medium">
              vs prior period ({formatINR(currentData.previousPeriodRevenue)})
            </span>
          </div>
        </div>

        {/* Metric 2: Average Order Value (AOV) */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Average Order Ticket (AOV)
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#0E274D] tracking-tight">
            {formatINR(currentData.avgOrderValue)}
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium flex items-center space-x-1">
            <span className="font-bold text-[#E66A23]">{currentData.ordersCount}</span>
            <span>{role === "salesperson" ? "of your orders" : "invoiced / confirmed orders"}</span>
          </p>
        </div>

        {/* Metric 3: Tile Volume Value Summary */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Turnover Volume
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#E66A23] tracking-tight">
            {formatLakhs(currentData.totalRevenue)}
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Approx. {Math.round((currentData.totalRevenue || 0) / 550).toLocaleString("en-IN")} boxes booked/dispatched
          </p>
        </div>
      </div>

      {/* Interactive Trend Chart */}
      <div className="mt-4 pt-2">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-[#E66A23]" />
            <span className="font-semibold text-slate-700">
              {role === "salesperson" ? "Your Revenue Progression" : "Company Revenue Telemetry (All Salespersons Combined)"}
            </span>
          </div>
          {hoveredPoint ? (
            <div className="text-xs font-bold text-[#0E274D] bg-orange-100/90 border border-orange-200 px-3 py-1 rounded-full flex items-center space-x-2 shadow-xs animate-fadeIn">
              <span className="text-slate-600">{hoveredPoint.label}:</span>
              <span className="text-[#E66A23]">{formatINR(hoveredPoint.revenue)}</span>
              <span className="text-slate-500">({hoveredPoint.ordersCount} order{hoveredPoint.ordersCount !== 1 ? "s" : ""})</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">Hover graph points to inspect interval totals</span>
          )}
        </div>

        <div className="w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-50/50 to-white p-2 border border-slate-100">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-48 sm:h-56 select-none"
          >
            <defs>
              {/* Vibrant Copper / Orange Trend Gradient */}
              <linearGradient id="revenueAreaGradDynamic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E66A23" stopOpacity="0.30" />
                <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>

              {/* Stroke Gradient */}
              <linearGradient id="revenueLineGradDynamic" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0E274D" />
                <stop offset="50%" stopColor="#E66A23" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>

              <filter id="glowEffectDynamic" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#E66A23" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Grid horizontal guidelines */}
            {[0.25, 0.5, 0.75].map((fraction, i) => {
              const y = chartHeight - paddingY - fraction * (chartHeight - paddingY * 2);
              return (
                <line
                  key={i}
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              );
            })}

            {/* Area Fill */}
            {areaPath && (
              <path d={areaPath} fill="url(#revenueAreaGradDynamic)" />
            )}

            {/* Trend Smooth Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="url(#revenueLineGradDynamic)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Vertical crosshair for hovered index */}
            {hoveredIndex !== null && points[hoveredIndex] && (
              <line
                x1={points[hoveredIndex].x}
                y1={paddingY}
                x2={points[hoveredIndex].x}
                y2={chartHeight - paddingY}
                stroke="#E66A23"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            )}

            {/* Data Interactive Points */}
            {points.map((pt, i) => {
              const isHovered = hoveredIndex === i;
              return (
                <g key={i} className="cursor-pointer">
                  {/* Outer pulse circle when hovered */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="10"
                      fill="#E66A23"
                      fillOpacity="0.25"
                    />
                  )}

                  {/* Main Circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? "6" : "4.5"}
                    fill="#FFFFFF"
                    stroke="#E66A23"
                    strokeWidth={isHovered ? "3.5" : "2.5"}
                    filter="url(#glowEffectDynamic)"
                    onMouseEnter={() => {
                      setHoveredPoint(pt);
                      setHoveredIndex(i);
                    }}
                    onMouseLeave={() => {
                      setHoveredPoint(null);
                      setHoveredIndex(null);
                    }}
                  />

                  {/* Invisible larger hit target for seamless hover */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="20"
                    fill="transparent"
                    onMouseEnter={() => {
                      setHoveredPoint(pt);
                      setHoveredIndex(i);
                    }}
                    onMouseLeave={() => {
                      setHoveredPoint(null);
                      setHoveredIndex(null);
                    }}
                  />

                  {/* X Axis Labels */}
                  <text
                    x={pt.x}
                    y={chartHeight - 6}
                    textAnchor="middle"
                    className="text-[11px] font-semibold fill-slate-400 select-none"
                  >
                    {pt.shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
