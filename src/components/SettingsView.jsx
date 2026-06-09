import { useState, useMemo, useRef } from "react";
import {
  Users, LogOut, Tag, Pencil, Trash2, Check, Plus, Store, Search, Loader2,
  Download, Upload, AlertTriangle, X,
} from "lucide-react";
import { PALETTE, EMOJI_CHOICES } from "../lib/constants";
import { Card } from "./ui/Card";
import { EmojiInput } from "./ui/EmojiInput";
import { NotificationsCard } from "./NotificationsCard";

export function SettingsView({ categories, setCategories, people, setPeople, payees, setPayees, expenses, bucketName, bucketId, isPayee, myName, userId, onRename: _ignored, displayName, onChangeName, onExport, onImport, onClearBucket, onMergePeople, onMergePayees, onDeleteCategory, isOwner, canEdit, onSignOut, userEmail }) {
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
  const catUsage = (id) => expenses.filter((e) => e.category === id).length;
  const deleteCat = (id) => {
    if (categories.length <= 1) return;
    if (catUsage(id) > 0) { const others = categories.filter((c) => c.id !== id); setReassignTo(others.find((c) => c.id === "other")?.id || others[0].id); setPendingDelete(id); }
    else setCategories(categories.filter((c) => c.id !== id)); // unused → drop locally (persists via settings save)
  };
  const addPerson = () => { const n = newPerson.trim(); if (!n || people.some((p) => p.toLowerCase() === n.toLowerCase())) { setNewPerson(""); return; } setPeople([...people, n]); setNewPerson(""); };
  const deletePerson = (p) => setPeople(people.filter((x) => x !== p));
  const addPayee = () => { const n = newPayee.trim(); if (!n || payees.some((p) => p.toLowerCase() === n.toLowerCase())) { setNewPayee(""); return; } setPayees([...payees, n]); setNewPayee(""); };
  const deletePayee = (p) => setPayees(payees.filter((x) => x !== p));

  const SECTIONS = [
    { id: "general", label: "General" },
    { id: "categories", label: "Categories" },
    { id: "names", label: "Payers & Payees" },
    { id: "data", label: "Data" },
  ];
  const [section, setSection] = useState("general");
  const [payeeQ, setPayeeQ] = useState("");
  const [showAllMissingPayees, setShowAllMissingPayees] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // category id awaiting reassign-confirm
  const [reassignTo, setReassignTo] = useState("");
  const payeesShown = payeeQ ? payees.filter((p) => p.toLowerCase().includes(payeeQ.toLowerCase())) : payees;

  // names present in expense history but no longer in the suggestion lists —
  // merge still works on them, and they can be restored with one tap
  const missingPayees = useMemo(() => {
    const inList = new Set(payees.map((p) => p.toLowerCase()));
    return Array.from(new Set(expenses.map((e) => e.paidTo).filter(Boolean))).filter((p) => !inList.has(p.toLowerCase())).sort();
  }, [payees, expenses]);
  const missingPeople = useMemo(() => {
    const inList = new Set(people.map((p) => p.toLowerCase()));
    return Array.from(new Set(expenses.map((e) => e.paidBy).filter(Boolean))).filter((p) => !inList.has(p.toLowerCase())).sort();
  }, [people, expenses]);
  const allPayeeNames = useMemo(() => [...payees, ...missingPayees].sort((a, b) => a.localeCompare(b)), [payees, missingPayees]);
  const allPeopleNames = useMemo(() => [...people, ...missingPeople].sort((a, b) => a.localeCompare(b)), [people, missingPeople]);

  return (
    <div className="space-y-4">
      {/* section switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex-1 py-2 px-1 rounded-lg text-xs sm:text-sm font-medium transition ${section === s.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "general" && <>
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

      <NotificationsCard userId={userId} />
      </>}

      {section === "categories" && <>
      {/* categories */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><Tag className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Categories</h3><span className="text-xs text-slate-400">· {categories.length} · for {bucketName}</span></div>
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
          ) : pendingDelete === c.id ? (
            <div key={c.id} className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
              <p className="text-sm text-slate-700"><strong>{catUsage(c.id)}</strong> expense{catUsage(c.id) > 1 ? "s" : ""} use <strong>{c.emoji} {c.name}</strong>. Move {catUsage(c.id) > 1 ? "them" : "it"} to:</p>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400">
                  {categories.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}
                </select>
                <button onClick={() => { onDeleteCategory(c.id, reassignTo); setPendingDelete(null); }} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Move & delete</button>
                <button onClick={() => setPendingDelete(null)} className="px-3 py-2 rounded-lg text-slate-600 text-sm hover:bg-slate-100">Cancel</button>
              </div>
            </div>
          ) : (
            <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: c.color + "1F" }}>{c.emoji}</div>
              <span className="flex-1 font-medium text-slate-700 text-sm">{c.name}</span>
              <span className="text-[11px] text-slate-400">{catUsage(c.id) || ""}</span>
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

      </>}

      {section === "names" && <>
      {/* payers */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Payers</h3><span className="text-xs text-slate-400">· {people.length} · names for "paid by" & splits</span></div>
        {missingPeople.length > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium text-amber-700">In past expenses but removed from this list ({missingPeople.length})</p>
              {canEdit && <button onClick={() => setPeople(Array.from(new Set([...people, ...missingPeople])))} className="text-xs text-amber-700 font-medium hover:underline shrink-0">Restore all</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingPeople.map((p) => (
                <button key={p} disabled={!canEdit} onClick={() => setPeople([...people, p])} title={canEdit ? "Add back to the list" : undefined}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-amber-300 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-60">
                  <Plus className="w-3 h-3" />{p}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {people.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full bg-slate-100 text-sm text-slate-700">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-semibold">{p.slice(0, 1).toUpperCase()}</span>
              {p}{canEdit && <button onClick={() => deletePerson(p)} className="text-slate-400 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>}
            </span>
          ))}
        </div>
        {canEdit && <div className="flex gap-2">
          <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} placeholder="Add a payer (partner, family…)" className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:bg-white focus:border-slate-400" />
          <button onClick={addPerson} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add</button>
        </div>}

        {/* merge duplicate people (e.g. a hand-typed name + an invited account) */}
        {canEdit && allPeopleNames.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1.5">Merge two payers</p>
            <p className="text-[11px] text-slate-400 mb-2">If the same person appears twice — e.g. a name you typed and an invited account — merge them. All their "paid by" entries and split shares in this bucket move to the kept name.</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)} className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                <option value="">Merge this…</option>
                {allPeopleNames.filter((p) => p !== mergeTo).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="text-xs text-slate-400 text-center shrink-0">into</span>
              <select value={mergeTo} onChange={(e) => setMergeTo(e.target.value)} className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                <option value="">…this (kept)</option>
                {allPeopleNames.filter((p) => p !== mergeFrom).map((p) => <option key={p} value={p}>{p}</option>)}
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
        <div className="flex items-center gap-2 mb-4"><Store className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Payees</h3><span className="text-xs text-slate-400">· {payees.length} · vendors & contractors for "paid to"</span></div>
        {payees.length === 0 && <p className="text-sm text-slate-400 mb-3">No payees yet. Add the people/vendors you pay — e.g. your contractor — and pick them on an expense. New names typed on an expense are added here automatically.</p>}
        {payees.length > 12 && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={payeeQ} onChange={(e) => setPayeeQ(e.target.value)} placeholder={`Search ${payees.length} payees…`}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
          </div>
        )}
        {payeeQ && payeesShown.length === 0 && <p className="text-sm text-slate-400 mb-3">No payee matches "{payeeQ}".</p>}
        {missingPayees.length > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium text-amber-700">In past expenses but removed from this list ({missingPayees.length})</p>
              {canEdit && <button onClick={() => setPayees(Array.from(new Set([...payees, ...missingPayees])))} className="text-xs text-amber-700 font-medium hover:underline shrink-0">Restore all</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(showAllMissingPayees ? missingPayees : missingPayees.slice(0, 30)).map((p) => (
                <button key={p} disabled={!canEdit} onClick={() => setPayees([...payees, p])} title={canEdit ? "Add back to the list" : undefined}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-amber-300 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-60">
                  <Plus className="w-3 h-3" />{p}
                </button>
              ))}
              {missingPayees.length > 30 && (
                <button onClick={() => setShowAllMissingPayees((v) => !v)} className="text-xs text-amber-700 font-medium self-center px-2 py-1 hover:underline">
                  {showAllMissingPayees ? "Show fewer" : `+${missingPayees.length - 30} more`}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {payeesShown.map((p) => (
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
        {canEdit && allPayeeNames.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1.5">Merge two payees</p>
            <p className="text-[11px] text-slate-400 mb-2">If the same vendor appears under two names, merge them. All "paid to" entries in this bucket move to the kept name.</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select value={pMergeFrom} onChange={(e) => setPMergeFrom(e.target.value)} className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                <option value="">Merge this…</option>
                {allPayeeNames.filter((p) => p !== pMergeTo).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="text-xs text-slate-400 text-center shrink-0">into</span>
              <select value={pMergeTo} onChange={(e) => setPMergeTo(e.target.value)} className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                <option value="">…this (kept)</option>
                {allPayeeNames.filter((p) => p !== pMergeFrom).map((p) => <option key={p} value={p}>{p}</option>)}
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

      </>}

      {section === "data" && <>
      {/* backup */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2"><Download className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Backup</h3></div>
        <p className="text-sm text-slate-500 mb-3">Export this bucket's expenses to a file you keep, or restore from one. (Recommended occasionally — the free database has no automatic backups.)</p>
        <div className="flex gap-2">
          <button onClick={onExport} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-4 h-4" /> Export JSON</button>
          {canEdit && <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-1.5"><Upload className="w-4 h-4" /> Import</button>}
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
        </div>
        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-1">
          <p className="font-medium text-slate-600">What Import expects</p>
          <p>A JSON file created by <strong>Export JSON</strong> (from any bucket). Format: <code className="bg-white px-1 rounded">{'{ "expenses": [...], "categories": [...], "people": [...], "payees": [...], "budgets": {} }'}</code> — only <code className="bg-white px-1 rounded">expenses</code> is required; each expense needs <code className="bg-white px-1 rounded">amount</code> and ideally <code className="bg-white px-1 rounded">date</code> (YYYY-MM-DD), <code className="bg-white px-1 rounded">category</code>, <code className="bg-white px-1 rounded">description</code>, <code className="bg-white px-1 rounded">method</code>, <code className="bg-white px-1 rounded">paidBy</code>, <code className="bg-white px-1 rounded">paidTo</code>.</p>
          <p>Importing <strong>adds</strong> the expenses to this bucket — it never deletes or overwrites existing ones (import twice = duplicates). Categories, payers, payees and budgets from the file are merged in. Receipt photos are not part of backups.</p>
        </div>
      </Card>

      {/* danger */}
      {isOwner && (
        <Card className="p-4 sm:p-5 border-rose-200 bg-rose-50/40">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-rose-500" /><h3 className="font-semibold text-rose-700">Clear this bucket</h3></div>
          <p className="text-sm text-slate-500 mb-3">Delete every expense in <strong>{bucketName}</strong>. Categories, payers and payees stay. This cannot be undone.</p>
          {confirmClear ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">💡 Export a backup first — the file can be imported again to restore everything (except receipt photos).</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={onExport} className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-4 h-4" /> Export backup first</button>
                <button onClick={() => { onClearBucket(); setConfirmClear(false); }} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete all {expenses.length} expenses</button>
                <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-600 text-sm font-medium hover:bg-rose-50">Clear all expenses</button>
          )}
        </Card>
      )}
      </>}
    </div>
  );
}
