"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface ThemedSelectOption {
  value: string;
  label: string;
}

interface ThemedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Shows a search box inside the list; defaults to on for long lists */
  searchable?: boolean;
}

/**
 * Dropdown that opens directly below the input as a rounded, shadowed panel
 * (matching the dialog cards), instead of the browser's native select list.
 */
export function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled = false,
  searchable,
}: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Reset the search and bring the selected item into view whenever the panel opens
  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-lg text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#0E274D] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
          open ? "border-[#0E274D]" : "border-slate-200"
        }`}
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {showSearch && (
            <div className="p-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 px-2.5 py-1.5 bg-slate-50 rounded-lg">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1.5">
            {filtered.length === 0 ? (
              <li className="px-3.5 py-2 text-xs text-slate-400">No matches</li>
            ) : (
              filtered.map((o) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(o.value)}
                    className={`mx-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-[#0E274D]/5 text-[#0E274D] font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#E66A23] shrink-0 ml-2" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
