"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath, homePathFor } from "@/lib/auth-utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function DashboardShell({ children, title, subtitle }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading } = useAuth();
  const isAllowed = canAccessPath(role, pathname);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!isAllowed) {
      // e.g. a designer opening /customers (or / ) directly by URL
      router.replace(homePathFor(role));
    }
  }, [user, loading, isAllowed, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#0E274D]/20 border-t-[#E66A23] rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[#0E274D] animate-pulse">Loading ITACON Portal...</p>
      </div>
    );
  }

  if (!user || !isAllowed) {
    return null;
  }

  return (
    <div className="h-screen flex bg-[#F6F8FB] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar title={title} subtitle={subtitle} />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
