"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Save, CalendarClock, AlertCircle } from "lucide-react";
import { FollowUpType } from "@/types";

function FollowUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const defaultName = searchParams.get("name") || "";
  const defaultLeadId = searchParams.get("leadId") || "";

  const [targetType, setTargetType] = useState<"lead" | "customer" | "opportunity">(defaultLeadId ? "lead" : "customer");
  const [targetName, setTargetName] = useState(defaultName);
  const [type, setType] = useState<FollowUpType>("call");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState("11:00 AM");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!targetName.trim() || !dueDate) {
      setErrorMsg("Please provide client name and scheduled date.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "followUps"), {
        targetType,
        targetId: defaultLeadId || "target-ref",
        targetName: targetName.trim(),
        type,
        dueDate,
        dueTime,
        status: "scheduled",
        notes: notes.trim() || null,
        salespersonId: user?.userId || "sp-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });

      router.push("/follow-ups");
    } catch (err: any) {
      console.error("Failed to add follow-up:", err);
      setErrorMsg(err?.message || "Failed to schedule follow-up.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell
      title="Schedule Follow-up"
      subtitle="Set automated reminders for client calls, showroom visits, and quotation follow-ups"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href="/follow-ups"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-[#0E274D]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Follow-ups</span>
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
              <h2 className="text-base font-bold text-[#0E274D]">Schedule Reminder</h2>
              <p className="text-xs text-slate-500 mt-0.5">Stay proactive across your sales pipeline</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Entity
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["customer", "lead", "opportunity"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTargetType(t)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold capitalize border transition-all cursor-pointer ${
                        targetType === t
                          ? "bg-[#0E274D] text-white border-[#0E274D]"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Contact / Firm Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Infra & Builders (Nirav Sanghavi)"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Action Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as FollowUpType)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  >
                    <option value="call">Phone Call</option>
                    <option value="visit">Field / Site Visit</option>
                    <option value="whatsapp">WhatsApp Message</option>
                    <option value="email">Email</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  >
                  </input>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Time
                  </label>
                  <input
                    type="text"
                    placeholder="11:30 AM"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Follow-up Objectives & Agenda
                </label>
                <textarea
                  rows={3}
                  placeholder="Discuss quote approval, deliver physical sample shades, review payment ledger, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E274D]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <Link
                href="/follow-ups"
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
                <span>{isSubmitting ? "Scheduling..." : "Save Follow-up"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function NewFollowUpPage() {
  return (
    <Suspense fallback={
      <DashboardShell title="Schedule Follow-up">
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin" />
        </div>
      </DashboardShell>
    }>
      <FollowUpForm />
    </Suspense>
  );
}
