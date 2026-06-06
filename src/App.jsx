import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Search, Trash2, Pencil, X, Check, Settings as SettingsIcon,
  LayoutDashboard, Receipt, Users, Filter, ChevronDown, AlertTriangle,
  Calendar, CreditCard, Loader2, ArrowUpDown, Tag, Banknote, Smartphone,
  MoreHorizontal, Sparkles, Wallet, TrendingUp, TrendingDown, LogOut,
  ChevronsUpDown, UserPlus, Mail, Share2, Crown, Download, Upload, Lock,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { supabase, isConfigured } from "./supabaseClient";

/* ============================== constants ============================== */

const DEFAULT_CATEGORIES = [
  { id: "food", name: "Food", emoji: "🍜", color: "#F4845F" },
  { id: "transport", name: "Transport", emoji: "🚕", color: "#5B8DEF" },
  { id: "groceries", name: "Groceries", emoji: "🛒", color: "#4FB286" },
  { id: "rent", name: "Rent/Bills", emoji: "🏠", color: "#9B7EDE" },
  { id: "shopping", name: "Shopping", emoji: "🛍️", color: "#E86FA8" },
  { id: "health", name: "Health", emoji: "💊", color: "#3FB8C4" },
  { id: "entertainment", name: "Entertainment", emoji: "🎬", color: "#F2B33D" },
  { id: "travel", name: "Travel", emoji: "✈️", color: "#6CC4A1" },
  { id: "other", name: "Other", emoji: "📦", color: "#9AA5B1" },
];
const PALETTE = ["#5B8DEF","#F4845F","#4FB286","#9B7EDE","#E86FA8","#3FB8C4","#F2B33D","#6CC4A1","#EE6C6C","#7A93FF"];
const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "other", label: "Other", icon: MoreHorizontal },
];
const EMOJI_CHOICES = ["🍜","🍕","☕","🛒","🚕","🚗","⛽","🏠","💡","📱","🛍️","👕","💊","🏥","🎬","🎮","🎵","✈️","🏨","🏝️","📦","🎁","💰","📚","🐶","💪","💅","🍻"];
const BUCKET_EMOJIS = ["💼","🏠","🧑‍🤝‍🧑","❤️","🛫","🎉","💰","🏖️","🍽️","🚗","🐱","🎓"];

const fmtINR = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtINRshort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return "₹" + (v / 1e7).toFixed(2) + "Cr";
  if (v >= 1e5) return "₹" + (v / 1e5).toFixed(2) + "L";
  if (v >= 1e3) return "₹" + (v / 1e3).toFixed(1) + "k";
  return "₹" + v.toFixed(0);
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthKey = (s) => (s || "").slice(0, 7);
const monthLabel = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
};

const rowToExpense = (r) => ({
  id: r.id, amount: Number(r.amount), category: r.category, description: r.description || "",
  date: r.date, method: r.method, paidBy: r.paid_by || "Me",
});

