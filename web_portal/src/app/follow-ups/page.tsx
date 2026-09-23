"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from "firebase/firestore";
import { FollowUp, FollowUpStatus, FollowUpType } from "@/types";
import { 
  CalendarClock, 
  PlusCircle, 
  Phone, 
  MapPin, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Calendar,
  Building2,
  Check
} from "lucide-react";

export default function FollowUpsPage() {
  const { user, role } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activeTab, setActiveTab] = useState<"today" | "upcoming" | "completed">("today");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFollowUps() {
      setIsLoading(true);
      try {
        const ref = collection(db, "followUps");
        let q = query(ref, orderBy("dueDate", "asc"));

        if (role === "salesperson" && user?.userId) {
          q = query(ref, where("salespersonId", "==", user.userId));
        }

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FollowUp));

        if (list.length > 0) {
          setFollowUps(list);
        } else {
          // Demo realistic followups
          setFollowUps([
            {
              id: "fu-1",
              targetType: "lead",
              targetId: "lead-1",
              targetName: "Pooja Varma (Varma Luxury Estates)",
              type: "call",
              dueDate: new Date().toISOString().split("T")[0],
              dueTime: "11:30 AM",
              status: "scheduled",
              notes: "Call regarding 3D visualizer inquiry from mobile app. Discuss 800x1600mm tile samples.",
              salespersonId: user?.userId || "sp-1",
              createdAt: "2026-09-22",
              updatedAt: "2026-09-22",
            },
            {
              id: "fu-2",
              targetType: "customer",
              targetId: "cust-2",
              targetName: "Apex Infra & Builders (Nirav Sanghavi)",
              type: "visit",
              dueDate: new Date().toISOString().split("T")[0],
              dueTime: "03:00 PM",
              status: "scheduled",
              notes: "Site visit at Skyline Residency project. Deliver physical shade samples of glazed vitrified tiles.",
              salespersonId: user?.userId || "sp-1",
              createdAt: "2026-09-20",
              updatedAt: "2026-09-20",
            },
            {
              id: "fu-3",
              targetType: "opportunity",
              targetId: "opp-1",
              targetName: "Monsoon Villa Project",
              type: "whatsapp",
              dueDate: new Date().toISOString().split("T")[0],
              dueTime: "05:00 PM",
              status: "scheduled",
              notes: "Send revised PDF quotation with 10% approved discount via WhatsApp.",
              salespersonId: user?.userId || "sp-1",
              createdAt: "2026-09-21",
              updatedAt: "2026-09-21",
            },
            {
              id: "fu-4",
              targetType: "customer",
              targetId: "cust-1",
              targetName: "Gujarat Ceramics & Tiles",
              type: "call",
              dueDate: "2026-09-25",
              dueTime: "02:00 PM",
              status: "scheduled",
              notes: "Monthly sales ledger review and credit payment check.",
              salespersonId: user?.userId || "sp-1",
              createdAt: "2026-09-18",
              updatedAt: "2026-09-18",
            },
            {
              id: "fu-5",
              targetType: "lead",
              targetId: "lead-2",
              targetName: "Nilesh Patel (Shree Ram Ceramics)",
              type: "call",
              dueDate: "2026-09-21",
              dueTime: "10:00 AM",
              status: "completed",
              notes: "Introduced ITACON product catalog and price tiers.",
              outcome: "Interested in visiting factory display showroom in Morbi.",
              salespersonId: user?.userId || "sp-1",
              createdAt: "2026-09-19",
              updatedAt: "2026-09-21",
            },
          ]);
        }
      } catch (err) {
        console.warn("Could not fetch followups:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFollowUps();
  }, [user, role]);

  const handleMarkCompleted = async (id: string) => {
    try {
      await updateDoc(doc(db, "followUps", id), {
        status: "completed",
        updatedAt: new Date().toISOString(),
      });
      setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status: "completed" } : f));
    } catch (err) {
      setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status: "completed" } : f));
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const todayFollowUps = followUps.filter(f => f.dueDate === todayStr && f.status !== "completed");
  const upcomingFollowUps = followUps.filter(f => f.dueDate > todayStr && f.status !== "completed");
  const completedFollowUps = followUps.filter(f => f.status === "completed");

  const displayList = 
    activeTab === "today" ? todayFollowUps :
    activeTab === "upcoming" ? upcomingFollowUps : completedFollowUps;

  const getTypeIcon = (type: FollowUpType) => {
    switch (type) {
      case "call": return <Phone className="w-4 h-4 text-blue-600" />;
      case "visit": return <MapPin className="w-4 h-4 text-emerald-600" />;
      case "whatsapp": return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case "email": return <Mail className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <DashboardShell
      title="Follow-up Reminders"
      subtitle="Client calls, showroom visits, site inspections, and quote follow-ups"
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("today")}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "today"
                  ? "border-[#E66A23] text-[#E66A23]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Today&apos;s Due ({todayFollowUps.length})
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "upcoming"
                  ? "border-[#E66A23] text-[#E66A23]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Upcoming ({upcomingFollowUps.length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "completed"
                  ? "border-[#E66A23] text-[#E66A23]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Completed History ({completedFollowUps.length})
            </button>
          </div>

          <Link
            href="/follow-ups/new"
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Schedule Follow-up</span>
          </Link>
        </div>

        {/* Follow-up Cards List */}
        <div className="space-y-3.5">
          {displayList.length === 0 ? (
            <div className="card-luxury p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-[#0E274D]">All Caught Up!</h3>
              <p className="text-xs text-slate-500 mt-1">No pending tasks for this section.</p>
            </div>
          ) : (
            displayList.map((item) => (
              <div
                key={item.id}
                className="card-luxury p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0E274D] capitalize">
                        {item.type} with {item.targetName}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold capitalize">
                        {item.targetType}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      {item.notes}
                    </p>

                    {item.outcome && (
                      <p className="text-xs text-emerald-700 mt-1 font-medium bg-emerald-50 p-2 rounded border border-emerald-200">
                        Outcome: {item.outcome}
                      </p>
                    )}

                    <div className="flex items-center space-x-4 mt-2 text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{item.dueDate}</span>
                      </span>
                      {item.dueTime && (
                        <span className="flex items-center space-x-1 text-amber-600 font-semibold">
                          <Clock className="w-3 h-3" />
                          <span>{item.dueTime}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center space-x-2 sm:self-center">
                  {item.status !== "completed" && (
                    <button
                      onClick={() => handleMarkCompleted(item.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Done</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
