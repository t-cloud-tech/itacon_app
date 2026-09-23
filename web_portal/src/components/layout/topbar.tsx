"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { 
  Bell, 
  PlusCircle, 
  Search, 
  Smartphone,
  ExternalLink 
} from "lucide-react";

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

export function Topbar({ title = "Dashboard", subtitle = "Sales Activity & Quotation Overview" }: TopbarProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div>
        <h1 className="text-lg font-bold text-[#0E274D] tracking-tight leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-4">
        {/* App Sync Status Indicator */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>Customer App Live Sync</span>
        </div>

        {/* Quick New Quotation CTA */}
        <Link
          href="/quotations/new"
          className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-[#E66A23] hover:bg-[#D95D16] text-white text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Quotation</span>
        </Link>
      </div>
    </header>
  );
}
