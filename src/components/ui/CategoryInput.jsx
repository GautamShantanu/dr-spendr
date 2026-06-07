import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export function CategoryInput({ value, onChange, categories, compact }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const sel = categories.find((c) => c.id === value);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const matches = q ? categories.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : categories;
  return (
    <div className="relative" ref={ref}>
      <input
        value={open ? q : (sel ? `${sel.emoji} ${sel.name}` : "")}
        onFocus={() => { setOpen(true); setQ(""); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && matches.length) { onChange(matches[0].id); setOpen(false); e.currentTarget.blur(); } }}
        placeholder="Category — type to search"
        className={`w-full px-3 pr-9 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 ${compact ? "py-2 text-sm" : "py-2.5"}`}
      />
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {matches.length === 0 ? <p className="px-3 py-2.5 text-sm text-slate-400">No matching category.</p> :
            matches.map((c) => (
              <button key={c.id} onMouseDown={() => { onChange(c.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700 ${c.id === value ? "bg-slate-50 font-medium" : ""}`}>
                <span>{c.emoji}</span>{c.name}
                {c.id === value && <Check className="w-3.5 h-3.5 ml-auto text-slate-900" />}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
