import { Divide } from "lucide-react";
import { fmtINR } from "../lib/format";

export function SplitEditor({ amount, people, shares, setShares }) {
  const amt = parseFloat(amount) || 0;
  const assigned = people.reduce((s, p) => s + (parseFloat(shares[p]) || 0), 0);
  const left = Math.round((amt - assigned) * 100) / 100;
  const splitEqually = () => {
    if (!people.length || !amt) return;
    const each = Math.floor((amt / people.length) * 100) / 100;
    const first = Math.round((amt - each * (people.length - 1)) * 100) / 100;
    setShares(Object.fromEntries(people.map((p, i) => [p, String(i === 0 ? first : each)])));
  };
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5"><Divide className="w-3.5 h-3.5" /> Split between</p>
        <button type="button" onClick={splitEqually} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Split equally</button>
      </div>
      {people.length === 0 && <p className="text-xs text-slate-400">Add people in Manage → People first.</p>}
      {people.map((p) => (
        <div key={p} className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-semibold shrink-0">{p.slice(0, 1).toUpperCase()}</span>
          <span className="flex-1 text-sm text-slate-700 truncate">{p}</span>
          <div className="relative w-28">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
            <input inputMode="decimal" value={shares[p] || ""} onChange={(e) => setShares({ ...shares, [p]: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="0"
              className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400 text-right" />
          </div>
        </div>
      ))}
      <p className={`text-xs text-right ${Math.abs(left) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
        {Math.abs(left) < 0.01 ? "Fully assigned ✓" : left > 0 ? `${fmtINR(left)} left to assign` : `${fmtINR(-left)} over the amount`}
      </p>
    </div>
  );
}
