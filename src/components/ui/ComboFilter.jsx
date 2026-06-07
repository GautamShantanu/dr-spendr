import { useState, useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";

/* type-to-search filter dropdown over a list of names, with an "All" choice */
export function ComboFilter({ value, onChange, options, placeholder = "All" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const matches = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <div className="relative" ref={ref}>
      <input
        value={open ? q : (value === "all" ? "" : value)}
        onFocus={() => { setOpen(true); setQ(""); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && matches.length) { onChange(matches[0]); setOpen(false); e.currentTarget.blur(); } }}
        placeholder={placeholder}
        className="w-full px-2.5 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:bg-white focus:border-slate-400 text-slate-800"
      />
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      {value !== "all" && !open && (
        <button onMouseDown={(e) => { e.preventDefault(); onChange("all"); }} aria-label="Clear filter"
          className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
      )}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          <button onMouseDown={() => { onChange("all"); setOpen(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-500 ${value === "all" ? "bg-slate-50 font-medium" : ""}`}>All</button>
          {matches.map((o) => (
            <button key={o} onMouseDown={() => { onChange(o); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700 ${o === value ? "bg-slate-50 font-medium" : ""}`}>{o}</button>
          ))}
          {q && matches.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No match.</p>}
        </div>
      )}
    </div>
  );
}
