import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Settings as SettingsIcon, LayoutDashboard, Receipt, Loader2, Eye, Bell,
} from "lucide-react";
import { supabase, isConfigured } from "./supabaseClient";
import { DEFAULT_CATEGORIES, MAX_PHOTOS } from "./lib/constants";
import { todayStr, monthLabel, fmtINR } from "./lib/format";
import { rowToExpense, normalizeRole } from "./lib/helpers";
import { Card } from "./components/ui/Card";
import { AuthScreen } from "./components/AuthScreen";
import { ConfigScreen } from "./components/ConfigScreen";
import { BucketSwitcher } from "./components/BucketSwitcher";
import { ManageBucketModal } from "./components/ManageBucketModal";
import { QuickAdd } from "./components/QuickAdd";
import { Dashboard } from "./components/Dashboard";
import { Transactions } from "./components/Transactions";
import { SettingsView } from "./components/SettingsView";
import { ActivityPanel } from "./components/ActivityPanel";

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
  const [budgets, setBudgets] = useState({});
  const [tab, setTab] = useState("dashboard");
  const [manageOpen, setManageOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [toast, setToast] = useState("");
  const settingsHydrated = useRef(false);
  const loadedSettings = useRef({}); // last-known DB values, to write only what changed

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
      const loaded = {
        categories: Array.isArray(st.categories) && st.categories.length ? st.categories : DEFAULT_CATEGORIES,
        people: Array.isArray(st.people) ? st.people : [myName],
        payees: Array.isArray(st.payees) ? st.payees : [],
        budgets: st.budgets && typeof st.budgets === "object" ? st.budgets : {},
      };
      setCategories(loaded.categories);
      setPeople(loaded.people);
      setPayees(loaded.payees);
      setBudgets(loaded.budgets);
      loadedSettings.current = loaded;
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

  /* ---- persist settings when they change ----
     Only fields that actually changed in THIS session are written. Writing
     the whole blob used to let a stale session clobber fields (e.g. default
     categories overwriting imported ones) just because a different field
     changed. */
  useEffect(() => {
    if (!selectedId || !settingsHydrated.current) return;
    const role = buckets.find((b) => b.id === selectedId)?.role;
    if (role !== "owner" && role !== "manager") return; // viewers/payees can't write settings
    const t = setTimeout(() => {
      const state = { categories, people, payees, budgets };
      const patch = {};
      for (const k of Object.keys(state)) {
        if (JSON.stringify(state[k]) !== JSON.stringify(loadedSettings.current[k])) patch[k] = state[k];
      }
      if (!Object.keys(patch).length) return;
      supabase.from("bucket_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("bucket_id", selectedId)
        .then(({ error }) => {
          if (error) { console.error(error); return; }
          loadedSettings.current = { ...loadedSettings.current, ...patch };
        });
    }, 1500);
    return () => clearTimeout(t);
  }, [categories, people, payees, budgets, selectedId, buckets]);

  /* ---- expense CRUD ---- */
  // Add payer/payee names to the bucket lists AND persist immediately. Writing
  // straight to the DB (rather than relying on the debounced settings save)
  // avoids a race where the post-insert realtime refetch reloads the old
  // settings and wipes the just-added name before the debounce fires.
  const addNames = async ({ payers = [], payees: py = [] } = {}) => {
    const np = [...people], npy = [...payees];
    let changed = false;
    for (const raw of payers) { const n = (raw || "").trim(); if (n && !np.some((p) => p.toLowerCase() === n.toLowerCase())) { np.push(n); changed = true; } }
    for (const raw of py) { const n = (raw || "").trim(); if (n && !npy.some((p) => p.toLowerCase() === n.toLowerCase())) { npy.push(n); changed = true; } }
    if (!changed) return;
    setPeople(np); setPayees(npy);
    loadedSettings.current = { ...loadedSettings.current, people: np, payees: npy };
    const role = buckets.find((b) => b.id === selectedId)?.role;
    if (role !== "owner" && role !== "manager") return;
    const { error } = await supabase.from("bucket_settings").update({ people: np, payees: npy, updated_at: new Date().toISOString() }).eq("bucket_id", selectedId);
    if (error) console.error(error);
  };
  const ensurePerson = (name) => addNames({ payers: [name] });

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
    await addNames({ payers: [e.paidBy], payees: [e.paidTo] });
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
    await addNames({ payers: [u.paidBy], payees: [u.paidTo] });
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
      await supabase.from("bucket_settings").insert({ bucket_id: created.id, categories: DEFAULT_CATEGORIES, people: [myName], payees: [], budgets: {} });
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
  const inviteMember = async (email, role = "manager", payeeName = null, displayName = null) => {
    const { error } = await supabase.from("bucket_members").insert({ bucket_id: selectedId, email, role, payee_name: payeeName, display_name: displayName });
    if (error) return { error: error.code === "23505" ? "Already invited." : error.message };
    // make the invitee usable right away, before they ever sign in
    if (role === "payee") await addNames({ payees: [payeeName] });
    else await addNames({ payers: [displayName || email.split("@")[0]] });
    await loadBuckets();
    return {};
  };
  const setMonthBudget = (mk, amount) => {
    setBudgets((prev) => {
      const next = { ...prev };
      if (amount === null || !(amount > 0)) delete next[mk]; else next[mk] = amount;
      return next;
    });
    flash(amount > 0 ? `Budget for ${monthLabel(mk)} set to ${fmtINR(amount)}.` : `Budget for ${monthLabel(mk)} removed.`);
  };
  const setMemberName = async (m, name) => {
    const { error } = await supabase.from("bucket_members").update({ display_name: name }).eq("id", m.id);
    if (error) { flash("Couldn't set name."); console.error(error); return; }
    if (normalizeRole(m.role) === "payee") await addNames({ payees: [name] }); else await addNames({ payers: [name] });
    await loadBuckets();
    flash(`Saved — ${name} added.`);
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
    const blob = new Blob([JSON.stringify({ bucket: bucket?.name, exportedAt: new Date().toISOString(), categories, people, payees, budgets, expenses }, null, 2)], { type: "application/json" });
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
      if (parsed.budgets && typeof parsed.budgets === "object") setBudgets((prev) => ({ ...parsed.budgets, ...prev }));
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
          <div className="flex items-center gap-1.5">
          {currentBucket && !isPayee && (
            <button onClick={() => setActivityOpen(true)} title="Activity — who changed what"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300">
              <Bell className="w-4 h-4" />
            </button>
          )}
          <nav className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </nav>
          </div>
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
            {tab === "dashboard" && !isPayee && <Dashboard expenses={expenses} categories={categories} myName={myName} budgets={budgets} onSetBudget={setMonthBudget} canEdit={canEdit} />}
            {tab === "transactions" && <Transactions expenses={expenses} categories={categories} people={people} payees={payees} myName={myName} canEdit={canEdit} onUpdate={updateExpense} onDelete={deleteExpense} />}
            {tab === "settings" && (
              <SettingsView
                categories={categories} setCategories={setCategories} people={people} setPeople={setPeople}
                payees={payees} setPayees={setPayees}
                expenses={expenses} bucketName={currentBucket?.name || "this bucket"} bucketId={selectedId} isPayee={isPayee} myName={myName}
                displayName={myName} onChangeName={changeName} userEmail={user.email} userId={user.id}
                onExport={exportData} onImport={importData} onClearBucket={clearBucket} onMergePeople={mergePeople} onMergePayees={mergePayees} isOwner={isOwner} canEdit={canEdit} onSignOut={signOut}
              />
            )}
          </>
        )}
      </main>

      {activityOpen && currentBucket && (
        <ActivityPanel bucketId={selectedId} bucketName={currentBucket.name} categories={categories} onClose={() => setActivityOpen(false)} />
      )}

      {manageOpen && currentBucket && (
        <ManageBucketModal
          bucket={currentBucket} members={bucketMembers} isOwner={isOwner} myEmail={myEmail} payees={payees}
          people={people} canEdit={canEdit} onAddPerson={(n) => { ensurePerson(n); flash(`Added ${n} to payers.`); }} onSetMemberName={setMemberName}
          onClose={() => setManageOpen(false)} onRename={renameBucket} onInvite={inviteMember} onChangeRole={changeMemberRole}
          onRemoveMember={removeMember} onLeave={leaveBucket} onDelete={deleteBucket} onExport={exportData}
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
