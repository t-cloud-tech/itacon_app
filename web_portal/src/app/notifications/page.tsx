"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Users,
  FileSpreadsheet,
  IndianRupee,
  Clock,
  AlertTriangle,
  UserCheck,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import {
  fetchNotificationsPage,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  formatTimeAgo,
  NotificationFilter,
} from "@/lib/notification-service";
import { StaffNotification, NotificationType } from "@/types";
import { PushSettingsModal } from "@/components/notifications/push-settings-modal";

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "customer_assigned":
    case "customer_inactive":
    case "no_first_order":
      return <Users className="w-5 h-5 text-blue-600" />;
    case "customer_unassigned_24h":
      return <Users className="w-5 h-5 text-amber-600" />;
    case "po_request":
    case "po_approved_unpaid":
      return <FileSpreadsheet className="w-5 h-5 text-amber-600" />;
    case "payment_submitted":
      return <IndianRupee className="w-5 h-5 text-emerald-600" />;
    case "payment_action_verify":
      return <IndianRupee className="w-5 h-5 text-purple-600" />;
    case "payment_verified":
      return <IndianRupee className="w-5 h-5 text-emerald-600" />;
    case "payment_rejected":
    case "payment_overdue":
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    case "lead_assigned":
      return <UserCheck className="w-5 h-5 text-purple-600" />;
    case "follow_up_due":
      return <Clock className="w-5 h-5 text-orange-600" />;
    case "admin_weekly_summary":
      return <Sparkles className="w-5 h-5 text-indigo-600" />;
    case "system_alert":
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    default:
      return <Bell className="w-5 h-5 text-slate-500" />;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState<any[]>([null]);
  const [hasMore, setHasMore] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const PAGE_SIZE = 25;

  const loadPage = async (targetPage: number, currentFilter: NotificationFilter) => {
    if (!user?.userId) return;
    setIsLoading(true);

    try {
      const cursor = cursorHistory[targetPage - 1] || null;
      const res = await fetchNotificationsPage(user.userId, {
        filter: currentFilter,
        pageSize: PAGE_SIZE,
        cursorDoc: cursor,
      });

      setNotifications(res.notifications);
      setHasMore(res.hasMore);
      setPage(targetPage);

      if (res.cursorDoc && cursorHistory.length === targetPage) {
        setCursorHistory((prev) => [...prev, res.cursorDoc]);
      }
    } catch (err) {
      console.error("Failed to load notifications page:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCursorHistory([null]);
    setPage(1);
    loadPage(1, filter);
  }, [user?.userId, filter]);

  const handleMarkAll = async () => {
    if (!user?.userId || notifications.length === 0) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) {
      setToastMsg("All notifications are already marked as read.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    await markAllNotificationsAsRead(user.userId, unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setToastMsg("Marked all as read.");
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleNotificationClick = async (notif: StaffNotification) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const tabs: { key: NotificationFilter; label: string }[] = [
    { key: "all", label: "All Alerts" },
    { key: "unread", label: "Unread" },
    { key: "customers", label: "Customers" },
    { key: "payments", label: "Payments" },
    { key: "reminders", label: "Reminders" },
    { key: "leads", label: "Leads" },
  ];

  return (
    <DashboardShell
      title="Notification Center"
      subtitle="Staff Activity, Alerts & Scheduled Reminders"
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Toast Alert */}
        {toastMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between animate-fadeIn">
            <span>{toastMsg}</span>
            <button
              onClick={() => setToastMsg(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {/* Action Header Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-[#0E274D] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-[#0E274D]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Push Settings</span>
            </button>
          </div>
        </div>

        {/* Notifications Table Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-slate-300 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-600">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-[#0E274D]">No notifications found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {filter === "unread"
                  ? "You have marked all notifications as read."
                  : "There are no notifications matching the selected filter."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 sm:p-5 flex items-start space-x-4 cursor-pointer transition-colors ${
                    !notif.read ? "bg-amber-50/40 hover:bg-amber-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center space-x-2">
                        <h4
                          className={`text-sm ${
                            !notif.read ? "font-bold text-[#0E274D]" : "font-semibold text-slate-800"
                          }`}
                        >
                          {notif.title}
                        </h4>

                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Unread" />
                        )}

                        {notif.priority === "high" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded border border-red-200">
                            High Priority
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-slate-400 shrink-0">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {notif.body}
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {new Date(notif.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotificationClick(notif);
                        }}
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-[#0E274D] hover:text-[#E66A23] transition-colors"
                      >
                        <span>Open &rarr;</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Footer */}
          {!isLoading && notifications.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Page {page} {hasMore ? "• More available" : "• End of results"}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => loadPage(page - 1, filter)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={!hasMore}
                  onClick={() => loadPage(page + 1, filter)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Push Settings Modal */}
      <PushSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </DashboardShell>
  );
}

