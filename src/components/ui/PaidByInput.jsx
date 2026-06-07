import { useState, useEffect, useRef } from "react";
import { Users, Plus } from "lucide-react";

export function PaidByInput({ value, onChange, people, compact, placeholder = "Paid by", icon: Icon = Users }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const matches = people.filter((p) => p.toLowerCase().includes((value || "").toLowerCase()) && p.toLowerCase() !== (value || "").toLowerCase());
  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder}
          className={`w-full pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 ${compact ? "py-2 text-sm" : "py-2.5"}`} />
      </div>
      {open && (matches.length > 0 || value) && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
          {!people.some((p) => p.toLowerCase() === (value || "").toLowerCase()) && value && (
            <button onMouseDown={() => { onChange(value); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700">
              <Plus className="w-3.5 h-3.5 text-emerald-500" /> Use "{value}"
            </button>
          )}
          {matches.map((p) => (
            <button key={p} onMouseDown={() => { onChange(p); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700">{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
