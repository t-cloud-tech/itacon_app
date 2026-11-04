"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Bell,
  Check,
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
} from "lucide-react";
import {
  subscribeLiveUnreadNotifications,
  fetchRecentNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  formatTimeAgo,
} from "@/lib/notification-service";
import { StaffNotification, NotificationType } from "@/types";

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "customer_assigned":
    case "customer_inactive":
    case "no_first_order":
      return <Users className="w-4 h-4 text-blue-600" />;
    case "po_request":
    case "po_approved_unpaid":
      return <FileSpreadsheet className="w-4 h-4 text-amber-600" />;
    case "payment_submitted":
      return <IndianRupee className="w-4 h-4 text-emerald-600" />;
    case "payment_verified":
      return <Check className="w-4 h-4 text-emerald-600" />;
    case "payment_rejected":
    case "payment_overdue":
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    case "lead_assigned":
      return <UserCheck className="w-4 h-4 text-purple-600" />;
    case "follow_up_due":
      return <Clock className="w-4 h-4 text-orange-600" />;
    case "admin_weekly_summary":
      return <Sparkles className="w-4 h-4 text-indigo-600" />;
    default:
      return <Bell className="w-4 h-4 text-slate-500" />;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadList, setUnreadList] = useState<StaffNotification[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<StaffNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingDropdown, setIsLoadingDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Requirement 4: ONE live onSnapshot listener strictly for latest 20 unread
  useEffect(() => {
    if (!user?.userId) return;

    const unsubscribe = subscribeLiveUnreadNotifications(user.userId, (unreads) => {
      setUnreadList(unreads);
      setUnreadCount(unreads.length);
    });

    return () => unsubscribe();
  }, [user?.userId]);

  // 2. Fetch latest 10 notifications on opening the dropdown (one-time read)
  useEffect(() => {
    if (isOpen && user?.userId) {
      setIsLoadingDropdown(true);
      fetchRecentNotifications(user.userId, 10)
        .then((notifs) => {
          setRecentNotifications(notifs);
        })
        .finally(() => {
          setIsLoadingDropdown(false);
        });
    }
  }, [isOpen, user?.userId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllAsRead = async () => {
    if (!user?.userId || unreadList.length === 0) return;
    const unreadIds = unreadList.map((n) => n.id);
    await markAllNotificationsAsRead(user.userId, unreadIds);

    // Optimistically update local dropdown state
    setRecentNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setUnreadList([]);
  };

  const handleNotificationClick = async (notif: StaffNotification) => {
    setIsOpen(false);
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-slate-600 hover:text-[#0E274D] hover:bg-slate-100 transition-colors cursor-pointer focus:outline-hidden"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shadow-xs ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-[#0E274D]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs font-semibold text-[#E66A23] hover:text-[#c45314] flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {isLoadingDropdown && recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0E274D] rounded-full animate-spin mx-auto mb-2" />
                <span>Loading alerts...</span>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You're completely caught up!</p>
              </div>
            ) : (
              recentNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start space-x-3 cursor-pointer transition-colors ${
                    !notif.read ? "bg-amber-50/40 hover:bg-amber-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-lg bg-slate-100 shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between space-x-1">
                      <p
                        className={`text-xs truncate ${
                          !notif.read ? "font-bold text-[#0E274D]" : "font-semibold text-slate-700"
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                      {notif.body}
                    </p>

                    <div className="flex items-center space-x-2 mt-1.5">
                      {notif.priority === "high" && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded border border-red-200">
                          High Priority
                        </span>
                      )}
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Unread" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-[#0E274D] hover:text-[#E66A23] transition-colors inline-flex items-center space-x-1"
            >
              <span>View all notifications</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

