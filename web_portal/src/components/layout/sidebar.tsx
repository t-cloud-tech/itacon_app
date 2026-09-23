"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { 
  Building2, 
  LayoutDashboard, 
  UserCheck, 
  Users, 
  Target, 
  CalendarClock, 
  Grid3X3, 
  FileSpreadsheet, 
  CheckSquare, 
  Truck, 
  LogOut,
  ChevronRight
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: UserCheck },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Opportunities", href: "/opportunities", icon: Target },
  { name: "Follow-ups", href: "/follow-ups", icon: CalendarClock },
  { name: "Tile Catalogue", href: "/products", icon: Grid3X3 },
  { name: "Quotations", href: "/quotations", icon: FileSpreadsheet },
  { name: "Approvals", href: "/approvals", icon: CheckSquare },
  { name: "Sales Orders", href: "/orders", icon: Truck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, salesperson, role, logout } = useAuth();

  return (
    <aside className="w-64 bg-[#0E274D] text-white flex flex-col justify-between shrink-0 min-h-screen border-r border-[#1A2D5A] select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 flex items-center space-x-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#E66A23] to-[#F59E0B] flex items-center justify-center shadow-md shadow-[#E66A23]/30">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight tracking-tight text-white">ITACON</div>
            <div className="text-[11px] font-medium text-orange-400 uppercase tracking-wider">
              {role === "admin" ? "Admin Portal" : "Salesperson Portal"}
            </div>
          </div>
        </div>

        {/* Salesperson / Admin Profile Capsule */}
        <div className="px-4 py-4 mx-3 mt-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#E66A23]/20 border border-[#E66A23]/40 flex items-center justify-center font-bold text-sm text-orange-300">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user?.name || "User"}</p>
              <p className="text-xs text-slate-400 truncate">
                {salesperson?.employeeId || (role === "admin" ? "Super Admin" : "Executive")}
              </p>
            </div>
          </div>
          {salesperson?.region && (
            <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
              <span>Region:</span>
              <span className="font-medium text-white">{salesperson.region}</span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="mt-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#E66A23] text-white shadow-md shadow-[#E66A23]/25"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
