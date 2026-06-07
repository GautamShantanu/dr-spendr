import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Search, Trash2, Pencil, X, Check, Settings as SettingsIcon,
  LayoutDashboard, Receipt, Users, Filter, ChevronDown, AlertTriangle,
  Calendar, CreditCard, Loader2, ArrowUpDown, Tag, Banknote, Smartphone,
  MoreHorizontal, Sparkles, Wallet, TrendingUp, TrendingDown, LogOut,
  ChevronsUpDown, UserPlus, Mail, Share2, Crown, Download, Upload, Lock,
  Store, Divide, Eye, Paperclip, ImagePlus, FileText, Landmark,
  ArrowLeftRight, Building2, Zap, CalendarClock,
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
  { id: "cheque", label: "Cheque", icon: FileText },
  { id: "neft", label: "NEFT", icon: ArrowLeftRight },
  { id: "rtgs", label: "RTGS", icon: Building2 },
  { id: "imps", label: "IMPS", icon: Zap },
  { id: "loan", label: "Loan", icon: Landmark },
  { id: "emi", label: "EMI", icon: CalendarClock },
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
  date: r.date, method: r.method, paidBy: r.paid_by || "Me", paidTo: r.paid_to || "",
  split: r.split && typeof r.split === "object" && Object.keys(r.split).length ? r.split : null,
  attachments: Array.isArray(r.attachments) ? r.attachments : [],
});

/* Resize/compress a photo before upload (~150-250 KB instead of multi-MB). */
const compressImage = (file, maxDim = 1280, quality = 0.72) => new Promise((resolve) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => { URL.revokeObjectURL(url); resolve(b || file); }, "image/jpeg", quality);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});

const MAX_PHOTOS = 2;

const ROLE_LABELS = { owner: "Owner", manager: "Manager", viewer: "Viewer", payee: "Payee", member: "Manager" };
const normalizeRole = (r) => (r === "member" ? "manager" : r || "manager");

/* Last grapheme of a string — lets users type/paste any emoji from their keyboard. */
const lastGrapheme = (s) => {
  if (!s) return "";
  try {
    const seg = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)];
    return seg.length ? seg[seg.length - 1].segment : "";
  } catch {
    const a = Array.from(s);
    return a.length ? a[a.length - 1] : "";
  }
};

/* Small input for typing any emoji (phone emoji keyboard, paste, etc.). */
function EmojiInput({ value, onChange }) {
  return (
    <input
      value={value}
      onChange={(e) => { const g = lastGrapheme(e.target.value.trim()); if (g) onChange(g); }}
      onFocus={(e) => e.target.select()}
      aria-label="Category emoji — type any emoji"
      className="w-12 h-9 rounded-lg border border-slate-200 bg-white text-center text-lg outline-none focus:border-slate-400"
    />
  );
}

