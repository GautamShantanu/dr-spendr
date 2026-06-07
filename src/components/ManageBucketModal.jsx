import { useState } from "react";
import {
  X, Crown, Eye, Plus, Pencil, Check, Store, Users, UserPlus, Download, Trash2, LogOut,
} from "lucide-react";
import { ROLE_LABELS, BUCKET_EMOJIS } from "../lib/constants";
import { lastGrapheme, normalizeRole } from "../lib/helpers";
import { PaidByInput } from "./ui/PaidByInput";

export function ManageBucketModal({ bucket, members, isOwner, myEmail, payees, people, onAddPerson, onSetMemberName, canEdit, onClose, onRename, onInvite, onChangeRole, onRemoveMember, onLeave, onDelete, onExport }) {
  const [name, setName] = useState(bucket.name);
  const [emoji, setEmoji] = useState(bucket.emoji || "💼");
  const [invite, setInvite] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [invitePayee, setInvitePayee] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameFor, setNameFor] = useState(null);   // member id whose name is being set
  const [nameDraft, setNameDraft] = useState("");

  const doInvite = async () => {
    const e = invite.trim().toLowerCase();
    setMsg("");
    if (!e || !e.includes("@")) { setMsg("Enter a valid email."); return; }
    if (inviteRole === "payee" && !invitePayee.trim()) { setMsg("Enter which payee they are."); return; }
    const res = await onInvite(e, inviteRole, inviteRole === "payee" ? invitePayee.trim() : null, inviteName.trim() || null);
    if (res?.error) setMsg(res.error);
    else { setInvite(""); setInviteName(""); setInvitePayee(""); setMsg(`Invited ${e} as ${ROLE_LABELS[inviteRole].toLowerCase()}.`); }
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
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Icon & name</label>
            <div className="flex gap-2">
              {isOwner ? (
                <input
                  value={emoji}
                  onChange={(e) => { const g = lastGrapheme(e.target.value.trim()); if (g) setEmoji(g); }}
                  onFocus={(e) => e.target.select()}
                  aria-label="Bucket icon — type any emoji"
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 text-center text-xl outline-none focus:bg-white focus:border-slate-400"
                />
              ) : (
                <span className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 text-xl flex items-center justify-center">{emoji}</span>
              )}
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 disabled:opacity-60" />
              {isOwner && (
                <button onClick={() => onRename(name.trim() || bucket.name, emoji)} className="px-4 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800">Save</button>
              )}
            </div>
            {isOwner && (
              <>
                <p className="text-[11px] text-slate-400 mt-1.5">Type any emoji in the icon box (📱 emoji keyboard works), or pick one below.</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {BUCKET_EMOJIS.map((em) => (
                    <button key={em} onClick={() => setEmoji(em)} className={`w-8 h-8 rounded-lg text-base hover:bg-slate-100 ${emoji === em ? "bg-slate-200 ring-1 ring-slate-400" : ""}`}>{em}</button>
                  ))}
                </div>
              </>
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
                    {isOwner && !m.display_name && m.role !== "owner" && nameFor !== m.id && (
                      <button onClick={() => { setNameFor(m.id); setNameDraft(""); }}
                        className="mt-1 text-[11px] text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-md font-medium inline-flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Set {normalizeRole(m.role) === "payee" ? "payee" : "payer"} name
                      </button>
                    )}
                    {nameFor === m.id && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <PaidByInput value={nameDraft} onChange={setNameDraft} people={normalizeRole(m.role) === "payee" ? payees : people} compact
                            placeholder={normalizeRole(m.role) === "payee" ? "Pick or type payee name" : "Pick or type payer name"}
                            icon={normalizeRole(m.role) === "payee" ? Store : Users} />
                        </div>
                        <button disabled={!nameDraft.trim()} onClick={() => { onSetMemberName(m, nameDraft.trim()); setNameFor(null); }}
                          className="p-2 rounded-lg bg-slate-900 text-white disabled:opacity-40"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setNameFor(null)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"><X className="w-3.5 h-3.5" /></button>
                      </div>
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
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="flex-1 min-w-0 w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-slate-400">
                  <option value="manager">Manager — can add & edit expenses</option>
                  <option value="viewer">Viewer — can see everything, edit nothing</option>
                  <option value="payee">Payee — sees only payments made to them</option>
                </select>
                {inviteRole === "payee" ? (
                  <div className="flex-1 min-w-0"><PaidByInput value={invitePayee} onChange={setInvitePayee} people={payees} compact placeholder="Payee name (new or existing)" icon={Store} /></div>
                ) : (
                  <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Name (goes in payer list)"
                    className="flex-1 min-w-0 w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:bg-white focus:border-slate-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {inviteRole === "payee"
                  ? "New payee names are added to the payee list right away."
                  : "The name is added to the payer list immediately — no need to wait for them to join. If left blank, the email name is used."}
              </p>
              {msg && <p className="text-xs text-slate-500 mt-1.5">{msg}</p>}
              <p className="text-[11px] text-slate-400 mt-1.5">They get access the moment they sign in with that email.</p>
            </div>
          )}

          {/* danger */}
          <div className="pt-3 border-t border-slate-100">
            {isOwner ? (
              confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">💡 Export a backup first — it can be imported into a new bucket later (receipt photos aren't included).</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={onExport} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-4 h-4" /> Export first</button>
                    <button onClick={onDelete} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete bucket & all its expenses</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-xl text-slate-600 text-sm hover:bg-slate-100">Cancel</button>
                  </div>
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