/* ============================== primitives ============================== */

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm ${className}`}>{children}</div>
);
const Pill = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{children}</button>
);

function PaidByInput({ value, onChange, people, compact }) {
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
        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Paid by"
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

/* ============================== auth screen ============================== */

function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const submit = async () => {
    setErr(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(), password,
          options: { data: { display_name: name.trim() || email.split("@")[0] } },
        });
        if (error) throw error;
        if (data.user && !data.session) setInfo("Account created. If email confirmation is on, check your inbox — otherwise just sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e.message || "Something went wrong.");
    } finally { setBusy(false); }
  };

  const google = async () => {
    setErr(""); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (e) {
      setErr("Google sign-in isn't configured yet — see the setup guide, or use email & password.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mb-3 shadow-lg">
            <Wallet className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Spendr</h1>
          <p className="text-sm text-slate-500">Personal & shared expense tracking</p>
        </div>

        <Card className="p-5">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
            {["signin", "signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setErr(""); setInfo(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {mode === "signup" && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (shown on shared expenses)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Password"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
            </div>

            {err && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
            {info && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{info}</p>}

            <button onClick={submit} disabled={busy || !email || !password}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button onClick={google} disabled={busy}
              className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 flex items-center justify-center gap-2 text-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/></svg>
              Continue with Google
            </button>
          </div>
        </Card>
        <p className="text-center text-[11px] text-slate-400 mt-4">Your data is private to your account and anyone you invite.</p>
      </div>
    </div>
  );
}

/* ============================== bucket switcher ============================== */

function BucketSwitcher({ buckets, selectedId, onSelect, onNew, onManage, memberCounts }) {
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

/* ============================== manage bucket modal ============================== */

function ManageBucketModal({ bucket, members, isOwner, myEmail, onClose, onRename, onInvite, onRemoveMember, onLeave, onDelete }) {
  const [name, setName] = useState(bucket.name);
  const [emoji, setEmoji] = useState(bucket.emoji || "💼");
  const [invite, setInvite] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doInvite = async () => {
    const e = invite.trim().toLowerCase();
    setMsg("");
    if (!e || !e.includes("@")) { setMsg("Enter a valid email."); return; }
    const res = await onInvite(e);
    if (res?.error) setMsg(res.error); else { setInvite(""); setMsg(`Invited ${e}.`); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Manage bucket</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* name + emoji */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Name</label>
            <div className="flex gap-2">
              <div className="relative">
                <button type="button" className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 text-xl" disabled={!isOwner}>{emoji}</button>
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 disabled:opacity-60" />
              {isOwner && (
                <button onClick={() => onRename(name.trim() || bucket.name, emoji)} className="px-4 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800">Save</button>
              )}
            </div>
            {isOwner && (
              <div className="flex flex-wrap gap-1 mt-2">
                {BUCKET_EMOJIS.map((em) => (
                  <button key={em} onClick={() => setEmoji(em)} className={`w-8 h-8 rounded-lg text-base hover:bg-slate-100 ${emoji === em ? "bg-slate-200 ring-1 ring-slate-400" : ""}`}>{em}</button>
                ))}
              </div>
            )}
          </div>

          {/* members */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">People with access</label>
            <div className="space-y-1.5">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100">
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-semibold shrink-0">{m.email.slice(0, 1).toUpperCase()}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-700 truncate">{m.email}{m.email === myEmail ? " (you)" : ""}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">{m.role === "owner" && <Crown className="w-3 h-3 text-amber-500" />}{m.role}</span>
                  </span>
                  {isOwner && m.role !== "owner" && (
                    <button onClick={() => onRemoveMember(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* invite */}
          {isOwner && (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Invite someone by email</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={invite} onChange={(e) => setInvite(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doInvite()} placeholder="name@email.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
                </div>
                <button onClick={doInvite} className="px-4 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700">Invite</button>
              </div>
              {msg && <p className="text-xs text-slate-500 mt-1.5">{msg}</p>}
              <p className="text-[11px] text-slate-400 mt-1.5">They get access the moment they sign in with that email.</p>
            </div>
          )}

          {/* danger */}
          <div className="pt-3 border-t border-slate-100">
            {isOwner ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button onClick={onDelete} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete bucket & all its expenses</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-xl text-slate-600 text-sm hover:bg-slate-100">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete this bucket</button>
              )
            ) : (
              <button onClick={onLeave} className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Leave this bucket</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== quick add ============================== */

function QuickAdd({ categories, people, defaultPaidBy, onAdd }) {
  const blank = { amount: "", category: categories[0]?.id || "other", description: "", date: todayStr(), method: "upi", paidBy: defaultPaidBy };
  const [f, setF] = useState(blank);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const amountRef = useRef(null);

  useEffect(() => { setF((p) => ({ ...p, category: categories[0]?.id || "other" })); /* eslint-disable-next-line */ }, [categories]);

  const submit = async () => {
    const amt = parseFloat(f.amount);
    if (!amt || amt <= 0) { amountRef.current?.focus(); return; }
    setBusy(true);
    await onAdd({ amount: amt, category: f.category, description: f.description.trim(), date: f.date, method: f.method, paidBy: (f.paidBy || defaultPaidBy).trim() || defaultPaidBy });
    setBusy(false);
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
        <div className="relative flex-1">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="w-full appearance-none px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 pr-9">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Note (optional)"
          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800" />
        <button onClick={submit} disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 active:scale-[0.98] transition flex items-center justify-center gap-1.5 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
        </button>
      </div>
      <button onClick={() => setExpanded((v) => !v)} className="mt-2.5 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} /> {expanded ? "Less" : "Date, payment & who paid"}
      </button>
      {expanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
        </div>
      )}
    </Card>
  );
}

/* ============================== stat + dashboard ============================== */

function Stat({ label, value, sub, accent, icon: Icon, trend }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight truncate">{value}</p>
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

function Dashboard({ expenses, categories, myName }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const [pieScope, setPieScope] = useState("month");
  const now = new Date();
  const thisMK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMK = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
  const thisM = expenses.filter((e) => monthKey(e.date) === thisMK);
  const lastM = expenses.filter((e) => monthKey(e.date) === lastMK);
  const thisTotal = thisM.reduce((s, e) => s + e.amount, 0);
  const lastTotal = lastM.reduce((s, e) => s + e.amount, 0);
  const pct = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : null;
  const days = now.getDate();
  const dailyAvg = days > 0 ? thisTotal / days : 0;

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
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trend.push({ month: monthLabel(mk), total: expenses.filter((e) => monthKey(e.date) === mk).reduce((s, e) => s + e.amount, 0), current: mk === thisMK });
  }

  const paid = {};
  thisM.forEach((e) => { const k = e.paidBy || "Me"; paid[k] = (paid[k] || 0) + e.amount; });
  const paidList = Object.entries(paid).sort((a, b) => b[1] - a[1]);
  const paidGrand = paidList.reduce((s, [, v]) => s + v, 0);
  const myShare = (paid[myName] || 0) + (myName !== "Me" ? (paid["Me"] || 0) : 0);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Spent this month" value={fmtINR(thisTotal)} accent="#5B8DEF" icon={Wallet} sub={pct === null ? "No data last month" : `${Math.abs(pct).toFixed(0)}% vs last month`} trend={pct === null ? null : pct > 0 ? "up" : "down"} />
        <Stat label="Last month" value={fmtINR(lastTotal)} accent="#9B7EDE" icon={Calendar} sub={monthLabel(lastMK)} />
        <Stat label="Daily average" value={fmtINR(dailyAvg)} accent="#4FB286" icon={TrendingUp} sub={`over ${days} day${days > 1 ? "s" : ""}`} />
        <Stat label="Biggest category" accent={biggest ? catMap[biggest.c]?.color : "#94a3b8"} icon={Tag} value={biggest ? `${catMap[biggest.c]?.emoji || ""} ${catMap[biggest.c]?.name || "—"}` : "—"} sub={biggest ? fmtINR(biggest.v) : ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800">By category</h3>
            <div className="flex gap-1.5"><Pill active={pieScope === "month"} onClick={() => setPieScope("month")}>This month</Pill><Pill active={pieScope === "all"} onClick={() => setPieScope("all")}>All time</Pill></div>
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
          <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Who paid</h3><span className="text-xs text-slate-400">· this month</span></div>
          {paidList.length === 0 ? <p className="text-sm text-slate-400 py-12 text-center">No spending this month.</p> : (
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

      <Card className="p-4 sm:p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Last 6 months</h3>
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

/* ============================== transactions ============================== */

const methodMeta = (id) => PAYMENT_METHODS.find((m) => m.id === id) || PAYMENT_METHODS[3];

function TxnRow({ expense, cat, myName, onEdit, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const M = methodMeta(expense.method);
  const dateLabel = new Date(expense.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const notMe = (expense.paidBy || "Me") !== myName && (expense.paidBy || "").toLowerCase() !== "me";
  return (
    <Card className="p-3 sm:px-4 group hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: (cat?.color || "#94a3b8") + "1F" }}>{cat?.emoji || "📦"}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800 truncate">{expense.description || cat?.name || "Expense"}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
            <span>{dateLabel}</span><span className="text-slate-300">·</span>
            <span className="flex items-center gap-1"><M.icon className="w-3 h-3" />{M.label}</span><span className="text-slate-300">·</span>
            <span>{cat?.name}</span>
            {notMe && (<><span className="text-slate-300">·</span><span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md font-medium"><Users className="w-3 h-3" />{expense.paidBy}</span></>)}
          </div>
        </div>
        <p className="font-semibold text-slate-900 shrink-0">{fmtINR(expense.amount)}</p>
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
      </div>
    </Card>
  );
}

function EditRow({ expense, categories, people, onSave, onCancel }) {
  const [f, setF] = useState({ ...expense, amount: String(expense.amount) });
  const save = () => {
    const amt = parseFloat(f.amount);
    if (!amt || amt <= 0) return;
    onSave({ ...f, amount: amt, paidBy: (f.paidBy || "Me").trim() || "Me", description: f.description.trim() });
  };
  return (
    <Card className="p-3 sm:p-4 border-slate-300 ring-2 ring-slate-100">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
          <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^0-9.]/g, "") })} className="w-full pl-6 pr-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:border-slate-400" />
        </div>
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Note" className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" />
        <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className="px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400">
          {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <PaidByInput value={f.paidBy} onChange={(v) => setF({ ...f, paidBy: v })} people={people} compact />
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={save} className="px-4 py-1.5 rounded-lg text-sm bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"><Check className="w-4 h-4" /> Save</button>
      </div>
    </Card>
  );
}

function Transactions({ expenses, categories, people, myName, onUpdate, onDelete }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filters, setFilters] = useState({ from: "", to: "", category: "all", method: "all", person: "all" });

  const filtered = useMemo(() => {
    let list = expenses.filter((e) => {
      if (filters.from && e.date < filters.from) return false;
      if (filters.to && e.date > filters.to) return false;
      if (filters.category !== "all" && e.category !== filters.category) return false;
      if (filters.method !== "all" && e.method !== filters.method) return false;
      if (filters.person !== "all" && (e.paidBy || "Me") !== filters.person) return false;
      if (search) {
        const q = search.toLowerCase();
        const cat = catMap[e.category]?.name.toLowerCase() || "";
        if (!e.description.toLowerCase().includes(q) && !cat.includes(q) && !(e.paidBy || "").toLowerCase().includes(q)) return false;
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
  const activeFilters = Object.entries(filters).filter(([, v]) => v && v !== "all").length;
  const toggleSort = (k) => { if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortBy(k); setSortDir("desc"); } };

  return (
    <div className="space-y-3">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, categories, people…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => toggleSort("date")} className={`px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-1.5 ${sortBy === "date" ? "border-slate-400 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>Date {sortBy === "date" && <ArrowUpDown className="w-3.5 h-3.5" />}</button>
            <button onClick={() => toggleSort("amount")} className={`px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-1.5 ${sortBy === "amount" ? "border-slate-400 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>Amount {sortBy === "amount" && <ArrowUpDown className="w-3.5 h-3.5" />}</button>
            <button onClick={() => setShowFilters((v) => !v)} className={`px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-1.5 relative ${showFilters || activeFilters ? "border-slate-400 bg-white text-slate-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
              <Filter className="w-4 h-4" /> Filters{activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">{activeFilters}</span>}
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">From</label><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" /></div>
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">To</label><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400" /></div>
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Category</label><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400"><option value="all">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</select></div>
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Payment</label><select value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400"><option value="all">All</option>{PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Paid by</label><select value={filters.person} onChange={(e) => setFilters({ ...filters, person: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-slate-400"><option value="all">All</option>{peopleInData.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            {activeFilters > 0 && <button onClick={() => setFilters({ from: "", to: "", category: "all", method: "all", person: "all" })} className="col-span-2 lg:col-span-5 text-xs text-slate-500 hover:text-rose-500 text-left">Clear all filters</button>}
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
        ) : filtered.map((e) => editId === e.id ? (
          <EditRow key={e.id} expense={e} categories={categories} people={peopleInData} onCancel={() => setEditId(null)} onSave={(u) => { onUpdate(u); setEditId(null); }} />
        ) : (
          <TxnRow key={e.id} expense={e} cat={catMap[e.category]} myName={myName} onEdit={() => setEditId(e.id)} onDelete={() => onDelete(e.id)} />
        ))}
      </div>
    </div>
  );
}

/* ============================== settings ============================== */

function SettingsView({ categories, setCategories, people, setPeople, expenses, bucketName, myName, onRename: _ignored, displayName, onChangeName, onExport, onImport, onClearBucket, isOwner, onSignOut, userEmail }) {
  const [newCat, setNewCat] = useState({ name: "", emoji: "🏷️", color: PALETTE[0] });
  const [editCatId, setEditCatId] = useState(null);
  const [newPerson, setNewPerson] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const fileRef = useRef(null);

  const addCat = () => {
    if (!newCat.name.trim()) return;
    setCategories([...categories, { id: "c" + Date.now().toString(36), name: newCat.name.trim(), emoji: newCat.emoji, color: newCat.color }]);
    setNewCat({ name: "", emoji: "🏷️", color: PALETTE[categories.length % PALETTE.length] });
  };
  const updateCat = (id, patch) => setCategories(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCat = (id) => { if (categories.length <= 1) return; setCategories(categories.filter((c) => c.id !== id)); };
  const addPerson = () => { const n = newPerson.trim(); if (!n || people.some((p) => p.toLowerCase() === n.toLowerCase())) { setNewPerson(""); return; } setPeople([...people, n]); setNewPerson(""); };
  const deletePerson = (p) => setPeople(people.filter((x) => x !== p));

  return (
    <div className="space-y-4">
      {/* account */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Account</h3></div>
        <p className="text-sm text-slate-500 mb-1">Signed in as <strong className="text-slate-700">{userEmail}</strong></p>
        <label className="text-xs font-medium text-slate-500 block mb-1.5 mt-3">Your display name (used for "paid by")</label>
        <div className="flex gap-2">
          <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
          <button onClick={() => onChangeName(nameDraft.trim() || displayName)} className="px-4 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800">Save</button>
        </div>
        <button onClick={onSignOut} className="mt-4 text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Sign out</button>
      </Card>

      {/* categories */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><Tag className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Categories</h3><span className="text-xs text-slate-400">· for {bucketName}</span></div>
        <div className="space-y-2 mb-4">
          {categories.map((c) => editCatId === c.id ? (
            <div key={c.id} className="p-3 rounded-xl border border-slate-300 bg-slate-50 space-y-2.5">
              <div className="flex gap-2 items-center">
                <input value={c.name} onChange={(e) => updateCat(c.id, { name: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400" />
                <input type="color" value={c.color} onChange={(e) => updateCat(c.id, { color: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                <button onClick={() => setEditCatId(null)} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm flex items-center gap-1"><Check className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-1">{EMOJI_CHOICES.map((em) => <button key={em} onClick={() => updateCat(c.id, { emoji: em })} className={`w-8 h-8 rounded-lg text-base hover:bg-slate-200 ${c.emoji === em ? "bg-slate-200 ring-1 ring-slate-400" : ""}`}>{em}</button>)}</div>
            </div>
          ) : (
            <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: c.color + "1F" }}>{c.emoji}</div>
              <span className="flex-1 font-medium text-slate-700 text-sm">{c.name}</span>
              <span className="w-4 h-4 rounded-full" style={{ background: c.color }} />
              <button onClick={() => setEditCatId(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => deleteCat(c.id)} disabled={categories.length <= 1} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Add category</p>
          <div className="flex gap-2 items-center mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: newCat.color + "1F" }}>{newCat.emoji}</div>
            <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addCat()} placeholder="Category name" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400" />
            <input type="color" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer" />
            <button onClick={addCat} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center gap-1"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap gap-1">{EMOJI_CHOICES.map((em) => <button key={em} onClick={() => setNewCat({ ...newCat, emoji: em })} className={`w-8 h-8 rounded-lg text-base hover:bg-slate-200 ${newCat.emoji === em ? "bg-slate-200 ring-1 ring-slate-400" : ""}`}>{em}</button>)}</div>
        </div>
      </Card>

      {/* people */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">People</h3><span className="text-xs text-slate-400">· names for "paid by"</span></div>
        <div className="flex flex-wrap gap-2 mb-3">
          {people.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full bg-slate-100 text-sm text-slate-700">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-semibold">{p.slice(0, 1).toUpperCase()}</span>
              {p}<button onClick={() => deletePerson(p)} className="text-slate-400 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} placeholder="Add a person (partner, roommate…)" className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:bg-white focus:border-slate-400" />
          <button onClick={addPerson} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add</button>
        </div>
      </Card>

      {/* backup */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2"><Download className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Backup</h3></div>
        <p className="text-sm text-slate-500 mb-3">Export this bucket's expenses to a file you keep, or restore from one. (Recommended occasionally — the free database has no automatic backups.)</p>
        <div className="flex gap-2">
          <button onClick={onExport} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-4 h-4" /> Export JSON</button>
          <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-1.5"><Upload className="w-4 h-4" /> Import</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
        </div>
      </Card>

      {/* danger */}
      {isOwner && (
        <Card className="p-4 sm:p-5 border-rose-200 bg-rose-50/40">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-rose-500" /><h3 className="font-semibold text-rose-700">Clear this bucket</h3></div>
          <p className="text-sm text-slate-500 mb-3">Delete every expense in <strong>{bucketName}</strong>. Categories and people stay. This cannot be undone.</p>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { onClearBucket(); setConfirmClear(false); }} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete all {expenses.length} expenses</button>
              <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-600 text-sm font-medium hover:bg-rose-50">Clear all expenses</button>
          )}
        </Card>
      )}
    </div>
  );
}

/* ============================== config screen ============================== */

function ConfigScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-6 max-w-md">
        <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5 text-amber-500" /><h2 className="font-semibold text-slate-800">Almost there — add your Supabase keys</h2></div>
        <p className="text-sm text-slate-600 mb-3">This app needs two environment variables to connect to your database:</p>
        <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto">VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...</pre>
        <p className="text-sm text-slate-600 mt-3">Locally, put them in a <code className="text-xs bg-slate-100 px-1 rounded">.env</code> file. On Vercel, add them under Project → Settings → Environment Variables, then redeploy. Full steps are in <strong>SETUP.md</strong>.</p>
      </Card>
    </div>
  );
}

/* ============================== root ============================== */

export default function App() {
  if (!isConfigured) return <ConfigScreen />;

  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [people, setPeople] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState("");
  const settingsHydrated = useRef(false);

  const user = session?.user || null;
  const myEmail = (user?.email || "").toLowerCase();
  const myName = (user?.user_metadata?.display_name || myEmail.split("@")[0] || "Me");

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  /* ---- auth ---- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  /* ---- load buckets ---- */
  const loadBuckets = useCallback(async () => {
    if (!user) return;
    try {
      const { data: bks, error } = await supabase.from("buckets").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      const { data: mems } = await supabase.from("bucket_members").select("*");
      const members = mems || [];
      setAllMembers(members);

      let list = (bks || []).map((b) => {
        const mine = members.find((m) => m.bucket_id === b.id && (m.user_id === user.id || (m.email || "").toLowerCase() === myEmail));
        return { ...b, role: b.owner_id === user.id ? "owner" : (mine?.role || "member") };
      });

      if (list.length === 0) {
        // first login: create a personal bucket
        const { data: created, error: ce } = await supabase.from("buckets").insert({ name: "Personal", emoji: "💼", owner_id: user.id }).select().single();
        if (ce) throw ce;
        await supabase.from("bucket_members").insert({ bucket_id: created.id, email: myEmail, user_id: user.id, role: "owner" });
        await supabase.from("bucket_settings").insert({ bucket_id: created.id, categories: DEFAULT_CATEGORIES, people: [myName] });
        list = [{ ...created, role: "owner" }];
        setAllMembers([{ bucket_id: created.id, email: myEmail, user_id: user.id, role: "owner", id: "tmp" }]);
      }
      setBuckets(list);
      setSelectedId((prev) => (prev && list.some((b) => b.id === prev) ? prev : list[0].id));
    } catch (e) {
      flash("Couldn't load buckets — check the database setup.");
      console.error(e);
    }
  }, [user, myEmail, myName]);

  useEffect(() => { if (user) loadBuckets(); }, [user, loadBuckets]);

  /* ---- load selected bucket data ---- */
  const loadBucketData = useCallback(async (bucketId) => {
    if (!bucketId) return;
    setDataLoading(true);
    settingsHydrated.current = false;
    try {
      const { data: exp } = await supabase.from("expenses").select("*").eq("bucket_id", bucketId).order("date", { ascending: false }).order("created_at", { ascending: false });
      setExpenses((exp || []).map(rowToExpense));
      let { data: st } = await supabase.from("bucket_settings").select("*").eq("bucket_id", bucketId).maybeSingle();
      if (!st) {
        await supabase.from("bucket_settings").insert({ bucket_id: bucketId, categories: DEFAULT_CATEGORIES, people: [myName] });
        st = { categories: DEFAULT_CATEGORIES, people: [myName] };
      }
      setCategories(Array.isArray(st.categories) && st.categories.length ? st.categories : DEFAULT_CATEGORIES);
      setPeople(Array.isArray(st.people) ? st.people : [myName]);
    } catch (e) {
      flash("Couldn't load this bucket.");
      console.error(e);
    } finally {
      setDataLoading(false);
      setTimeout(() => { settingsHydrated.current = true; }, 0);
    }
  }, [myName]);

  useEffect(() => { if (selectedId) loadBucketData(selectedId); }, [selectedId, loadBucketData]);

  /* ---- realtime + refetch on focus (keeps shared buckets in sync) ---- */
  useEffect(() => {
    if (!selectedId) return;
    const refetch = () => loadBucketData(selectedId);
    const onFocus = () => { if (document.visibilityState === "visible") refetch(); };
    document.addEventListener("visibilitychange", onFocus);
    const ch = supabase
      .channel("bucket-" + selectedId)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `bucket_id=eq.${selectedId}` }, refetch)
      .subscribe();
    return () => { document.removeEventListener("visibilitychange", onFocus); supabase.removeChannel(ch); };
  }, [selectedId, loadBucketData]);

  /* ---- persist settings (categories/people) when they change ---- */
  useEffect(() => {
    if (!selectedId || !settingsHydrated.current) return;
    const t = setTimeout(() => {
      supabase.from("bucket_settings").upsert({ bucket_id: selectedId, categories, people, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) console.error(error); });
    }, 400);
    return () => clearTimeout(t);
  }, [categories, people, selectedId]);

  /* ---- expense CRUD ---- */
  const ensurePerson = (name) => { const n = (name || "").trim(); if (n && !people.some((p) => p.toLowerCase() === n.toLowerCase())) setPeople((prev) => [...prev, n]); };

  const addExpense = async (e) => {
    ensurePerson(e.paidBy);
    const row = { bucket_id: selectedId, user_id: user.id, amount: e.amount, category: e.category, description: e.description, date: e.date, method: e.method, paid_by: e.paidBy };
    const { data, error } = await supabase.from("expenses").insert(row).select().single();
    if (error) { flash("Couldn't save expense."); console.error(error); return; }
    setExpenses((prev) => [rowToExpense(data), ...prev]);
  };
  const updateExpense = async (u) => {
    ensurePerson(u.paidBy);
    const { error } = await supabase.from("expenses").update({ amount: u.amount, category: u.category, description: u.description, date: u.date, method: u.method, paid_by: u.paidBy }).eq("id", u.id);
    if (error) { flash("Couldn't update."); return; }
    setExpenses((prev) => prev.map((x) => (x.id === u.id ? { ...u } : x)));
  };
  const deleteExpense = async (id) => {
    const prev = expenses;
    setExpenses((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { flash("Couldn't delete."); setExpenses(prev); }
  };

  /* ---- bucket actions ---- */
  const createBucket = async () => {
    const name = window.prompt("Name this bucket (e.g. Joint, Personal, Trip)");
    if (!name) return;
    try {
      const { data: created, error } = await supabase.from("buckets").insert({ name: name.trim(), emoji: "💼", owner_id: user.id }).select().single();
      if (error) throw error;
      await supabase.from("bucket_members").insert({ bucket_id: created.id, email: myEmail, user_id: user.id, role: "owner" });
      await supabase.from("bucket_settings").insert({ bucket_id: created.id, categories: DEFAULT_CATEGORIES, people: [myName] });
      await loadBuckets();
      setSelectedId(created.id);
      flash("Bucket created.");
    } catch (e) { flash("Couldn't create bucket."); console.error(e); }
  };
  const renameBucket = async (name, emoji) => {
    const { error } = await supabase.from("buckets").update({ name, emoji }).eq("id", selectedId);
    if (error) { flash("Couldn't rename."); return; }
    setBuckets((prev) => prev.map((b) => (b.id === selectedId ? { ...b, name, emoji } : b)));
    flash("Saved.");
  };
  const inviteMember = async (email) => {
    const { error } = await supabase.from("bucket_members").insert({ bucket_id: selectedId, email, role: "member" });
    if (error) return { error: error.code === "23505" ? "Already invited." : error.message };
    await loadBuckets();
    return {};
  };
  const removeMember = async (m) => {
    const { error } = await supabase.from("bucket_members").delete().eq("id", m.id);
    if (error) { flash("Couldn't remove."); return; }
    await loadBuckets();
  };
  const leaveBucket = async () => {
    const mine = allMembers.find((m) => m.bucket_id === selectedId && ((m.email || "").toLowerCase() === myEmail || m.user_id === user.id));
    if (mine) await supabase.from("bucket_members").delete().eq("id", mine.id);
    setManageOpen(false);
    setSelectedId(null);
    await loadBuckets();
    flash("You left the bucket.");
  };
  const deleteBucket = async () => {
    const { error } = await supabase.from("buckets").delete().eq("id", selectedId);
    if (error) { flash("Couldn't delete bucket."); return; }
    setManageOpen(false);
    setSelectedId(null);
    await loadBuckets();
    flash("Bucket deleted.");
  };
  const clearBucket = async () => {
    const { error } = await supabase.from("expenses").delete().eq("bucket_id", selectedId);
    if (error) { flash("Couldn't clear."); return; }
    setExpenses([]);
    flash("All expenses cleared.");
  };

  /* ---- name + backup ---- */
  const changeName = async (name) => {
    const { error } = await supabase.auth.updateUser({ data: { display_name: name } });
    if (error) { flash("Couldn't update name."); return; }
    flash("Name updated.");
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  const exportData = () => {
    const bucket = buckets.find((b) => b.id === selectedId);
    const blob = new Blob([JSON.stringify({ bucket: bucket?.name, exportedAt: new Date().toISOString(), categories, people, expenses }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `spendr-${(bucket?.name || "bucket").toLowerCase().replace(/\s+/g, "-")}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importData = async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = Array.isArray(parsed.expenses) ? parsed.expenses : [];
      if (!incoming.length) { flash("No expenses found in file."); return; }
      const rows = incoming.map((e) => ({ bucket_id: selectedId, user_id: user.id, amount: Number(e.amount) || 0, category: e.category || "other", description: e.description || "", date: e.date || todayStr(), method: e.method || "other", paid_by: e.paidBy || e.paid_by || myName }));
      const { error } = await supabase.from("expenses").insert(rows);
      if (error) throw error;
      if (Array.isArray(parsed.categories) && parsed.categories.length) setCategories(parsed.categories);
      if (Array.isArray(parsed.people)) setPeople((prev) => Array.from(new Set([...prev, ...parsed.people])));
      await loadBucketData(selectedId);
      flash(`Imported ${rows.length} expenses.`);
    } catch (e) { flash("Import failed — is it a Spendr export file?"); console.error(e); }
  };

  /* ---- derived ---- */
  const memberCounts = useMemo(() => {
    const c = {};
    allMembers.forEach((m) => { c[m.bucket_id] = (c[m.bucket_id] || 0) + 1; });
    return c;
  }, [allMembers]);
  const currentBucket = buckets.find((b) => b.id === selectedId);
  const isOwner = currentBucket?.role === "owner";
  const bucketMembers = useMemo(() => allMembers.filter((m) => m.bucket_id === selectedId).sort((a, b) => (a.role === "owner" ? -1 : 1)), [allMembers, selectedId]);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "settings", label: "Manage", icon: SettingsIcon },
  ];

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;
  if (!session) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <header className="sticky top-0 z-30 bg-slate-50/85 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shrink-0"><Wallet className="w-4.5 h-4.5 text-emerald-400" /></div>
            {currentBucket && <BucketSwitcher buckets={buckets} selectedId={selectedId} onSelect={setSelectedId} onNew={createBucket} onManage={() => setManageOpen(true)} memberCounts={memberCounts} />}
          </div>
          <nav className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-28 sm:pb-8 space-y-4">
        {dataLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3"><Loader2 className="w-7 h-7 animate-spin" /><p className="text-sm">Loading {currentBucket?.name}…</p></div>
        ) : (
          <>
            {tab !== "settings" && <QuickAdd categories={categories} people={people} defaultPaidBy={myName} onAdd={addExpense} />}
            {tab === "dashboard" && <Dashboard expenses={expenses} categories={categories} myName={myName} />}
            {tab === "transactions" && <Transactions expenses={expenses} categories={categories} people={people} myName={myName} onUpdate={updateExpense} onDelete={deleteExpense} />}
            {tab === "settings" && (
              <SettingsView
                categories={categories} setCategories={setCategories} people={people} setPeople={setPeople}
                expenses={expenses} bucketName={currentBucket?.name || "this bucket"} myName={myName}
                displayName={myName} onChangeName={changeName} userEmail={user.email}
                onExport={exportData} onImport={importData} onClearBucket={clearBucket} isOwner={isOwner} onSignOut={signOut}
              />
            )}
          </>
        )}
      </main>

      {manageOpen && currentBucket && (
        <ManageBucketModal
          bucket={currentBucket} members={bucketMembers} isOwner={isOwner} myEmail={myEmail}
          onClose={() => setManageOpen(false)} onRename={renameBucket} onInvite={inviteMember}
          onRemoveMember={removeMember} onLeave={leaveBucket} onDelete={deleteBucket}
        />
      )}

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl text-[11px] font-medium transition ${tab === t.id ? "text-slate-900" : "text-slate-400"}`}>
              <t.icon className="w-5 h-5" /> {t.label}
            </button>
          ))}
        </div>
      </nav>

      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">{toast}</div>
      )}
    </div>
  );
}
