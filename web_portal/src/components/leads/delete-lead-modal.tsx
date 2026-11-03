"use client";

import React, { useState } from "react";
import { Trash2, AlertTriangle, X, Loader2, Info } from "lucide-react";
import { Lead } from "@/types";
import { deleteLeadAsAdmin } from "@/lib/lead-service";
import { useAuth } from "@/lib/auth-context";

interface Props {
  lead: Lead;
  onClose: () => void;
  onDeleted: (leadId: string) => void;
}

export function DeleteLeadModal({ lead, onClose, onDeleted }: Props) {
  const { user, role } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isConverted = lead.status === "converted" || Boolean(lead.convertedCustomerId);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const res = await deleteLeadAsAdmin(lead, {
        uid: user?.userId || "admin",
        name: user?.name || "Admin",
        role: role || "admin",
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to delete lead. Please try again.");
        setIsDeleting(false);
        return;
      }

      onDeleted(lead.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while deleting lead.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fadeIn backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-scaleUp">
        {/* Header */}
        <div className="p-5 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Lead</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {lead.leadNumber || lead.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5">
          <p className="text-sm text-slate-700 leading-relaxed">
            Delete lead <span className="font-bold text-slate-900">{lead.name}</span> (
            <span className="font-mono font-semibold text-slate-800">{lead.leadNumber || lead.id}</span>
            )? This can&apos;t be undone.
          </p>

          {isConverted && (
            <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-medium">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>The customer created from this lead will NOT be deleted.</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

