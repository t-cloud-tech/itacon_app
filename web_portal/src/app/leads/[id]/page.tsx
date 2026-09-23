"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Lead, LeadStatus } from "@/types";
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  UserCheck, 
  CalendarClock, 
  FileSpreadsheet, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Clock,
  ExternalLink
} from "lucide-react";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const leadId = params?.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    async function fetchLead() {
      setIsLoading(true);
      try {
        if (!leadId) return;
        const snap = await getDoc(doc(db, "leads", leadId));
        if (snap.exists()) {
          setLead({ id: snap.id, ...snap.data() } as Lead);
        } else {
          // Demo fallback if document not yet created
          setLead({
            id: leadId,
            leadNumber: "LD-2026-042",
            name: "Pooja Varma",
            phone: "98241 55678",
            email: "pooja.v@varmaestates.in",
            companyName: "Varma Luxury Estates",
            city: "Ahmedabad",
            state: "Gujarat",
            source: "customer_app",
            status: "new",
            assignedSalespersonId: user?.userId || "sp-1",
            requirementNotes: "Inquired via App 3D Visualizer for 800x1600mm Carving Finish Porcelain tiles for 12 duplex villas.",
            createdAt: "Today, 09:15 AM",
            updatedAt: "Today, 09:15 AM",
          });
        }
      } catch (err) {
        console.warn("Could not fetch lead:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLead();
  }, [leadId, user]);

  const handleUpdateStatus = async (newStatus: LeadStatus) => {
    if (!lead) return;
    setIsUpdatingStatus(true);
    try {
      await updateDoc(doc(db, "leads", lead.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      setLead(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      console.warn("Could not update doc in Firestore, updating local state:", err);
      setLead(prev => prev ? { ...prev, status: newStatus } : null);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConvertToCustomer = async () => {
    if (!lead) return;
    setIsConverting(true);
    try {
      const custNumber = `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const docRef = await addDoc(collection(db, "customers"), {
        customerNumber: custNumber,
        name: lead.name,
        companyName: lead.companyName || lead.name,
        phone: lead.phone,
        email: lead.email || "",
        city: lead.city,
        state: lead.state,
        category: "Dealer",
        priceTier: "B",
        creditLimit: 250000,
        paymentTerms: "30 Days Net",
        assignedSalespersonId: user?.userId || lead.assignedSalespersonId,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });

      // Update lead as converted
      await updateDoc(doc(db, "leads", lead.id), {
        status: "converted",
        convertedCustomerId: docRef.id,
        updatedAt: new Date().toISOString(),
      });

      router.push(`/customers/${docRef.id}`);
    } catch (err) {
      console.warn("Local demo conversion:", err);
      router.push("/customers");
    } finally {
      setIsConverting(false);
    }
  };

  if (isLoading || !lead) {
    return (
      <DashboardShell title="Lead Details">
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  const stages: { key: LeadStatus; label: string }[] = [
    { key: "new", label: "New Lead" },
    { key: "contacted", label: "Contacted" },
    { key: "qualified", label: "Qualified" },
    { key: "converted", label: "Customer" },
  ];

  const currentStageIndex = stages.findIndex(s => s.key === lead.status);

  return (
    <DashboardShell
      title={`Lead: ${lead.name}`}
      subtitle={`${lead.leadNumber} • ${lead.companyName || "Individual Client"}`}
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <Link
            href="/leads"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-[#0E274D]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Leads</span>
          </Link>

          {lead.status !== "converted" ? (
            <button
              onClick={handleConvertToCustomer}
              disabled={isConverting}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isConverting ? "Converting..." : "Convert to Official Customer"}</span>
            </button>
          ) : (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Converted to Customer</span>
            </span>
          )}
        </div>

        {/* Pipeline Stage Progression Banner */}
        <div className="card-luxury p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Pipeline Stage</h2>
          <div className="grid grid-cols-4 gap-2">
            {stages.map((stage, idx) => {
              const isPastOrCurrent = currentStageIndex >= idx;
              const isCurrent = currentStageIndex === idx;

              return (
                <button
                  key={stage.key}
                  disabled={lead.status === "converted" || isUpdatingStatus}
                  onClick={() => handleUpdateStatus(stage.key)}
                  className={`p-3 rounded-lg text-left transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-[#0E274D] text-white shadow-sm ring-2 ring-[#0E274D]"
                      : isPastOrCurrent
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                      : "bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span>Step 0{idx + 1}</span>
                    {isPastOrCurrent && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-sm font-bold truncate">{stage.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lead Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="card-luxury p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#0E274D] uppercase tracking-wider">Client Requirements</h3>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
                {lead.requirementNotes || "No specific notes provided for this lead."}
              </div>

              {lead.source === "customer_app" && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-900">Originated from ITACON Customer Mobile App</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Client selected materials using the interactive mobile 3D tile space visualizer.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action CTAs */}
            <div className="card-luxury p-6">
              <h3 className="text-sm font-bold text-[#0E274D] uppercase tracking-wider mb-4">Direct Sales Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call {lead.phone}</span>
                </a>
                <Link
                  href={`/follow-ups/new?leadId=${lead.id}&name=${encodeURIComponent(lead.name)}`}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition-colors"
                >
                  <CalendarClock className="w-4 h-4" />
                  <span>Schedule Follow-up</span>
                </Link>
                <Link
                  href={`/quotations/new?leadId=${lead.id}&name=${encodeURIComponent(lead.name)}`}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#E66A23] text-xs font-semibold border border-orange-200 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Create Quotation</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar Info Card */}
          <div className="space-y-6">
            <div className="card-luxury p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact Snapshot</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400">Firm Name</span>
                  <p className="font-semibold text-slate-800">{lead.companyName || "N/A"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Mobile Phone</span>
                  <p className="font-semibold text-slate-800">{lead.phone}</p>
                </div>
                {lead.email && (
                  <div>
                    <span className="text-xs text-slate-400">Email</span>
                    <p className="font-semibold text-slate-800 truncate">{lead.email}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-400">Location</span>
                  <p className="font-semibold text-slate-800">{lead.city}, {lead.state}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Source</span>
                  <p className="font-semibold text-slate-800 capitalize">{lead.source.replace("_", " ")}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Lead Created</span>
                  <p className="font-semibold text-slate-800">{lead.createdAt}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
