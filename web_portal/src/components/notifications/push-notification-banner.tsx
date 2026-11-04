"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { BellRing, CheckCircle2, X } from "lucide-react";
import { requestAndRegisterPushToken, getPushNotificationState } from "@/lib/fcm-client";

export function PushNotificationBanner() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (!user?.userId) return;

    // Check if dismissed for this session
    const isDismissed = sessionStorage.getItem("dismissed_notif_banner") === "true";
    if (isDismissed) return;

    const state = getPushNotificationState();
    // Only prompt if supported and permission is 'default' (not yet asked)
    if (state.supported && state.permission === "default") {
      setShowBanner(true);
    }
  }, [user?.userId]);

  const handleEnable = async () => {
    if (!user?.userId) return;
    setIsRegistering(true);

    try {
      const res = await requestAndRegisterPushToken(user.userId);
      if (res.success) {
        setSuccessMsg(true);
        setTimeout(() => {
          setShowBanner(false);
        }, 3000);
      } else {
        setShowBanner(false);
      }
    } catch {
      setShowBanner(false);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem("dismissed_notif_banner", "true");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="bg-gradient-to-r from-[#0E274D] to-[#1A3668] text-white px-4 py-2.5 sm:px-6 shadow-md transition-all animate-fadeIn">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 text-xs sm:text-sm">
          <div className="p-1.5 rounded-lg bg-[#E66A23] text-white shrink-0">
            {successMsg ? <CheckCircle2 className="w-4 h-4" /> : <BellRing className="w-4 h-4 animate-bounce" />}
          </div>
          <div>
            {successMsg ? (
              <span className="font-semibold text-emerald-300">
                Push alerts enabled! You will receive instant notifications for new orders and payments.
              </span>
            ) : (
              <span>
                <strong className="font-semibold text-orange-300">Get instant alerts for customers and payments?</strong>{" "}
                Stay notified on new orders, payments, and reminders even when this tab is closed.
              </span>
            )}
          </div>
        </div>

        {!successMsg && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleEnable}
              disabled={isRegistering}
              className="px-3.5 py-1.5 bg-[#E66A23] hover:bg-[#cf5b1a] text-white text-xs font-bold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              {isRegistering ? "Enabling..." : "Allow Alerts"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white text-xs font-semibold rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              Not Now
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

