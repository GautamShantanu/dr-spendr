import { useState, useEffect, useRef } from "react";
import { Users, ChevronsUpDown, Check, Share2, Plus } from "lucide-react";

export function BucketSwitcher({ buckets, selectedId, onSelect, onNew, onManage, memberCounts }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const current = buckets.find((b) => b.id === selectedId);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 max-w-[200px]">
        <span className="text-base">{current?.emoji || "💼"}</span>
        <span className="text-sm font-semibold text-slate-800 truncate">{current?.name || "Bucket"}</span>
        {memberCounts[selectedId] > 1 && <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            {buckets.map((b) => {
              const shared = memberCounts[b.id] > 1;
              return (
                <button key={b.id} onClick={() => { onSelect(b.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 ${b.id === selectedId ? "bg-slate-50" : ""}`}>
                  <span className="text-base">{b.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{b.name}</span>
                    <span className="block text-[11px] text-slate-400">
                      {b.role === "owner" ? "Owner" : "Shared with you"}{shared ? ` · ${memberCounts[b.id]} people` : " · personal"}
                    </span>
                  </span>
                  {shared && <Users className="w-3.5 h-3.5 text-emerald-500" />}
                  {b.id === selectedId && <Check className="w-4 h-4 text-slate-900" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100 p-1">
            <button onClick={() => { onManage(); setOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <Share2 className="w-4 h-4" /> Share / manage this bucket
            </button>
            <button onClick={() => { onNew(); setOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" /> New bucket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
