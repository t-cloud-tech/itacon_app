"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

interface DefaulterResponse {
  success: boolean;
  exists: boolean;
  isDefaulter?: boolean;
  riskLevel?: string;
  matchedCount?: number;
  reportCount?: { total: number; verified: number; pending: number; closed: number };
}

const RISK_STYLES: Record<string, string> = {
  HIGH: "bg-rose-50 text-rose-700 border-rose-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLEAN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SAFE: "bg-slate-50 text-slate-600 border-slate-200",
};

export function DefaulterCheckCard({ gstNumber }: { gstNumber?: string }) {
  const [data, setData] = useState<DefaulterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const gst = gstNumber?.trim();
    setData(null);
    setFailed(false);
    if (!gst) return;

    let cancelled = false;
    setLoading(true);
    fetch(`/api/defaulter-check?gst=${encodeURIComponent(gst)}`)
      .then((r) => r.json())
      .then((json: DefaulterResponse) => {
        if (cancelled) return;
        if (json.success) setData(json);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [gstNumber]);

  if (!gstNumber?.trim()) return null;

  const risk = data?.riskLevel || "";
  const Icon = data?.isDefaulter ? ShieldAlert : ShieldCheck;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <Icon className={`w-4 h-4 ${data?.isDefaulter ? "text-rose-600" : "text-[#0E274D]"}`} />
          <span>Business Defaulters Check</span>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {failed && <p className="text-xs text-slate-500">Could not fetch defaulter status right now.</p>}

      {data && (
        <>
          <div className="text-xs text-slate-600">
            Exists:{" "}
            <span className={`font-bold ${data.exists ? "text-emerald-700" : "text-slate-700"}`}>
              {String(data.exists)}
            </span>
          </div>

          {data.exists && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-2.5 py-0.5 rounded-full font-bold border ${RISK_STYLES[risk] || RISK_STYLES.SAFE}`}>
                  Risk: {risk}
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                  Defaulter: {data.isDefaulter ? "Yes" : "No"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                  Matched: {data.matchedCount}
                </span>
              </div>

              {data.reportCount && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(["total", "verified", "pending", "closed"] as const).map((k) => (
                    <div key={k} className="rounded-lg bg-slate-50 border border-slate-200/80 py-2">
                      <div className="text-base font-black text-[#0E274D]">{data.reportCount![k]}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
