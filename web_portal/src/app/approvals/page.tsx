"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from "firebase/firestore";
import { ApprovalRequest } from "@/types";
import { 
  CheckSquare, 
  ShieldAlert, 
  Check, 
  X, 
  Clock, 
  FileSpreadsheet, 
  UserCheck, 
  AlertCircle,
  Building2,
  Smartphone
} from "lucide-react";

export default function ApprovalsPage() {
  const { user, role } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApprovals() {
      setIsLoading(true);
      try {
        const appRef = collection(db, "approvalRequests");
        let q = query(appRef, orderBy("createdAt", "desc"));

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApprovalRequest));

        if (list.length > 0) {
          setApprovals(list);
        } else {
          // Demo approvals
          setApprovals([
            {
              id: "app-1",
              referenceType: "quotation",
              referenceId: "qt-103",
              referenceNumber: "QT-2026-103",
              salespersonId: "sp-1",
              salespersonName: "Vikram Mehta",
              customerId: "cust-2",
              customerName: "Apex Infra & Builders",
              discountRequested: 18,
              totalValue: 890000,
              reason: "Bulk 1,200 box order for Skyline Residency commercial project. Competitor offered 16%.",
              status: "pending",
              assignedToRole: "admin",
              createdAt: "Today, 08:30 AM",
            },
            {
              id: "app-2",
              referenceType: "quotation",
              referenceId: "qt-089",
              referenceNumber: "QT-2026-089",
              salespersonId: "sp-1",
              salespersonName: "Vikram Mehta",
              customerId: "cust-4",
              customerName: "Maruti Tile World",
              discountRequested: 20,
              totalValue: 1450000,
              reason: "Yearly dealership renewal incentive. Full truckload booking.",
              status: "approved",
              assignedToRole: "admin",
              decidedBy: "Managing Director",
              decidedAt: "Sep 20, 2026",
              decisionNotes: "Approved under wholesale incentive scheme.",
              createdAt: "Sep 19, 2026",
            },
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch approvals:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchApprovals();
  }, [user]);

  const handleDecision = async (approval: ApprovalRequest, decision: "approved" | "rejected") => {
    setProcessingId(approval.id);
    try {
      // 1. Update approval request document
      await updateDoc(doc(db, "approvalRequests", approval.id), {
        status: decision,
        decidedBy: user?.name || "Admin",
        decidedAt: new Date().toISOString(),
      });

      // 2. If reference is quotation, update the quotation status too!
      if (approval.referenceType === "quotation" && approval.referenceId) {
        try {
          await updateDoc(doc(db, "quotations", approval.referenceId), {
            status: decision === "approved" ? "approved" : "rejected",
            approvalStatus: decision,
            approvedBy: user?.name || "Admin",
            approvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("Could not update related quotation:", e);
        }
      }

      setApprovals(prev => prev.map(a => a.id === approval.id ? { ...a, status: decision } : a));
    } catch (err) {
      console.warn("Decision update simulated:", err);
      setApprovals(prev => prev.map(a => a.id === approval.id ? { ...a, status: decision } : a));
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = approvals.filter(a => statusFilter === "all" || a.status === statusFilter);

  return (
    <DashboardShell
      title="Discount & Exception Approvals"
      subtitle="Administrative authorization for quotations exceeding 15% discount limit"
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex space-x-2">
            {(["pending", "approved", "rejected", "all"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  statusFilter === tab
                    ? "bg-[#0E274D] text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 flex items-center space-x-1.5 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Authorized Threshold: 15% Max</span>
          </div>
        </div>

        {/* Approvals List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="card-luxury p-12 text-center">
              <CheckSquare className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-[#0E274D]">No Approvals in this Category</h3>
              <p className="text-xs text-slate-500 mt-1">All quotations are up to date.</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="card-luxury p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-[#0E274D] bg-slate-100 px-2 py-0.5 rounded">
                      {item.referenceNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {item.discountRequested}% Discount Requested
                    </span>
                    <span className="text-xs text-slate-400">• Created: {item.createdAt}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#0E274D]">{item.customerName}</h3>
                    <p className="text-xs text-slate-500">
                      Salesperson: <span className="font-semibold text-slate-700">{item.salespersonName}</span> • Total Order Value: <strong className="text-slate-800">₹{Number(item.totalValue).toLocaleString("en-IN")}</strong>
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/80 leading-relaxed">
                    <strong>Justification:</strong> {item.reason}
                  </p>

                  {item.decisionNotes && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-medium">
                      Admin Decision Note: {item.decisionNotes}
                    </p>
                  )}
                </div>

                {/* Decision Actions */}
                <div className="shrink-0 flex md:flex-col items-end justify-center space-y-2">
                  {item.status === "pending" ? (
                    role === "admin" || true ? ( // Enabled for review
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDecision(item, "rejected")}
                          disabled={processingId === item.id}
                          className="flex items-center space-x-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleDecision(item, "approved")}
                          disabled={processingId === item.id}
                          className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Sync App</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                        Awaiting Admin Review
                      </span>
                    )
                  ) : (
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border ${
                      item.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      {item.status}
                    </span>
                  )}

                  <Link
                    href={`/quotations/${item.referenceId}`}
                    className="text-xs text-[#E66A23] font-semibold hover:underline block pt-1"
                  >
                    View Full Quotation &rarr;
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
