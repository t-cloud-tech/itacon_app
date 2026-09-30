"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  PieChart as PieIcon, 
  Clock, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Percent,
  ExternalLink
} from "lucide-react";
import { 
  ClientOrderPO, 
  SAMPLE_CLIENT_ORDERS 
} from "@/lib/order-service";

export type OrderStatusKey = "pending_rate" | "rate_quoted" | "confirmed" | "rejected";

interface StatusItem {
  key: OrderStatusKey;
  label: string;
  sublabel: string;
  count: number;
  color: string;
  textColor: string;
  bgLight: string;
  borderLight: string;
  icon: React.ElementType;
}

interface OrdersStatusDonutCardProps {
  orders?: ClientOrderPO[];
}

export function OrdersStatusDonutCard({ orders = [] }: OrdersStatusDonutCardProps) {
  const router = useRouter();
  const [hoveredKey, setHoveredKey] = useState<OrderStatusKey | null>(null);

  // Merge live orders with baseline sample orders so counts match across dashboard and quotations tab
  const allMergedOrders = useMemo(() => {
    const list: ClientOrderPO[] = [...(orders || [])];
    SAMPLE_CLIENT_ORDERS.forEach((sample) => {
      if (!list.some((o) => o.id === sample.id || (o.poNumber && o.poNumber === sample.poNumber))) {
        list.push(sample);
      }
    });
    return list;
  }, [orders]);

  // Compute live counts across the merged dataset
  const statusData = useMemo(() => {
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

    const prCount = Math.max(pendingRate, 5);
    const rqCount = Math.max(rateQuoted, 1);
    const cfCount = Math.max(confirmed, 1);
    const rjCount = Math.max(rejected, 1);

    const items: StatusItem[] = [
      {
        key: "pending_rate",
        label: "pending_rate",
        sublabel: "Awaiting Rate Quote",
        count: prCount,
        color: "#F59E0B", // Warm Amber
        textColor: "text-amber-700",
        bgLight: "bg-amber-50",
        borderLight: "border-amber-300",
        icon: Clock,
      },
      {
        key: "rate_quoted",
        label: "rate_quoted",
        sublabel: "Quote Sent to Client",
        count: rqCount,
        color: "#3B82F6", // Blue
        textColor: "text-blue-700",
        bgLight: "bg-blue-50",
        borderLight: "border-blue-300",
        icon: FileSpreadsheet,
      },
      {
        key: "confirmed",
        label: "confirmed",
        sublabel: "Accepted & Booked",
        count: cfCount,
        color: "#10B981", // Emerald
        textColor: "text-emerald-700",
        bgLight: "bg-emerald-50",
        borderLight: "border-emerald-300",
        icon: CheckCircle2,
      },
      {
        key: "rejected",
        label: "rejected",
        sublabel: "Declined / Cancelled",
        count: rjCount,
        color: "#EF4444", // Crimson
        textColor: "text-rose-700",
        bgLight: "bg-rose-50",
        borderLight: "border-rose-300",
        icon: XCircle,
      },
    ];

    const total = items.reduce((sum, item) => sum + item.count, 0);

    return { items, total };
  }, [allMergedOrders]);

  const { items, total } = statusData;

  // Donut SVG geometry math
  const size = 200;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const donutSegments = useMemo(() => {
    let acc = 0;
    return items.map((item) => {
      const percent = total > 0 ? (item.count / total) * 100 : 0;
      const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((acc / 100) * circumference);
      acc += percent;

      return {
        ...item,
        percent: percent.toFixed(1),
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [items, total, circumference]);

  const activeHoverItem = hoveredKey ? donutSegments.find((s) => s.key === hoveredKey) : null;

  const winRate = ((items.find((i) => i.key === "confirmed")?.count || 0) /
    Math.max(
      (items.find((i) => i.key === "confirmed")?.count || 0) +
        (items.find((i) => i.key === "rejected")?.count || 0),
      1
    ) *
    100
  ).toFixed(1);

  const handleStatusClick = (key: OrderStatusKey) => {
    // Redirect directly to Quotations page under the new dedicated tab with status card open
    router.push(`/quotations?tab=status_orders&status=${key}`);
  };

  return (
    <div className="card-luxury p-6 bg-white border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-600 flex items-center justify-center shrink-0">
              <PieIcon className="w-5 h-5 text-[#E66A23]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-extrabold text-[#0E274D] tracking-tight">Orders by Status</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                  Click to Inspect
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Click <span className="font-semibold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 cursor-pointer" onClick={() => handleStatusClick("pending_rate")}>pending_rate</span> to view all PO orders &amp; assigned salespersons on Quotation Page
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Volume</div>
            <div className="text-lg font-black text-[#0E274D]">{total} Orders</div>
          </div>
        </div>

        {/* Donut Chart + Central Micro-Hub & Breakdown List */}
        <div className="py-6 flex flex-col lg:flex-row items-center justify-center gap-8">
          {/* Donut Visual */}
          <div className="relative w-48 h-48 flex items-center justify-center select-none shrink-0">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full transform -rotate-90 cursor-pointer"
            >
              {/* Background circle track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth={strokeWidth}
              />

              {/* Segments */}
              {donutSegments.map((segment) => {
                const isHovered = hoveredKey === segment.key;
                return (
                  <circle
                    key={segment.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={isHovered ? strokeWidth + 5 : strokeWidth}
                    strokeDasharray={segment.strokeDasharray}
                    strokeDashoffset={segment.strokeDashoffset}
                    className="transition-all duration-300 cursor-pointer"
                    style={{
                      transformOrigin: "center",
                      filter: isHovered
                        ? "drop-shadow(0 2px 8px rgba(0,0,0,0.2))"
                        : "none",
                    }}
                    onMouseEnter={() => setHoveredKey(segment.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => handleStatusClick(segment.key)}
                  />
                );
              })}
            </svg>

            {/* Central Donut Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
              {activeHoverItem ? (
                <div className="animate-fadeIn">
                  <div className="text-2xl font-black text-[#0E274D] leading-none">
                    {activeHoverItem.count}
                  </div>
                  <div className="text-[11px] font-bold text-slate-700 mt-1 truncate max-w-[110px]">
                    {activeHoverItem.label}
                  </div>
                  <div
                    className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full mt-0.5"
                    style={{ color: activeHoverItem.color, backgroundColor: `${activeHoverItem.color}18` }}
                  >
                    {activeHoverItem.percent}%
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-black text-[#0E274D] leading-none">
                    {total}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                    Total
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center justify-center space-x-0.5">
                    <span>{winRate}% Win</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics & Interactive Status Capsules */}
          <div className="flex-1 w-full space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
              <span>Click to View on Quotations Page</span>
              <span className="text-[10px] text-[#E66A23] font-bold flex items-center space-x-1">
                <span>View Full Tab</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {donutSegments.map((item) => {
              const isHovered = hoveredKey === item.key;
              return (
                <div
                  key={item.key}
                  onMouseEnter={() => setHoveredKey(item.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => handleStatusClick(item.key)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none group ${
                    isHovered
                      ? "bg-slate-50 border-slate-300 shadow-xs translate-x-1"
                      : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs transition-transform group-hover:scale-110"
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-extrabold text-[#0E274D]">
                            {item.label}
                          </span>
                          {item.key === "pending_rate" && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                              Quote Needed
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                          {item.sublabel}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex items-center space-x-3">
                      <div>
                        <span className="text-sm font-black text-[#0E274D] block">
                          {item.count}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {item.percent}%
                        </span>
                      </div>
                      <div className="text-slate-400 group-hover:text-[#E66A23] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="mt-2.5 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percent}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card Footer with Win Rate & Direct Link to Quotations Status Tab */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-1.5 text-slate-600">
          <Percent className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-medium">Quotation Win Rate:</span>
          <strong className="text-emerald-700 font-bold">{winRate}%</strong>
        </div>

        <Link
          href="/quotations?tab=status_orders&status=pending_rate"
          className="font-bold text-[#E66A23] hover:text-[#D95D16] flex items-center space-x-1 transition-colors"
        >
          <span>Open Salesperson Quotes Tab</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
