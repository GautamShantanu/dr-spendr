import { useState, useEffect, useMemo } from "react";
import {
  Users, Store, Divide, Paperclip, Check, X, Pencil, Trash2,
  Search, ArrowUpDown, Filter, Receipt, ChevronDown,
} from "lucide-react";
import { PAYMENT_METHODS } from "../lib/constants";
import { fmtINR } from "../lib/format";
import { methodMeta, buildSplit } from "../lib/helpers";
import { Card } from "./ui/Card";
import { CategoryInput } from "./ui/CategoryInput";
import { PaidByInput } from "./ui/PaidByInput";
import { ComboFilter } from "./ui/ComboFilter";
import { SplitEditor } from "./SplitEditor";
import { PhotoPicker, AttachmentViewer } from "./PhotoPicker";

function TxnRow({ expense, cat, myName, canEdit, onEdit, onDelete, onViewPhotos, onFilter }) {
  const [confirm, setConfirm] = useState(false);
  const M = methodMeta(expense.method);
  const dateLabel = new Date(expense.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const notMe = (expense.paidBy || "Me") !== myName && (expense.paidBy || "").toLowerCase() !== "me";
  const splitCount = expense.split ? Object.keys(expense.split).length : 0;
  return (
    <Card className="p-3 sm:px-4 group hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: (cat?.color || "#94a3b8") + "1F" }}>{cat?.emoji || "📦"}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800 break-words line-clamp-2">{expense.description || cat?.name || "Expense"}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
            <button onClick={() => onFilter({ from: expense.date, to: expense.date })} className="hover:text-slate-700 hover:underline" title="Show this day only">{dateLabel}</button><span className="text-slate-300">·</span>
            <button onClick={() => onFilter({ method: expense.method })} className="flex items-center gap-1 hover:text-slate-700 hover:underline" title={`Filter: ${M.label}`}><M.icon className="w-3 h-3" />{M.label}</button><span className="text-slate-300">·</span>
            <button onClick={() => onFilter({ category: expense.category })} className="hover:text-slate-700 hover:underline" title={`Filter: ${cat?.name}`}>{cat?.name}</button>
            <span className="text-slate-300">·</span><button onClick={() => onFilter({ person: expense.paidBy || "Me" })} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium ${notMe ? "text-amber-600 bg-amber-50 hover:bg-amber-100" : "text-slate-500 bg-slate-100 hover:bg-slate-200"}`} title={`Filter: paid by ${expense.paidBy}`}><Users className="w-3 h-3" />{expense.paidBy}</button>
            {expense.paidTo && (<><span className="text-slate-300">·</span><button onClick={() => onFilter({ payee: expense.paidTo })} className="inline-flex items-center gap-1 text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-md font-medium hover:bg-sky-100" title={`Filter: paid to ${expense.paidTo}`}><Store className="w-3 h-3" />{expense.paidTo}</button></>)}
            {splitCount > 0 && (<><span className="text-slate-300">·</span><span className="inline-flex items-center gap-1 text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded-md font-medium" title={Object.entries(expense.split).map(([n, v]) => `${n}: ${fmtINR(v)}`).join(", ")}><Divide className="w-3 h-3" />÷{splitCount}</span></>)}
            {expense.attachments?.length > 0 && (<><span className="text-slate-300">·</span><button onClick={onViewPhotos} className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-medium hover:bg-emerald-100"><Paperclip className="w-3 h-3" />{expense.attachments.length}</button></>)}
          </div>
        </div>
        <p className="font-semibold text-slate-900 shrink-0">{fmtINR(expense.amount)}</p>
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            {confirm ? (
              <div className="flex items-center gap-1">
                <button onClick={onDelete} className="p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600"><Check className="w-4 h-4" /></button>
                <button onClick={() => setConfirm(false)} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setConfirm(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function EditRow({ expense, categories, people, payees, onSave, onCancel }) {
  const [f, setF] = useState({ ...expense, amount: String(expense.amount), paidTo: expense.paidTo || "" });
  const [splitOn, setSplitOn] = useState(!!expense.split);
  const [shares, setShares] = useState(expense.split ? Object.fromEntries(Object.entries(expense.split).map(([k, v]) => [k, String(v)])) : {});
  const [keepPaths, setKeepPaths] = useState(expense.attachments || []);
  const [removedPaths, setRemovedPaths] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [err, setErr] = useState("");
  const save = () => {
    const amt = parseFloat(f.amount);
    if (!amt || amt <= 0) return;
    let split = null;
    if (splitOn) {
      const res = buildSplit(shares, people, amt);
      if (res.error) { setErr(res.error); return; }
      split = res.split;
    }
    onSave({ ...f, amount: amt, paidBy: (f.paidBy || "Me").trim() || "Me", paidTo: (f.paidTo || "").trim(), description: f.description.trim(), split, attachments: keepPaths }, photos.map((p) => p.blob), removedPaths);
  };
  return (
    <Card className="p-3 sm:p-4 border-slate-300 ring-2 ring-slate-100">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
          <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^0-9.]/g, "") })} className="w-full pl-6 pr-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:border-slate-400" />
        </div>
        <CategoryInput value={f.category} onChange={(id) => setF({ ...f, category: id })} categories={categories} compact />
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Note" className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />
        <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className="px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400">
          {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <PaidByInput value={f.paidBy} onChange={(v) => setF({ ...f, paidBy: v })} people={people} compact />
        <PaidByInput value={f.paidTo} onChange={(v) => setF({ ...f, paidTo: v })} people={payees} compact placeholder="Paid to (optional)" icon={Store} />
      </div>
      <label className="mt-2.5 flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <input type="checkbox" checked={splitOn} onChange={(e) => setSplitOn(e.target.checked)} className="w-4 h-4 rounded accent-slate-900" />
        <Divide className="w-3.5 h-3.5 text-slate-400" /> Split this expense
      </label>
      {splitOn && <div className="mt-2"><SplitEditor amount={f.amount} people={people} shares={shares} setShares={setShares} /></div>}
      <div className="mt-2.5">
        <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Receipt photos</p>
        <PhotoPicker photos={photos} setPhotos={setPhotos} existing={keepPaths} onRemoveExisting={(p) => { setKeepPaths((k) => k.filter((x) => x !== p)); setRemovedPaths((r) => [...r, p]); }} />
      </div>
      {err && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mt-2">{err}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={save} className="px-4 py-1.5 rounded-lg text-sm bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"><Check className="w-4 h-4" /> Save</button>
      </div>
    </Card>
  );
}

export function Transactions({ expenses, categories, people, payees, myName, canEdit, bucketId, onUpdate, onDelete }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewPaths, setViewPaths] = useState(null);
  const [filters, setFilters] = useState({ from: "", to: "", category: "all", method: "all", person: "all", payee: "all" });
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filters, search, sortBy, sortDir]);
  // switching buckets is a fresh context — clear filters/search/edit (but
  // editing or a background refetch within a bucket keeps everything)
  useEffect(() => {
    setFilters({ from: "", to: "", category: "all", method: "all", person: "all", payee: "all" });
    setSearch(""); setEditId(null); setShowFilters(false);
  }, [bucketId]);

  const filtered = useMemo(() => {
    let list = expenses.filter((e) => {
      if (filters.from && e.date < filters.from) return false;
      if (filters.to && e.date > filters.to) return false;
      if (filters.category !== "all" && e.category !== filters.category) return false;
      if (filters.method !== "all" && e.method !== filters.method) return false;
      if (filters.person !== "all" && (e.paidBy || "Me") !== filters.person) return false;
      if (filters.payee !== "all" && (e.paidTo || "") !== filters.payee) return false;
      if (search) {
        const q = search.toLowerCase();
        const cat = catMap[e.category]?.name.toLowerCase() || "";
        if (!e.description.toLowerCase().includes(q) && !cat.includes(q) && !(e.paidBy || "").toLowerCase().includes(q) && !(e.paidTo || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      let cmp = sortBy === "amount" ? a.amount - b.amount : a.date.localeCompare(b.date);
      if (cmp === 0) cmp = String(a.id).localeCompare(String(b.id));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [expenses, filters, search, sortBy, sortDir, catMap]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const peopleInData = useMemo(() => Array.from(new Set([...people, ...expenses.map((e) => e.paidBy || "Me")])), [people, expenses]);
  const payeesInData = useMemo(() => Array.from(new Set([...payees, ...expenses.map((e) => e.paidTo).filter(Boolean)])), [payees, expenses]);
  const activeFilters = Object.entries(filters).filter(([, v]) => v && v !== "all").length;
  const toggleSort = (k) => { if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortBy(k); setSortDir("desc"); } };
  const resetFilters = () => { setFilters({ from: "", to: "", category: "all", method: "all", person: "all", payee: "all" }); setSearch(""); };

  return (
    <div className="space-y-3">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, categories, people…" className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
            {search && <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => toggleSort("date")} className={`px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-1.5 ${sortBy === "date" ? "border-slate-400 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>Date {sortBy === "date" && <ArrowUpDown className="w-3.5 h-3.5" />}</button>
            <button onClick={() => toggleSort("amount")} className={`px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-1.5 ${sortBy === "amount" ? "border-slate-400 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>Amount {sortBy === "amount" && <ArrowUpDown className="w-3.5 h-3.5" />}</button>
            <button onClick={() => setShowFilters((v) => !v)} className={`px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-1.5 relative ${showFilters || activeFilters ? "border-slate-400 bg-white text-slate-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
              <Filter className="w-4 h-4" /> Filters{activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">{activeFilters}</span>}
            </button>
            {activeFilters > 0 && (
              <button onClick={resetFilters} title="Reset all filters"
                className="px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-sm font-medium flex items-center gap-1.5 hover:bg-rose-100">
                <X className="w-4 h-4" /> Reset
              </button>
            )}
          </div>
        </div>
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">From</label><div className="relative"><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="w-full px-2.5 py-2 pr-7 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />{filters.from && <button onClick={() => setFilters({ ...filters, from: "" })} aria-label="Clear from date" className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-rose-500 bg-slate-50"><X className="w-3.5 h-3.5" /></button>}</div></div>
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">To</label><div className="relative"><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="w-full px-2.5 py-2 pr-7 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />{filters.to && <button onClick={() => setFilters({ ...filters, to: "" })} aria-label="Clear to date" className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-rose-500 bg-slate-50"><X className="w-3.5 h-3.5" /></button>}</div></div>
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Category</label><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400"><option value="all">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</select></div>
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Payment</label><select value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400"><option value="all">All</option>{PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Paid by</label><ComboFilter value={filters.person} onChange={(v) => setFilters({ ...filters, person: v })} options={peopleInData} placeholder="All — type to search" /></div>
            {payeesInData.length > 0 && <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Paid to</label><ComboFilter value={filters.payee} onChange={(v) => setFilters({ ...filters, payee: v })} options={payeesInData} placeholder="All — type to search" /></div>}
            {activeFilters > 0 && <button onClick={resetFilters} className="col-span-2 lg:col-span-5 text-xs text-slate-500 hover:text-rose-500 text-left">Clear all filters</button>}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between px-1 text-sm">
        <span className="text-slate-500">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</span>
        <span className="text-slate-500">Total: <strong className="text-slate-900">{fmtINR(total)}</strong></span>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-10 text-center"><Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-slate-400 text-sm">No transactions match your filters.</p></Card>
        ) : filtered.slice(0, visibleCount).map((e) => editId === e.id ? (
          <EditRow key={e.id} expense={e} categories={categories} people={peopleInData} payees={payeesInData} onCancel={() => setEditId(null)} onSave={(u, files, removed) => { onUpdate(u, files, removed); setEditId(null); }} />
        ) : (
          <TxnRow key={e.id} expense={e} cat={catMap[e.category]} myName={myName} canEdit={canEdit} onEdit={() => setEditId(e.id)} onDelete={() => onDelete(e.id)} onViewPhotos={() => setViewPaths(e.attachments)}
            onFilter={(patch) => { setFilters((f) => ({ ...f, ...patch })); setShowFilters(true); }} />
        ))}
      </div>
      {filtered.length > visibleCount && (
        <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          className="w-full py-3 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2">
          <ChevronDown className="w-4 h-4" />
          Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
          <span className="text-slate-400 font-normal">· {visibleCount} of {filtered.length} shown</span>
        </button>
      )}
      {viewPaths && <AttachmentViewer paths={viewPaths} onClose={() => setViewPaths(null)} />}
    </div>
  );
}
