"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Bell,
  BellOff,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
  Share,
  PlusSquare,
  ShieldAlert,
} from "lucide-react";
import {
  requestAndRegisterPushToken,
  unregisterPushToken,
  getPushNotificationState,
} from "@/lib/fcm-client";

interface PushSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PushSettingsModal({ isOpen, onClose }: PushSettingsModalProps) {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [permission, setPermission] = useState<string>("default");
  const [isSupported, setIsSupported] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const state = getPushNotificationState();
      setIsSupported(state.supported);
      setPermission(state.permission);
      setIsEnabled(state.enabled);
    }
  }, [isOpen]);

  const handleToggle = async () => {
    if (!user?.userId) return;
    setIsUpdating(true);
    setStatusMsg(null);

    try {
      if (!isEnabled) {
        // Turn ON
        const res = await requestAndRegisterPushToken(user.userId);
        if (res.success) {
          setIsEnabled(true);
          setPermission("granted");
          setStatusMsg("Push notifications enabled successfully!");
        } else {
          setStatusMsg(res.error || "Permission was not granted.");
        }
      } else {
        // Turn OFF
        await unregisterPushToken(user.userId);
        setIsEnabled(false);
        setStatusMsg("Push notifications disabled on this device.");
      }
    } catch (err: any) {
      setStatusMsg(err?.message || "Failed to update push settings.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0E274D] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Bell className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-base tracking-tight">Notification & Push Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main Toggle Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="space-y-1 pr-4">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-[#0E274D]">Push Notifications</span>
                {isEnabled ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full">
                    ACTIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold text-slate-500 bg-slate-200 rounded-full">
                    OFF
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Receive instant pop-ups for new client POs, payment submissions, and daily reminders even when the portal is closed.
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              disabled={isUpdating || (!isSupported && !isEnabled)}
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isEnabled ? "bg-[#E66A23]" : "bg-slate-300"
              } disabled:opacity-50`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div className={`p-3 rounded-lg text-xs font-semibold flex items-center space-x-2 ${
              isEnabled ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}>
              {isEnabled ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Browser Permission State */}
          <div className="text-xs space-y-1.5 text-slate-600">
            <div className="flex items-center justify-between">
              <span>Browser Permission Status:</span>
              <span className={`font-semibold capitalize ${
                permission === "granted" ? "text-emerald-600" : permission === "denied" ? "text-red-600" : "text-amber-600"
              }`}>
                {permission}
              </span>
            </div>

            {permission === "denied" && (
              <p className="text-[11px] text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                <ShieldAlert className="w-4 h-4 inline mr-1 text-red-600" />
                Browser notifications are blocked. Click the lock/site settings icon in your browser address bar and set Notifications to "Allow".
              </p>
            )}
          </div>

          {/* iPhone / iOS Guide */}
          <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-sky-900">
              <Smartphone className="w-4 h-4 text-sky-700" />
              <span>Instructions for iPhone / iOS Users</span>
            </div>
            <p className="text-[11px] text-sky-800 leading-relaxed">
              Apple iOS supports web push on iOS 16.4+ only when the web portal is added to your Home Screen:
            </p>
            <ol className="text-[11px] text-sky-800 list-decimal pl-4 space-y-1">
              <li>Open this portal in Safari on your iPhone.</li>
              <li>Tap the <strong>Share</strong> button <Share className="w-3 h-3 inline text-sky-600" /> in Safari’s bottom bar.</li>
              <li>Scroll down and select <strong>"Add to Home Screen"</strong> <PlusSquare className="w-3 h-3 inline text-sky-600" />.</li>
              <li>Open the newly installed <strong>"ITACON Management"</strong> app from your Home Screen.</li>
              <li>Log in and enable Push Notifications here.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

