"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Save, Target, AlertCircle } from "lucide-react";
import { OpportunityStage, Customer } from "@/types";

export default function NewOpportunityPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [probability, setProbability] = useState("70");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [stage, setStage] = useState<OpportunityStage>("requirement");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const snap = await getDocs(collection(db, "customers"));
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        if (list.length > 0) {
          setCustomers(list);
          setSelectedCustomerId(list[0].id);
        } else {
          // Defaults
          const defaults: Customer[] = [
            { id: "c1", customerNumber: "CUST-01", name: "Pravin Shah", companyName: "Gujarat Ceramics", phone: "9825099881", email: "", city: "Ahmedabad", state: "Gujarat", category: "Dealer", priceTier: "A", creditLimit: 1000000, paymentTerms: "30 Days", assignedSalespersonId: "sp-1", status: "active", createdAt: "", updatedAt: "" },
            { id: "c2", customerNumber: "CUST-02", name: "Nirav Sanghavi", companyName: "Apex Infra & Builders", phone: "9879144556", email: "", city: "Surat", state: "Gujarat", category: "Builder", priceTier: "B", creditLimit: 2000000, paymentTerms: "45 Days", assignedSalespersonId: "sp-1", status: "active", createdAt: "", updatedAt: "" }
          ];
          setCustomers(defaults);
          setSelectedCustomerId(defaults[0].id);
        }
      } catch (err) {
        console.warn("Could not load customers:", err);
      }
    }

    loadCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim() || !estimatedValue) {
      setErrorMsg("Please provide opportunity title and estimated deal value.");
      return;
    }

    const selectedCust = customers.find(c => c.id === selectedCustomerId);
    if (!selectedCust) {
      setErrorMsg("Please select a customer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const oppNumber = `OPP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await addDoc(collection(db, "opportunities"), {
        oppNumber,
        customerId: selectedCust.id,
        customerName: selectedCust.companyName || selectedCust.name,
        title: title.trim(),
        stage,
        estimatedValue: parseFloat(estimatedValue) || 0,
        probability: parseInt(probability, 10) || 50,
        expectedCloseDate: expectedCloseDate || "Within 30 Days",
        assignedSalespersonId: user?.userId || "salesperson-1",
        notes: notes.trim() || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });

      router.push("/opportunities");
    } catch (err: any) {
      console.error("Failed to add opportunity:", err);
      setErrorMsg(err?.message || "Failed to create deal. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell
      title="Create New Opportunity"
      subtitle="Register upcoming project requirement or bulk order negotiation"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/opportunities"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-[#0E274D]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Opportunities</span>
        </Link>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{errorMsg}</div>
          </div>
        )}

        <div className="card-luxury p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-[#0E274D]">Opportunity Specifications</h2>
              <p className="text-xs text-slate-500 mt-0.5">Link deal to an authorized customer and project timeline</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Select Customer / Account *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.name} • {c.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Opportunity / Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Heights Villa Flooring — 800x1600 Gloss Porcelain"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Estimated Deal Value (₹) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 750000"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Initial Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as OpportunityStage)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                >
                  <option value="requirement">Requirement Scoping</option>
                  <option value="quotation">Quotation Prepared</option>
                  <option value="negotiation">Price Negotiation</option>
                  <option value="approved">Customer Approved</option>
                  <option value="won">Won / In Order</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Win Probability ({probability}%)
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  className="w-full accent-[#E66A23] mt-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Close Date
                </label>
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Deal Notes & Key Requirements
                </label>
                <textarea
                  rows={3}
                  placeholder="Tile thickness, packing requirements, credit payment terms requested, competitor comparisons..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <Link
                href="/opportunities"
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-1.5 px-5 py-2.5 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? "Creating..." : "Save Opportunity"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
