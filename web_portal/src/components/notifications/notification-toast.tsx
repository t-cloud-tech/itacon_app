"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { subscribeLiveUnreadNotifications, markNotificationAsRead } from "@/lib/notification-service";
import { listenForegroundPushMessages } from "@/lib/fcm-client";
import { StaffNotification } from "@/types";

export function NotificationToast() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeToast, setActiveToast] = useState<{
    id?: string;
    title: string;
    body: string;
    link: string;
    priority: string;
  } | null>(null);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Listen for new high-priority notifications arriving via live onSnapshot
  useEffect(() => {
    if (!user?.userId) return;

    const unsubscribe = subscribeLiveUnreadNotifications(user.userId, (unreads) => {
      if (initialLoadRef.current) {
        // Mark existing unreads as seen so we don't trigger toast on initial page load
        unreads.forEach((n) => seenIdsRef.current.add(n.id));
        initialLoadRef.current = false;
        return;
      }

      // Check for newly arrived unreads with high priority
      for (const notif of unreads) {
        if (!seenIdsRef.current.has(notif.id)) {
          seenIdsRef.current.add(notif.id);
          if (notif.priority === "high") {
            triggerToast({
              id: notif.id,
              title: notif.title,
              body: notif.body,
              link: notif.link,
              priority: notif.priority,
            });
            break;
          }
        }
      }
    });

    return () => unsubscribe();
  }, [user?.userId]);

  // 2. Listen for foreground push messages while tab is open (no double alerts)
  useEffect(() => {
    let unsubscribePush: (() => void) | undefined;

    listenForegroundPushMessages((payload) => {
      const title = payload.notification?.title || payload.data?.title || "ITACON Notification";
      const body = payload.notification?.body || payload.data?.body || "";
      const link = payload.data?.link || "/notifications";
      const priority = payload.data?.priority || "normal";

      triggerToast({
        id: payload.data?.notifId,
        title,
        body,
        link,
        priority,
      });
    }).then((unsub) => {
      unsubscribePush = unsub;
    });

    return () => {
      if (unsubscribePush) unsubscribePush();
    };
  }, []);

  const triggerToast = (toastData: {
    id?: string;
    title: string;
    body: string;
    link: string;
    priority: string;
  }) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    setActiveToast(toastData);

    dismissTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 7000);
  };

  const handleClick = async () => {
    if (!activeToast) return;
    if (activeToast.id) {
      await markNotificationAsRead(activeToast.id);
    }
    const dest = activeToast.link || "/notifications";
    setActiveToast(null);
    router.push(dest);
  };

  if (!activeToast) return null;

  return (
    <div className="fixed top-5 right-5 z-50 max-w-sm w-full animate-slideIn">
      <div className="bg-white rounded-xl shadow-2xl border-l-4 border-l-red-600 border border-slate-200 p-4 flex items-start space-x-3.5">
        <div className="p-2 rounded-lg bg-red-100 text-red-700 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              High Priority Alert
            </span>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <h4 className="text-xs font-bold text-[#0E274D] mt-1.5 truncate">
            {activeToast.title}
          </h4>

          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-snug">
            {activeToast.body}
          </p>

          <div className="mt-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClick}
              className="inline-flex items-center space-x-1 text-xs font-bold text-[#E66A23] hover:text-[#c45314] cursor-pointer"
            >
              <span>View Alert</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveToast(null)}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

