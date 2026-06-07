import { useState, useEffect, useRef } from "react";
import { Plus, Loader2, ChevronDown, Calendar, CreditCard, Store, Divide, Paperclip } from "lucide-react";
import { PAYMENT_METHODS, MAX_PHOTOS } from "../lib/constants";
import { todayStr } from "../lib/format";
import { buildSplit } from "../lib/helpers";
import { Card } from "./ui/Card";
import { CategoryInput } from "./ui/CategoryInput";
import { PaidByInput } from "./ui/PaidByInput";
import { SplitEditor } from "./SplitEditor";
import { PhotoPicker } from "./PhotoPicker";

export function QuickAdd({ categories, people, payees, defaultPaidBy, onAdd }) {
  const blank = { amount: "", category: categories[0]?.id || "other", description: "", date: todayStr(), method: "upi", paidBy: defaultPaidBy, paidTo: "" };
  const [f, setF] = useState(blank);
  const [expanded, setExpanded] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [shares, setShares] = useState({});
  const [photos, setPhotos] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const amountRef = useRef(null);

  useEffect(() => { setF((p) => ({ ...p, category: categories[0]?.id || "other" })); /* eslint-disable-next-line */ }, [categories]);

  const submit = async () => {
    const amt = parseFloat(f.amount);
    if (!amt || amt <= 0) { amountRef.current?.focus(); return; }
    let split = null;
    if (splitOn) {
      const res = buildSplit(shares, people, amt);
      if (res.error) { setErr(res.error); return; }
      split = res.split;
    }
    setErr(""); setBusy(true);
    await onAdd({ amount: amt, category: f.category, description: f.description.trim(), date: f.date, method: f.method, paidBy: (f.paidBy || defaultPaidBy).trim() || defaultPaidBy, paidTo: f.paidTo.trim(), split }, photos.map((p) => p.blob));
    setBusy(false);
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]); setSplitOn(false); setShares({});
    setF({ ...blank, category: f.category, paidBy: f.paidBy });
    amountRef.current?.focus();
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center"><Plus className="w-4 h-4 text-emerald-600" /></div>
        <h2 className="font-semibold text-slate-800">Add expense</h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative sm:w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
          <input ref={amountRef} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^0-9.]/g, "") })} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="0"
            className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-lg font-semibold text-slate-900" />
        </div>
        <div className="flex-1">
          <CategoryInput value={f.category} onChange={(id) => setF({ ...f, category: id })} categories={categories} />
        </div>
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Note (optional)"
          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800" />
        <button onClick={submit} disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 active:scale-[0.98] transition flex items-center justify-center gap-1.5 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
        </button>
      </div>
      <button onClick={() => setExpanded((v) => !v)} className="mt-2.5 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} /> {expanded ? "Less" : "Date, payment, payee & split"}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
            </div>
            <div className="relative">
              <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className="w-full appearance-none px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm pr-9">
                {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <PaidByInput value={f.paidBy} onChange={(v) => setF({ ...f, paidBy: v })} people={people} compact />
            <PaidByInput value={f.paidTo} onChange={(v) => setF({ ...f, paidTo: v })} people={payees} compact placeholder="Paid to — vendor (optional)" icon={Store} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={splitOn} onChange={(e) => setSplitOn(e.target.checked)} className="w-4 h-4 rounded accent-slate-900" />
            <Divide className="w-3.5 h-3.5 text-slate-400" /> Split this expense
          </label>
          {splitOn && <SplitEditor amount={f.amount} people={people} shares={shares} setShares={setShares} />}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Receipt photos <span className="text-slate-400 font-normal">(optional, up to {MAX_PHOTOS})</span></p>
            <PhotoPicker photos={photos} setPhotos={setPhotos} />
          </div>
          {err && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
      )}
    </Card>
  );
}
