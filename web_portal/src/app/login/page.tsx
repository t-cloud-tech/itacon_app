"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { 
  Building2, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  Smartphone
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg("Please enter your email or registered phone number.");
      return;
    }

    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(identifier, password);
      router.push("/");
    } catch (err: any) {
      console.error("Login failed:", err);
      setErrorMsg(err?.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F6F8FB]">
      {/* Left Banner - Enterprise Branding */}
      <div className="lg:w-1/2 bg-[#0E274D] text-white p-8 lg:p-14 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle geometric background overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
        
        <div>
          {/* Logo & Company Name */}
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#E66A23] to-[#F59E0B] flex items-center justify-center shadow-lg shadow-[#E66A23]/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-white">ITACON</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-orange-400 uppercase tracking-wider">
                Enterprise Portal
              </span>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-4">
              Streamlined Sales & Quotation Management
            </h1>
            <p className="text-slate-300 text-sm lg:text-base leading-relaxed mb-8">
              Empowering ITACON sales executives with real-time customer app synchronization, fast quotation builders, automated approvals, and lead intelligence.
            </p>
          </div>

          {/* Key Feature Highlights */}
          <div className="space-y-4 max-w-md">
            <div className="flex items-start space-x-3.5 p-3 rounded-lg bg-white/5 border border-white/10">
              <Smartphone className="w-5 h-5 text-[#E66A23] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Direct Customer App Sync</p>
                <p className="text-xs text-slate-300">Quotations generated in this portal reflect immediately in the customer&apos;s mobile app.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3 rounded-lg bg-white/5 border border-white/10">
              <FileSpreadsheet className="w-5 h-5 text-[#E66A23] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Fast 3-Step Quotation Builder</p>
                <p className="text-xs text-slate-300">Live box-to-sqft calculation, automated weight calculations, and margin rule checks.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3 rounded-lg bg-white/5 border border-white/10">
              <TrendingUp className="w-5 h-5 text-[#E66A23] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Follow-up & Pipeline Tracking</p>
                <p className="text-xs text-slate-300">Never miss a client follow-up with intelligent reminders and pipeline analytics.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-8 mt-8 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Role-Based Secure Portal</span>
          </div>
          <span>© {new Date().getFullYear()} ITACON Ceramic</span>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Card header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#0E274D] tracking-tight">Staff Sign In</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Enter your credentials to access the Salesperson or Admin dashboard.
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 leading-snug">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identifier input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email Address or Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="sales@itacon.com or 9876543210"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D] focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-11 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E274D] focus:border-transparent transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-lg bg-[#E66A23] hover:bg-[#D95D16] text-white font-semibold text-sm shadow-md hover:shadow-lg shadow-[#E66A23]/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Access policy notice */}
          <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 leading-relaxed">
            <div className="flex items-center space-x-1.5 font-semibold text-slate-700 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Internal Staff Portal</span>
            </div>
            Access is restricted to authorized Salespersons and Administrators. Customer accounts must access quotes and products through the official ITACON mobile app.
          </div>
        </div>
      </div>
    </div>
  );
}
