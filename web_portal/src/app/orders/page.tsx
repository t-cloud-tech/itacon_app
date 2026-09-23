"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from "firebase/firestore";
import { SalesOrder, OrderStatus } from "@/types";
import { 
  Truck, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  CreditCard,
  Building2,
  Eye,
  FileSpreadsheet
} from "lucide-react";

export default function SalesOrdersPage() {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      setIsLoading(true);
      try {
        const ref = collection(db, "salesOrders");
        let q = query(ref, orderBy("createdAt", "desc"));

        if (role === "salesperson" && user?.userId) {
          q = query(ref, where("salespersonId", "==", user.userId));
        }

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesOrder));

        if (list.length > 0) {
          setOrders(list);
        } else {
          // Demo realistic orders
          setOrders([
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
              shippingAddress: "Plot 14, GIDC Vatva Industrial Estate, Phase 2, Ahmedabad",
              paymentTerms: "30 Days Net",
              paymentStatus: "partial",
              advancePaid: 150000,
              dispatchDate: "2026-09-22",
              trackingNumber: "TRK-GT-9921 (Shreeji Logistics)",
              createdAt: "2026-09-21",
              updatedAt: "2026-09-22",
            },
            {
              id: "ord-2",
              orderNumber: "ORD-2026-054",
              quotationId: "qt-089",
              customerId: "cust-4",
              customerName: "Maruti Tile World",
              salespersonId: user?.userId || "sp-1",
              status: "in_production",
              items: [],
              subtotal: 1228800,
              taxAmount: 221200,
              grandTotal: 1450000,
              shippingAddress: "National Highway 8A, Morbi, Gujarat",
              paymentTerms: "45 Days",
              paymentStatus: "paid",
              advancePaid: 1450000,
              createdAt: "2026-09-18",
              updatedAt: "2026-09-20",
            },
            {
              id: "ord-3",
              orderNumber: "ORD-2026-053",
              customerId: "cust-2",
              customerName: "Apex Infra & Builders",
              salespersonId: user?.userId || "sp-1",
              status: "delivered",
              items: [],
              subtotal: 750000,
              taxAmount: 135000,
              grandTotal: 885000,
              shippingAddress: "Skyline Residency Project Site, Dumas Road, Surat",
              paymentTerms: "30 Days",
              paymentStatus: "paid",
              dispatchDate: "2026-09-10",
              trackingNumber: "TRK-BL-4410",
              createdAt: "2026-09-08",
              updatedAt: "2026-09-15",
            },
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch sales orders:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();
  }, [user, role]);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "delivered":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "dispatched":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "in_production":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "confirmed":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <DashboardShell
      title="Sales Orders"
      subtitle="Orders converted from accepted quotations, dispatch logistics, and tracking"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search order # or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
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
          </div>
        </div>

        {/* Orders Table */}
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
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <span className="font-bold text-[#0E274D] block">{ord.orderNumber}</span>
                      <span className="text-xs text-slate-400">Created: {ord.createdAt}</span>
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                        ord.paymentStatus === "paid"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : ord.paymentStatus === "partial"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {ord.paymentStatus}
                      </span>
                    </td>

                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getStatusBadge(ord.status)}`}>
                        {ord.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