/* ============================== primitives ============================== */

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm ${className}`}>{children}</div>
);
const Pill = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{children}</button>
);

function PaidByInput({ value, onChange, people, compact, placeholder = "Paid by", icon: Icon = Users }) {
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

function CategoryInput({ value, onChange, categories, compact }) {
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

/* type-to-search filter dropdown over a list of names, with an "All" choice */
function ComboFilter({ value, onChange, options, placeholder = "All" }) {
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
          <img src="/logo.svg" alt="Dr Spendr" className="w-14 h-14 rounded-2xl mb-3 shadow-lg" />
          <h1 className="text-xl font-bold text-slate-900">Dr Spendr</h1>
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

function ManageBucketModal({ bucket, members, isOwner, myEmail, payees, people, onAddPerson, canEdit, onClose, onRename, onInvite, onChangeRole, onRemoveMember, onLeave, onDelete }) {
  const [name, setName] = useState(bucket.name);
  const [emoji, setEmoji] = useState(bucket.emoji || "💼");
  const [invite, setInvite] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [invitePayee, setInvitePayee] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doInvite = async () => {
    const e = invite.trim().toLowerCase();
    setMsg("");
    if (!e || !e.includes("@")) { setMsg("Enter a valid email."); return; }
    if (inviteRole === "payee" && !invitePayee) { setMsg("Pick which payee they are."); return; }
    const res = await onInvite(e, inviteRole, inviteRole === "payee" ? invitePayee : null);
    if (res?.error) setMsg(res.error); else { setInvite(""); setMsg(`Invited ${e} as ${ROLE_LABELS[inviteRole].toLowerCase()}.`); }
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
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-semibold shrink-0">{(m.display_name || m.email).slice(0, 1).toUpperCase()}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-700 truncate">{m.display_name || m.email}{m.email === myEmail ? " (you)" : ""}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                      {m.role === "owner" && <Crown className="w-3 h-3 text-amber-500" />}
                      {normalizeRole(m.role) === "payee" && <Eye className="w-3 h-3 text-sky-500" />}
                      {ROLE_LABELS[m.role] || m.role}{normalizeRole(m.role) === "payee" && m.payee_name ? ` · sees payments to ${m.payee_name}` : ""}
                      <span className={`px-1.5 py-0.5 rounded-md font-medium ${m.user_id ? "text-emerald-700 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>{m.user_id ? "Active" : "Invited"}</span>
                      {m.display_name && <span className="truncate">{m.email}</span>}
                    </span>
                    {canEdit && m.display_name && !people.some((p) => p.toLowerCase() === m.display_name.toLowerCase()) && (
                      <button onClick={() => onAddPerson(m.display_name)} className="mt-1 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded-md font-medium inline-flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add "{m.display_name}" to paid-by people
                      </button>
                    )}
                  </span>
                  {isOwner && m.role !== "owner" && (
                    <>
                      <select value={normalizeRole(m.role)} onChange={(e) => onChangeRole(m, e.target.value)} className="text-xs px-1.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 outline-none">
                        <option value="manager">Manager</option>
                        <option value="viewer">Viewer</option>
                        {normalizeRole(m.role) === "payee" && <option value="payee">Payee</option>}
                      </select>
                      <button onClick={() => onRemoveMember(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50"><X className="w-4 h-4" /></button>
                    </>
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
              <div className="flex gap-2 mt-2">
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                  <option value="manager">Manager — can add & edit expenses</option>
                  <option value="viewer">Viewer — can see everything, edit nothing</option>
                  <option value="payee">Payee — sees only payments made to them</option>
                </select>
                {inviteRole === "payee" && (
                  <select value={invitePayee} onChange={(e) => setInvitePayee(e.target.value)} className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                    <option value="">Which payee?</option>
                    {payees.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
              </div>
              {inviteRole === "payee" && payees.length === 0 && <p className="text-[11px] text-amber-600 mt-1.5">Add payees first (Manage → Payees), then link the invite to one.</p>}
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

/* ============================== split editor ============================== */

function SplitEditor({ amount, people, shares, setShares }) {
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

const buildSplit = (shares, people, amt) => {
  const s = {};
  people.forEach((p) => { const v = parseFloat(shares[p]); if (v > 0) s[p] = Math.round(v * 100) / 100; });
  const sum = Object.values(s).reduce((a, b) => a + b, 0);
  if (!Object.keys(s).length) return { error: "Assign the split amounts first." };
  if (Math.abs(sum - amt) > 0.01) return { error: "Split must add up to the amount." };
  return { split: s };
};

/* ============================== receipt photos ============================== */

function PhotoPicker({ photos, setPhotos, existing = [], onRemoveExisting }) {
  const inRef = useRef(null);
  const remaining = MAX_PHOTOS - existing.length - photos.length;
  const pick = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, remaining));
    e.target.value = "";
    for (const f of files) {
      const blob = await compressImage(f);
      setPhotos((prev) => prev.length + existing.length >= MAX_PHOTOS ? prev : [...prev, { blob, url: URL.createObjectURL(blob) }]);
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {existing.map((p) => (
        <div key={p} className="relative">
          <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center"><Paperclip className="w-5 h-5 text-slate-400" /></div>
          {onRemoveExisting && <button type="button" onClick={() => onRemoveExisting(p)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>}
        </div>
      ))}
      {photos.map((p, i) => (
        <div key={p.url} className="relative">
          <img src={p.url} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
          <button type="button" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((prev) => prev.filter((_, j) => j !== i)); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
        </div>
      ))}
      {remaining > 0 && (
        <button type="button" onClick={() => inRef.current?.click()} className="w-14 h-14 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 flex flex-col items-center justify-center gap-0.5">
          <ImagePlus className="w-5 h-5" /><span className="text-[9px] font-medium">Photo</span>
        </button>
      )}
      <input ref={inRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
    </div>
  );
}

function AttachmentViewer({ paths, onClose }) {
  const [urls, setUrls] = useState(null);
  useEffect(() => {
    (async () => {
      const out = [];
      for (const p of paths) {
        const { data } = await supabase.storage.from("receipts").createSignedUrl(p, 3600);
        if (data?.signedUrl) out.push(data.signedUrl);
      }
      setUrls(out);
    })();
  }, [paths]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end"><button onClick={onClose} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"><X className="w-5 h-5" /></button></div>
        {urls === null ? <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-white" /></div>
          : urls.length === 0 ? <p className="text-center text-white/80 text-sm py-16">Couldn't load photos.</p>
          : urls.map((u) => <img key={u} src={u} alt="Receipt" className="w-full rounded-2xl max-h-[70vh] object-contain bg-black/30" />)}
      </div>
    </div>
  );
}

/* ============================== quick add ============================== */

function QuickAdd({ categories, people, payees, defaultPaidBy, onAdd }) {
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

/* ============================== stat + dashboard ============================== */

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

function Dashboard({ expenses, categories, myName }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const [pieScope, setPieScope] = useState("month");
  const [payeeScopeAll, setPayeeScopeAll] = useState(true);
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
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Spent this month" value={fmtINRshort(thisTotal)} exact={fmtINRshort(thisTotal) !== fmtINR(thisTotal) ? fmtINR(thisTotal) : null} accent="#5B8DEF" icon={Wallet} sub={pct === null ? "No data last month" : `${Math.abs(pct).toFixed(0)}% vs last month`} trend={pct === null ? null : pct > 0 ? "up" : "down"} />
        <Stat label="Last month" value={fmtINRshort(lastTotal)} exact={fmtINRshort(lastTotal) !== fmtINR(lastTotal) ? fmtINR(lastTotal) : null} accent="#9B7EDE" icon={Calendar} sub={monthLabel(lastMK)} />
        <Stat label="Daily average" value={fmtINRshort(dailyAvg)} exact={fmtINRshort(dailyAvg) !== fmtINR(dailyAvg) ? fmtINR(dailyAvg) : null} accent="#4FB286" icon={TrendingUp} sub={`over ${days} day${days > 1 ? "s" : ""}`} />
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

      {(hasPayees || balances.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hasPayees && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Store className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Paid to</h3></div>
                <div className="flex gap-1.5"><Pill active={!payeeScopeAll} onClick={() => setPayeeScopeAll(false)}>This month</Pill><Pill active={payeeScopeAll} onClick={() => setPayeeScopeAll(true)}>All time</Pill></div>
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

const methodMeta = (id) => PAYMENT_METHODS.find((m) => m.id === id) || PAYMENT_METHODS.find((m) => m.id === "other");

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
          <p className="font-medium text-slate-800 truncate">{expense.description || cat?.name || "Expense"}</p>
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

function Transactions({ expenses, categories, people, payees, myName, canEdit, onUpdate, onDelete }) {
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
            <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Paid by</label><ComboFilter value={filters.person} onChange={(v) => setFilters({ ...filters, person: v })} options={peopleInData} placeholder="All — type to search" /></div>
            {payeesInData.length > 0 && <div><label className="text-[11px] text-slate-400 font-medium block mb-1">Paid to</label><ComboFilter value={filters.payee} onChange={(v) => setFilters({ ...filters, payee: v })} options={payeesInData} placeholder="All — type to search" /></div>}
            {activeFilters > 0 && <button onClick={() => setFilters({ from: "", to: "", category: "all", method: "all", person: "all", payee: "all" })} className="col-span-2 lg:col-span-5 text-xs text-slate-500 hover:text-rose-500 text-left">Clear all filters</button>}
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

/* ============================== settings ============================== */

function SettingsView({ categories, setCategories, people, setPeople, payees, setPayees, expenses, bucketName, myName, onRename: _ignored, displayName, onChangeName, onExport, onImport, onClearBucket, onMergePeople, onMergePayees, isOwner, canEdit, onSignOut, userEmail }) {
  const [newCat, setNewCat] = useState({ name: "", emoji: "🏷️", color: PALETTE[0] });
  const [editCatId, setEditCatId] = useState(null);
  const [newPerson, setNewPerson] = useState("");
  const [newPayee, setNewPayee] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [merging, setMerging] = useState(false);
  const [pMergeFrom, setPMergeFrom] = useState("");
  const [pMergeTo, setPMergeTo] = useState("");
  const [pMerging, setPMerging] = useState(false);
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
  const addPayee = () => { const n = newPayee.trim(); if (!n || payees.some((p) => p.toLowerCase() === n.toLowerCase())) { setNewPayee(""); return; } setPayees([...payees, n]); setNewPayee(""); };
  const deletePayee = (p) => setPayees(payees.filter((x) => x !== p));

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
                <EmojiInput value={c.emoji} onChange={(em) => updateCat(c.id, { emoji: em })} />
                <input value={c.name} onChange={(e) => updateCat(c.id, { name: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400" />
                <input type="color" value={c.color} onChange={(e) => updateCat(c.id, { color: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                <button onClick={() => setEditCatId(null)} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm flex items-center gap-1"><Check className="w-4 h-4" /></button>
              </div>
              <p className="text-[11px] text-slate-400">Type any emoji in the box (📱 emoji keyboard works), or pick one below.</p>
              <div className="flex flex-wrap gap-1">{EMOJI_CHOICES.map((em) => <button key={em} onClick={() => updateCat(c.id, { emoji: em })} className={`w-8 h-8 rounded-lg text-base hover:bg-slate-200 ${c.emoji === em ? "bg-slate-200 ring-1 ring-slate-400" : ""}`}>{em}</button>)}</div>
            </div>
          ) : (
            <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: c.color + "1F" }}>{c.emoji}</div>
              <span className="flex-1 font-medium text-slate-700 text-sm">{c.name}</span>
              <span className="w-4 h-4 rounded-full" style={{ background: c.color }} />
              {canEdit && <button onClick={() => setEditCatId(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="w-4 h-4" /></button>}
              {canEdit && <button onClick={() => deleteCat(c.id)} disabled={categories.length <= 1} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
        {canEdit && <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Add category</p>
          <div className="flex gap-2 items-center mb-2">
            <EmojiInput value={newCat.emoji} onChange={(em) => setNewCat({ ...newCat, emoji: em })} />
            <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addCat()} placeholder="Category name" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400" />
            <input type="color" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer" />
            <button onClick={addCat} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center gap-1"><Plus className="w-4 h-4" /></button>
          </div>
          <p className="text-[11px] text-slate-400 mb-1.5">Type any emoji in the box (📱 emoji keyboard works), or pick one below.</p>
          <div className="flex flex-wrap gap-1">{EMOJI_CHOICES.map((em) => <button key={em} onClick={() => setNewCat({ ...newCat, emoji: em })} className={`w-8 h-8 rounded-lg text-base hover:bg-slate-200 ${newCat.emoji === em ? "bg-slate-200 ring-1 ring-slate-400" : ""}`}>{em}</button>)}</div>
        </div>}
      </Card>

      {/* people */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">People</h3><span className="text-xs text-slate-400">· names for "paid by" & splits</span></div>
        <div className="flex flex-wrap gap-2 mb-3">
          {people.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full bg-slate-100 text-sm text-slate-700">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-semibold">{p.slice(0, 1).toUpperCase()}</span>
              {p}{canEdit && <button onClick={() => deletePerson(p)} className="text-slate-400 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>}
            </span>
          ))}
        </div>
        {canEdit && <div className="flex gap-2">
          <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} placeholder="Add a person (partner, roommate…)" className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:bg-white focus:border-slate-400" />
          <button onClick={addPerson} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add</button>
        </div>}

        {/* merge duplicate people (e.g. a hand-typed name + an invited account) */}
        {canEdit && people.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1.5">Merge two people</p>
            <p className="text-[11px] text-slate-400 mb-2">If the same person appears twice — e.g. a name you typed and an invited account — merge them. All their "paid by" entries and split shares in this bucket move to the kept name.</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)} className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                <option value="">Merge this…</option>
                {people.filter((p) => p !== mergeTo).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="text-xs text-slate-400 text-center shrink-0">into</span>
              <select value={mergeTo} onChange={(e) => setMergeTo(e.target.value)} className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                <option value="">…this (kept)</option>
                {people.filter((p) => p !== mergeFrom).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button disabled={!mergeFrom || !mergeTo || merging}
                onClick={async () => { setMerging(true); await onMergePeople(mergeFrom, mergeTo); setMerging(false); setMergeFrom(""); setMergeTo(""); }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-1.5 shrink-0">
                {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Merge
              </button>
            </div>
            {mergeFrom && mergeTo && <p className="text-[11px] text-amber-600 mt-1.5">"{mergeFrom}" disappears; everything they paid (and their split shares) becomes "{mergeTo}". This rewrites this bucket's history and can't be undone in one click.</p>}
          </div>
        )}
      </Card>

      {/* payees */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><Store className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Payees</h3><span className="text-xs text-slate-400">· vendors & contractors for "paid to"</span></div>
        {payees.length === 0 && <p className="text-sm text-slate-400 mb-3">No payees yet. Add the people/vendors you pay — e.g. your contractor — and pick them on an expense. New names typed on an expense are added here automatically.</p>}
        <div className="flex flex-wrap gap-2 mb-3">
          {payees.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full bg-sky-50 text-sm text-sky-800">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-semibold">{p.slice(0, 1).toUpperCase()}</span>
              {p}{canEdit && <button onClick={() => deletePayee(p)} className="text-sky-400 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>}
            </span>
          ))}
        </div>
        {canEdit && <div className="flex gap-2">
          <input value={newPayee} onChange={(e) => setNewPayee(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPayee()} placeholder="Add a payee (contractor, vendor…)" className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:bg-white focus:border-slate-400" />
          <button onClick={addPayee} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add</button>
        </div>}

        {/* merge duplicate payees (e.g. "Tiles wala" + the actual vendor) */}
        {canEdit && payees.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1.5">Merge two payees</p>
            <p className="text-[11px] text-slate-400 mb-2">If the same vendor appears under two names, merge them. All "paid to" entries in this bucket move to the kept name.</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select value={pMergeFrom} onChange={(e) => setPMergeFrom(e.target.value)} className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                <option value="">Merge this…</option>
                {payees.filter((p) => p !== pMergeTo).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="text-xs text-slate-400 text-center shrink-0">into</span>
              <select value={pMergeTo} onChange={(e) => setPMergeTo(e.target.value)} className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                <option value="">…this (kept)</option>
                {payees.filter((p) => p !== pMergeFrom).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button disabled={!pMergeFrom || !pMergeTo || pMerging}
                onClick={async () => { setPMerging(true); await onMergePayees(pMergeFrom, pMergeTo); setPMerging(false); setPMergeFrom(""); setPMergeTo(""); }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-1.5 shrink-0">
                {pMerging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Merge
              </button>
            </div>
            {pMergeFrom && pMergeTo && <p className="text-[11px] text-amber-600 mt-1.5">"{pMergeFrom}" disappears; every payment to them becomes "{pMergeTo}". This rewrites this bucket's history and can't be undone in one click.</p>}
          </div>
        )}
      </Card>

      {/* backup */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2"><Download className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Backup</h3></div>
        <p className="text-sm text-slate-500 mb-3">Export this bucket's expenses to a file you keep, or restore from one. (Recommended occasionally — the free database has no automatic backups.)</p>
        <div className="flex gap-2">
          <button onClick={onExport} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-4 h-4" /> Export JSON</button>
          {canEdit && <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-1.5"><Upload className="w-4 h-4" /> Import</button>}
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
  const [payees, setPayees] = useState([]);
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
      // link any invites for this email to this account + record display name
      const { error: claimErr } = await supabase.rpc("claim_memberships");
      if (claimErr) console.warn("claim_memberships:", claimErr.message); // tolerate pre-migration DB
      const { data: bks, error } = await supabase.from("buckets").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      const { data: mems } = await supabase.from("bucket_members").select("*");
      const members = mems || [];
      setAllMembers(members);

      let list = (bks || []).map((b) => {
        const mine = members.find((m) => m.bucket_id === b.id && (m.user_id === user.id || (m.email || "").toLowerCase() === myEmail));
        return { ...b, role: b.owner_id === user.id ? "owner" : normalizeRole(mine?.role), payeeName: mine?.payee_name || null };
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
      const remembered = localStorage.getItem("drspendr:lastBucket:" + user.id);
      setSelectedId((prev) => {
        if (prev && list.some((b) => b.id === prev)) return prev;
        if (remembered && list.some((b) => b.id === remembered)) return remembered;
        return list[0].id;
      });
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
      setPayees(Array.isArray(st.payees) ? st.payees : []);
    } catch (e) {
      flash("Couldn't load this bucket.");
      console.error(e);
    } finally {
      setDataLoading(false);
      setTimeout(() => { settingsHydrated.current = true; }, 0);
    }
  }, [myName]);

  useEffect(() => { if (selectedId) loadBucketData(selectedId); }, [selectedId, loadBucketData]);

  /* remember the last opened bucket per user (restored on next visit) */
  useEffect(() => {
    if (selectedId && user) localStorage.setItem("drspendr:lastBucket:" + user.id, selectedId);
  }, [selectedId, user]);

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

  /* ---- persist settings (categories/people/payees) when they change ---- */
  useEffect(() => {
    if (!selectedId || !settingsHydrated.current) return;
    const role = buckets.find((b) => b.id === selectedId)?.role;
    if (role !== "owner" && role !== "manager") return; // viewers/payees can't write settings
    const t = setTimeout(() => {
      supabase.from("bucket_settings").upsert({ bucket_id: selectedId, categories, people, payees, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) console.error(error); });
    }, 400);
    return () => clearTimeout(t);
  }, [categories, people, payees, selectedId, buckets]);

  /* ---- expense CRUD ---- */
  const ensurePerson = (name) => { const n = (name || "").trim(); if (n && !people.some((p) => p.toLowerCase() === n.toLowerCase())) setPeople((prev) => [...prev, n]); };
  const ensurePayee = (name) => { const n = (name || "").trim(); if (n && !payees.some((p) => p.toLowerCase() === n.toLowerCase())) setPayees((prev) => [...prev, n]); };

  const uploadPhotos = async (bucketId, expenseId, blobs) => {
    const paths = [];
    for (let i = 0; i < blobs.length; i++) {
      const path = `${bucketId}/${expenseId}/${Date.now()}-${i}.jpg`;
      const { error } = await supabase.storage.from("receipts").upload(path, blobs[i], { contentType: "image/jpeg" });
      if (error) { console.error(error); flash("A photo failed to upload."); continue; }
      paths.push(path);
    }
    return paths;
  };

  const addExpense = async (e, files = []) => {
    ensurePerson(e.paidBy);
    ensurePayee(e.paidTo);
    const row = { bucket_id: selectedId, user_id: user.id, amount: e.amount, category: e.category, description: e.description, date: e.date, method: e.method, paid_by: e.paidBy, paid_to: e.paidTo || "", split: e.split || null };
    const { data, error } = await supabase.from("expenses").insert(row).select().single();
    if (error) { flash("Couldn't save expense."); console.error(error); return; }
    let attachments = [];
    if (files.length) {
      attachments = await uploadPhotos(selectedId, data.id, files.slice(0, MAX_PHOTOS));
      if (attachments.length) await supabase.from("expenses").update({ attachments }).eq("id", data.id);
    }
    setExpenses((prev) => [rowToExpense({ ...data, attachments }), ...prev]);
  };
  const updateExpense = async (u, newFiles = [], removedPaths = []) => {
    ensurePerson(u.paidBy);
    ensurePayee(u.paidTo);
    let attachments = u.attachments || [];
    if (removedPaths.length) supabase.storage.from("receipts").remove(removedPaths).then(({ error }) => error && console.error(error));
    if (newFiles.length) attachments = [...attachments, ...(await uploadPhotos(selectedId, u.id, newFiles))].slice(0, MAX_PHOTOS);
    const { error } = await supabase.from("expenses").update({ amount: u.amount, category: u.category, description: u.description, date: u.date, method: u.method, paid_by: u.paidBy, paid_to: u.paidTo || "", split: u.split || null, attachments }).eq("id", u.id);
    if (error) { flash("Couldn't update."); return; }
    setExpenses((prev) => prev.map((x) => (x.id === u.id ? { ...u, attachments } : x)));
  };
  const deleteExpense = async (id) => {
    const prev = expenses;
    const target = prev.find((x) => x.id === id);
    setExpenses((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { flash("Couldn't delete."); setExpenses(prev); return; }
    if (target?.attachments?.length) supabase.storage.from("receipts").remove(target.attachments).then(({ error: se }) => se && console.error(se));
  };

  /* ---- bucket actions ---- */
  const createBucket = async () => {
    const name = window.prompt("Name this bucket (e.g. Joint, Personal, Trip)");
    if (!name) return;
    try {
      const { data: created, error } = await supabase.from("buckets").insert({ name: name.trim(), emoji: "💼", owner_id: user.id }).select().single();
      if (error) throw error;
      await supabase.from("bucket_members").insert({ bucket_id: created.id, email: myEmail, user_id: user.id, role: "owner" });
      await supabase.from("bucket_settings").insert({ bucket_id: created.id, categories: DEFAULT_CATEGORIES, people: [myName], payees: [] });
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
  const inviteMember = async (email, role = "manager", payeeName = null) => {
    const { error } = await supabase.from("bucket_members").insert({ bucket_id: selectedId, email, role, payee_name: payeeName });
    if (error) return { error: error.code === "23505" ? "Already invited." : error.message };
    await loadBuckets();
    return {};
  };
  const changeMemberRole = async (m, role) => {
    const { error } = await supabase.from("bucket_members").update({ role, payee_name: role === "payee" ? m.payee_name : null }).eq("id", m.id);
    if (error) { flash("Couldn't change role."); return; }
    await loadBuckets();
    flash("Role updated.");
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
    const allPaths = expenses.flatMap((e) => e.attachments || []);
    const { error } = await supabase.from("expenses").delete().eq("bucket_id", selectedId);
    if (error) { flash("Couldn't clear."); return; }
    if (allPaths.length) supabase.storage.from("receipts").remove(allPaths).then(({ error: se }) => se && console.error(se));
    setExpenses([]);
    flash("All expenses cleared.");
  };
  const mergePeople = async (from, to) => {
    if (!from || !to || from === to) return;
    // move all "paid by" entries in this bucket
    const { error } = await supabase.from("expenses").update({ paid_by: to }).eq("bucket_id", selectedId).eq("paid_by", from);
    if (error) { flash("Couldn't merge."); console.error(error); return; }
    // fold their split shares into the kept name
    const affected = expenses.filter((e) => e.split && Object.prototype.hasOwnProperty.call(e.split, from));
    for (const e of affected) {
      const s = { ...e.split };
      s[to] = Math.round(((Number(s[to]) || 0) + (Number(s[from]) || 0)) * 100) / 100;
      delete s[from];
      const { error: se } = await supabase.from("expenses").update({ split: s }).eq("id", e.id);
      if (se) console.error(se);
    }
    setPeople((prev) => prev.filter((p) => p !== from));
    await loadBucketData(selectedId);
    flash(`Merged ${from} into ${to}.`);
  };
  const mergePayees = async (from, to) => {
    if (!from || !to || from === to) return;
    const { error } = await supabase.from("expenses").update({ paid_to: to }).eq("bucket_id", selectedId).eq("paid_to", from);
    if (error) { flash("Couldn't merge."); console.error(error); return; }
    // keep payee-role invites pointing at the kept name (owner-only; best effort)
    supabase.from("bucket_members").update({ payee_name: to }).eq("bucket_id", selectedId).eq("payee_name", from).then(({ error: me }) => me && console.error(me));
    setPayees((prev) => prev.filter((p) => p !== from));
    await loadBucketData(selectedId);
    flash(`Merged ${from} into ${to}.`);
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
    const blob = new Blob([JSON.stringify({ bucket: bucket?.name, exportedAt: new Date().toISOString(), categories, people, payees, expenses }, null, 2)], { type: "application/json" });
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
      const rows = incoming.map((e) => ({ bucket_id: selectedId, user_id: user.id, amount: Number(e.amount) || 0, category: e.category || "other", description: e.description || "", date: e.date || todayStr(), method: e.method || "other", paid_by: e.paidBy || e.paid_by || myName, paid_to: e.paidTo || e.paid_to || "", split: e.split || null }));
      const { error } = await supabase.from("expenses").insert(rows);
      if (error) throw error;
      if (Array.isArray(parsed.categories) && parsed.categories.length) setCategories(parsed.categories);
      if (Array.isArray(parsed.people)) setPeople((prev) => Array.from(new Set([...prev, ...parsed.people])));
      if (Array.isArray(parsed.payees)) setPayees((prev) => Array.from(new Set([...prev, ...parsed.payees])));
      await loadBucketData(selectedId);
      flash(`Imported ${rows.length} expenses.`);
    } catch (e) { flash("Import failed — is it a Dr Spendr export file?"); console.error(e); }
  };

  /* ---- derived ---- */
  const memberCounts = useMemo(() => {
    const c = {};
    allMembers.forEach((m) => { c[m.bucket_id] = (c[m.bucket_id] || 0) + 1; });
    return c;
  }, [allMembers]);
  const currentBucket = buckets.find((b) => b.id === selectedId);
  const myRole = normalizeRole(currentBucket?.role);
  const isOwner = myRole === "owner";
  const canEdit = myRole === "owner" || myRole === "manager";
  const isPayee = myRole === "payee";
  const bucketMembers = useMemo(() => allMembers.filter((m) => m.bucket_id === selectedId).sort((a, b) => (a.role === "owner" ? -1 : 1)), [allMembers, selectedId]);

  const tabs = [
    ...(isPayee ? [] : [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }]),
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "settings", label: "Manage", icon: SettingsIcon },
  ];
  useEffect(() => { if (isPayee && tab === "dashboard") setTab("transactions"); }, [isPayee, tab]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;
  if (!session) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <header className="sticky top-0 z-30 bg-slate-50/85 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.svg" alt="Dr Spendr" className="w-9 h-9 rounded-xl shrink-0" />
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
            {isPayee && (
              <Card className="p-3.5 sm:p-4 bg-sky-50/60 border-sky-200">
                <p className="text-sm text-sky-800 flex items-center gap-2"><Eye className="w-4 h-4 shrink-0" /> You're viewing payments made to {currentBucket?.payeeName ? <strong>{currentBucket.payeeName}</strong> : "you"} in this bucket.</p>
              </Card>
            )}
            {tab !== "settings" && canEdit && <QuickAdd categories={categories} people={people} payees={payees} defaultPaidBy={myName} onAdd={addExpense} />}
            {tab === "dashboard" && !isPayee && <Dashboard expenses={expenses} categories={categories} myName={myName} />}
            {tab === "transactions" && <Transactions expenses={expenses} categories={categories} people={people} payees={payees} myName={myName} canEdit={canEdit} onUpdate={updateExpense} onDelete={deleteExpense} />}
            {tab === "settings" && (
              <SettingsView
                categories={categories} setCategories={setCategories} people={people} setPeople={setPeople}
                payees={payees} setPayees={setPayees}
                expenses={expenses} bucketName={currentBucket?.name || "this bucket"} myName={myName}
                displayName={myName} onChangeName={changeName} userEmail={user.email}
                onExport={exportData} onImport={importData} onClearBucket={clearBucket} onMergePeople={mergePeople} onMergePayees={mergePayees} isOwner={isOwner} canEdit={canEdit} onSignOut={signOut}
              />
            )}
          </>
        )}
      </main>

      {manageOpen && currentBucket && (
        <ManageBucketModal
          bucket={currentBucket} members={bucketMembers} isOwner={isOwner} myEmail={myEmail} payees={payees}
          people={people} canEdit={canEdit} onAddPerson={(n) => { ensurePerson(n); flash(`Added ${n} to people.`); }}
          onClose={() => setManageOpen(false)} onRename={renameBucket} onInvite={inviteMember} onChangeRole={changeMemberRole}
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
