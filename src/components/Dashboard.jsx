import { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Pencil, Calendar, ChevronDown, Sparkles,
  Users, Store, Divide, Tag,
} from "lucide-react";
import { PALETTE } from "../lib/constants";
import { fmtINR, fmtINRshort, monthKey, monthLabel } from "../lib/format";
import { resolveBudget } from "../lib/helpers";
import { Card, Pill } from "./ui/Card";

function Stat({ label, value, exact, sub, accent, icon: Icon, trend }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight truncate" title={exact || undefined}>{value}</p>
          {exact && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{exact}</p>}
          {sub && (
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-rose-500" />}
              {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />}
              <span className={trend === "up" ? "text-rose-500 font-medium" : trend === "down" ? "text-emerald-600 font-medium" : "text-slate-400"}>{sub}</span>
            </div>
          )}
        </div>
        {Icon && <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: (accent || "#64748b") + "1A" }}><Icon className="w-4.5 h-4.5" style={{ color: accent || "#64748b" }} /></div>}
      </div>
    </Card>
  );
}

function BudgetCard({ mk, isCurrent, budgets, spent, canEdit, onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { amount: budget, from } = resolveBudget(budgets, mk);
  const inherited = budget !== null && from !== mk;
  if (!budget && !canEdit) return null;
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  const left = budget ? budget - spent : 0;
  const color = !budget ? "#cbd5e1" : left < 0 ? "#f43f5e" : pct > 80 ? "#f59e0b" : "#10b981";
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="w-4 h-4 text-slate-500 shrink-0" />
          <h3 className="font-semibold text-slate-800">Budget</h3>
          <span className="text-xs text-slate-400">· {monthLabel(mk)}{inherited ? ` · inherited from ${monthLabel(from)}` : ""}</span>
        </div>
        {canEdit && !editing && (
          <button onClick={() => { setDraft(budget ? String(budget) : ""); setEditing(true); }} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <Pencil className="w-3 h-3" /> {budget ? "Edit" : "Set monthly budget"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1 max-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
            <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))} onKeyDown={(e) => e.key === "Enter" && (onSet(mk, parseFloat(draft) || null), setEditing(false))}
              placeholder="e.g. 50000" className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-sm font-semibold" />
          </div>
          <button onClick={() => { onSet(mk, parseFloat(draft) || null); setEditing(false); }} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Save</button>
          {budget && from === mk && <button onClick={() => { onSet(mk, null); setEditing(false); }} className="px-3 py-2 rounded-xl text-rose-600 text-sm hover:bg-rose-50">Remove</button>}
          <button onClick={() => setEditing(false)} className="px-2 py-2 rounded-xl text-slate-500 text-sm hover:bg-slate-100">Cancel</button>
        </div>
      ) : budget ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm mb-1.5 flex-wrap gap-1">
            <span className="text-slate-600">Spent <strong className="text-slate-900">{fmtINR(spent)}</strong> of {fmtINR(budget)}</span>
            <span className={`font-semibold ${left < 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {left < 0 ? `Over by ${fmtINR(-left)}` : `${fmtINR(left)} left`}
            </span>
          </div>
          {left < 0 ? (
            <>
              {/* over budget: full bar = total spent; amber = the budget, red = the overrun */}
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="h-full transition-all" style={{ width: `${(budget / spent) * 100}%`, background: "#f59e0b" }} />
                <div className="h-full transition-all border-l-2 border-white" style={{ width: `${((spent - budget) / spent) * 100}%`, background: "#f43f5e" }} />
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-slate-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} /> budget {fmtINRshort(budget)}</span>
                <span className="text-rose-500 font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#f43f5e" }} /> over {fmtINRshort(spent - budget)} · {Math.round((spent / budget) * 100)}% used</span>
              </div>
            </>
          ) : (
            <>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{Math.round((spent / budget) * 100)}% used{isCurrent ? "" : " · full month"}</p>
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 mt-2">No budget set for this month. Set one to track spends against it — future months inherit it automatically.</p>
      )}
    </Card>
  );
}

export function Dashboard({ expenses, categories, myName, budgets, onSetBudget, canEdit }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const [pieScope, setPieScope] = useState("month");
  const [payeeScopeAll, setPayeeScopeAll] = useState(true);
  const [paidScopeAll, setPaidScopeAll] = useState(false);
  const now = new Date();
  const currentMK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selMK, setSelMK] = useState(currentMK);

  /* selectable months: first transaction month → current month */
  const monthOptions = useMemo(() => {
    const first = expenses.length ? expenses.reduce((m, e) => (monthKey(e.date) < m ? monthKey(e.date) : m), currentMK) : currentMK;
    const out = [];
    let [y, m] = first.split("-").map(Number);
    while (true) {
      const mk = `${y}-${String(m).padStart(2, "0")}`;
      out.push(mk);
      if (mk >= currentMK) break;
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return out.reverse(); // newest first
  }, [expenses, currentMK]);

  const isCurrent = selMK === currentMK;
  const thisMK = selMK;
  const [sy, sm] = selMK.split("-").map(Number);
  const last = new Date(sy, sm - 2, 1);
  const lastMK = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
  const thisM = expenses.filter((e) => monthKey(e.date) === thisMK);
  const lastM = expenses.filter((e) => monthKey(e.date) === lastMK);
  const thisTotal = thisM.reduce((s, e) => s + e.amount, 0);
  const lastTotal = lastM.reduce((s, e) => s + e.amount, 0);
  const pct = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : null;
  const days = isCurrent ? now.getDate() : new Date(sy, sm, 0).getDate();
  const dailyAvg = days > 0 ? thisTotal / days : 0;
  const monthPill = isCurrent ? "This month" : monthLabel(selMK);

  const catThis = {};
  thisM.forEach((e) => { catThis[e.category] = (catThis[e.category] || 0) + e.amount; });
  let biggest = null;
  Object.entries(catThis).forEach(([c, v]) => { if (!biggest || v > biggest.v) biggest = { c, v }; });

  const src = pieScope === "month" ? thisM : expenses;
  const pt = {};
  src.forEach((e) => { pt[e.category] = (pt[e.category] || 0) + e.amount; });
  const pieData = Object.entries(pt).map(([c, v]) => ({ name: catMap[c]?.name || "Other", value: v, color: catMap[c]?.color || "#94a3b8", emoji: catMap[c]?.emoji || "📦" })).sort((a, b) => b.value - a.value);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(sy, sm - 1 - i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trend.push({ month: monthLabel(mk), total: expenses.filter((e) => monthKey(e.date) === mk).reduce((s, e) => s + e.amount, 0), current: mk === thisMK });
  }

  const paid = {};
  (paidScopeAll ? expenses : thisM).forEach((e) => { const k = e.paidBy || "Me"; paid[k] = (paid[k] || 0) + e.amount; });
  const paidList = Object.entries(paid).sort((a, b) => b[1] - a[1]);
  const paidGrand = paidList.reduce((s, [, v]) => s + v, 0);
  const myShare = (paid[myName] || 0) + (myName !== "Me" ? (paid["Me"] || 0) : 0);

  /* paid to (payees/vendors) */
  const pt2 = {};
  (payeeScopeAll ? expenses : thisM).forEach((e) => { if (e.paidTo) pt2[e.paidTo] = (pt2[e.paidTo] || 0) + e.amount; });
  const payeeData = Object.entries(pt2).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  const payeeGrand = payeeData.reduce((s, d) => s + d.value, 0);
  const hasPayees = expenses.some((e) => e.paidTo);

  /* payments to payees, last 6 months */
  const payeeTrend = [];
  if (hasPayees) {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(sy, sm - 1 - i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      payeeTrend.push({ month: monthLabel(mk), total: expenses.filter((e) => e.paidTo && monthKey(e.date) === mk).reduce((s, e) => s + e.amount, 0), current: mk === thisMK });
    }
  }

  /* balances from split expenses (all time): paid minus own share */
  const bal = {};
  expenses.forEach((e) => {
    if (!e.split) return;
    const payer = e.paidBy || "Me";
    bal[payer] = bal[payer] || { paid: 0, share: 0 };
    bal[payer].paid += e.amount;
    Object.entries(e.split).forEach(([n, v]) => { bal[n] = bal[n] || { paid: 0, share: 0 }; bal[n].share += Number(v) || 0; });
  });
  const balances = Object.entries(bal)
    .map(([n, x]) => ({ name: n, net: Math.round((x.paid - x.share) * 100) / 100 }))
    .filter((b) => Math.abs(b.net) >= 0.01)
    .sort((a, b) => b.net - a.net);

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4"><Sparkles className="w-7 h-7 text-emerald-500" /></div>
        <h3 className="text-lg font-semibold text-slate-800">No expenses yet</h3>
        <p className="text-slate-500 text-sm mt-1 max-w-xs">Add your first expense above and your insights will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* global month selector — drives every "this month" view below */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select value={selMK} onChange={(e) => setSelMK(e.target.value)}
            className="appearance-none pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 outline-none focus:border-slate-400">
            {monthOptions.map((mk) => <option key={mk} value={mk}>{mk === currentMK ? `This month · ${monthLabel(mk)}` : monthLabel(mk)}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {!isCurrent && (
          <button onClick={() => setSelMK(currentMK)} className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">Back to now</button>
        )}
      </div>

      <BudgetCard mk={selMK} isCurrent={isCurrent} budgets={budgets} spent={thisTotal} canEdit={canEdit} onSet={onSetBudget} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={isCurrent ? "Spent this month" : `Spent in ${monthLabel(selMK)}`} value={fmtINRshort(thisTotal)} exact={fmtINRshort(thisTotal) !== fmtINR(thisTotal) ? fmtINR(thisTotal) : null} accent="#5B8DEF" icon={Wallet} sub={pct === null ? "No data prior month" : `${Math.abs(pct).toFixed(0)}% vs ${monthLabel(lastMK)}`} trend={pct === null ? null : pct > 0 ? "up" : "down"} />
        <Stat label={isCurrent ? "Last month" : "Month before"} value={fmtINRshort(lastTotal)} exact={fmtINRshort(lastTotal) !== fmtINR(lastTotal) ? fmtINR(lastTotal) : null} accent="#9B7EDE" icon={Calendar} sub={monthLabel(lastMK)} />
        <Stat label="Daily average" value={fmtINRshort(dailyAvg)} exact={fmtINRshort(dailyAvg) !== fmtINR(dailyAvg) ? fmtINR(dailyAvg) : null} accent="#4FB286" icon={TrendingUp} sub={`over ${days} day${days > 1 ? "s" : ""}`} />
        <Stat label="Biggest category" accent={biggest ? catMap[biggest.c]?.color : "#94a3b8"} icon={Tag} value={biggest ? `${catMap[biggest.c]?.emoji || ""} ${catMap[biggest.c]?.name || "—"}` : "—"} sub={biggest ? fmtINR(biggest.v) : ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800">By category</h3>
            <div className="flex gap-1.5"><Pill active={pieScope === "month"} onClick={() => setPieScope("month")}>{monthPill}</Pill><Pill active={pieScope === "all"} onClick={() => setPieScope("all")}>All time</Pill></div>
          </div>
          {pieData.length === 0 ? <p className="text-sm text-slate-400 py-12 text-center">No spending in this period.</p> : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-full sm:w-44 h-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">Total</span>
                  <span className="text-base font-bold text-slate-900">{fmtINRshort(pieTotal)}</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-1.5 max-h-44 overflow-y-auto">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600 truncate flex-1">{d.emoji} {d.name}</span>
                    <span className="font-medium text-slate-900">{fmtINR(d.value)}</span>
                    <span className="text-slate-400 text-xs w-9 text-right">{pieTotal > 0 ? Math.round((d.value / pieTotal) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Who paid</h3></div>
            <div className="flex gap-1.5"><Pill active={!paidScopeAll} onClick={() => setPaidScopeAll(false)}>{monthPill}</Pill><Pill active={paidScopeAll} onClick={() => setPaidScopeAll(true)}>All time</Pill></div>
          </div>
          {paidList.length === 0 ? <p className="text-sm text-slate-400 py-12 text-center">No spending in this period.</p> : (
            <div className="space-y-3">
              {paidList.map(([person, amt], i) => {
                const p = paidGrand > 0 ? (amt / paidGrand) * 100 : 0;
                const isMe = person === myName || person.toLowerCase() === "me";
                const color = isMe ? "#5B8DEF" : PALETTE[(i + 1) % PALETTE.length];
                return (
                  <div key={person}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: color }}>{person.slice(0, 1).toUpperCase()}</span>
                        {person}{isMe ? " (you)" : ""}
                      </span>
                      <span className="font-semibold text-slate-900">{fmtINR(amt)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: color }} /></div>
                  </div>
                );
              })}
              <div className="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>You paid <strong className="text-slate-700">{fmtINR(myShare)}</strong></span>
                <span>Others covered <strong className="text-slate-700">{fmtINR(paidGrand - myShare)}</strong></span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {(hasPayees || balances.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hasPayees && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Store className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Paid to</h3></div>
                <div className="flex gap-1.5"><Pill active={!payeeScopeAll} onClick={() => setPayeeScopeAll(false)}>{monthPill}</Pill><Pill active={payeeScopeAll} onClick={() => setPayeeScopeAll(true)}>All time</Pill></div>
              </div>
              {payeeData.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No payee payments in this period.</p> : (
                <>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-full sm:w-44 h-44 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={payeeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                            {payeeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">Total</span>
                        <span className="text-base font-bold text-slate-900">{fmtINRshort(payeeGrand)}</span>
                      </div>
                    </div>
                    <div className="flex-1 w-full space-y-1.5 max-h-44 overflow-y-auto">
                      {payeeData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-slate-600 truncate flex-1">{d.name}</span>
                          <span className="font-medium text-slate-900">{fmtINR(d.value)}</span>
                          <span className="text-slate-400 text-xs w-9 text-right">{payeeGrand > 0 ? Math.round((d.value / payeeGrand) * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {payeeTrend.some((t) => t.total > 0) && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">Payments to payees · last 6 months</p>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={payeeTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={fmtINRshort} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => fmtINR(v)} cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                            <Bar dataKey="total" radius={[5, 5, 0, 0]} maxBarSize={36}>
                              {payeeTrend.map((d, i) => <Cell key={i} fill={d.current ? "#3FB8C4" : "#cbd5e1"} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
          {balances.length > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3"><Divide className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Balances</h3><span className="text-xs text-slate-400">· from split expenses, all time</span></div>
              <div className="space-y-2">
                {balances.map((b) => (
                  <div key={b.name} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 text-sm">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ${b.net > 0 ? "bg-emerald-500" : "bg-rose-400"}`}>{b.name.slice(0, 1).toUpperCase()}</span>
                      {b.name}{b.name === myName ? " (you)" : ""}
                    </span>
                    <span className={`font-semibold ${b.net > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {b.net > 0 ? `gets back ${fmtINR(b.net)}` : `owes ${fmtINR(-b.net)}`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <h3 className="font-semibold text-slate-800 mb-3">{isCurrent ? "Last 6 months" : `6 months to ${monthLabel(selMK)}`}</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtINRshort} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtINR(v)} cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {trend.map((d, i) => <Cell key={i} fill={d.current ? "#5B8DEF" : "#cbd5e1"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
