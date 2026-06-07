import { fmtINR, monthLabel } from "./format";
import { PAYMENT_METHODS, ROLE_LABELS } from "./constants";

export const AUDIT_FIELDS = { amount: "amount", category: "category", description: "note", date: "date", method: "method", paid_by: "paid by", paid_to: "paid to", split: "split", attachments: "photos" };

export const auditDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  const opts = { day: "numeric", month: "short" };
  if (dt.getFullYear() !== new Date().getFullYear()) opts.year = "2-digit";
  return dt.toLocaleDateString("en-IN", opts);
};
export const auditMethod = (id) => (PAYMENT_METHODS.find((m) => m.id === id) || { label: id || "—" }).label;

export function describeEvent(e, cats = []) {
  const n = e.new_data || {}, o = e.old_data || {};
  const catName = (id) => { const c = cats.find((x) => x.id === id); return c ? `${c.emoji} ${c.name}` : (id || "—"); };
  if (e.table_name === "expenses") {
    const x = e.action === "delete" ? o : n;
    const label = `₹${Number(x.amount || 0).toLocaleString("en-IN")}${x.paid_to ? ` to ${x.paid_to}` : ""}${x.description ? ` — ${String(x.description).slice(0, 40)}` : ""}`;
    if (e.action === "insert") return `added expense ${label}`;
    if (e.action === "delete") return `deleted expense ${label}`;
    const changedKeys = Object.keys(AUDIT_FIELDS).filter((k) => JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null));
    // a lone payer/payee change (typical of a merge) reads as before → after
    if (changedKeys.length === 1 && changedKeys[0] === "paid_to") return `moved ₹${Number(n.amount || 0).toLocaleString("en-IN")} from payee "${o.paid_to || "—"}" to "${n.paid_to || "—"}"`;
    if (changedKeys.length === 1 && changedKeys[0] === "paid_by") return `moved ₹${Number(n.amount || 0).toLocaleString("en-IN")} from payer "${o.paid_by || "—"}" to "${n.paid_by || "—"}"`;
    const diffs = changedKeys.map((k) => {
      switch (k) {
        case "amount": return `amount ₹${Number(o.amount || 0).toLocaleString("en-IN")} → ₹${Number(n.amount || 0).toLocaleString("en-IN")}`;
        case "date": return `date ${auditDate(o.date)} → ${auditDate(n.date)}`;
        case "method": return `method ${auditMethod(o.method)} → ${auditMethod(n.method)}`;
        case "category": return `category ${catName(o.category)} → ${catName(n.category)}`;
        case "paid_by": return `payer ${o.paid_by || "—"} → ${n.paid_by || "—"}`;
        case "paid_to": return `payee ${o.paid_to || "—"} → ${n.paid_to || "—"}`;
        case "description": return `note "${String(o.description || "—").slice(0, 25)}" → "${String(n.description || "—").slice(0, 25)}"`;
        case "split": return o.split && n.split ? "split changed" : n.split ? "split added" : "split removed";
        case "attachments": {
          const oc = Array.isArray(o.attachments) ? o.attachments.length : 0, nc = Array.isArray(n.attachments) ? n.attachments.length : 0;
          return `photos ${oc} → ${nc}`;
        }
        default: return AUDIT_FIELDS[k];
      }
    });
    return `edited expense ${label}${diffs.length ? ` (${diffs.join("; ")})` : ""}`;
  }
  if (e.table_name === "bucket_members") {
    if (e.action === "insert") return `invited ${n.email} as ${(ROLE_LABELS[n.role] || n.role || "").toLowerCase()}${n.display_name ? ` ("${n.display_name}")` : ""}`;
    if (e.action === "delete") return `removed ${o.email}`;
    if (!o.user_id && n.user_id) return `${n.display_name || n.email} joined (activated)`;
    if (o.role !== n.role) return `changed ${n.email} to ${(ROLE_LABELS[n.role] || n.role || "").toLowerCase()}`;
    if ((o.display_name || "") !== (n.display_name || "")) return `named ${n.email} "${n.display_name}"`;
    if ((o.payee_name || "") !== (n.payee_name || "")) return `linked ${n.email} to payee "${n.payee_name}"`;
    return `updated member ${n.email}`;
  }
  if (e.table_name === "bucket_settings") {
    if (e.action === "insert") return "set up bucket settings";
    const parts = [];
    const few = (arr) => arr.length > 4 ? `${arr.slice(0, 4).join(", ")} +${arr.length - 4} more` : arr.join(", ");
    // budgets: which month, what value
    const ob = o.budgets || {}, nb = n.budgets || {};
    for (const k of new Set([...Object.keys(ob), ...Object.keys(nb)])) {
      if (JSON.stringify(ob[k]) !== JSON.stringify(nb[k])) {
        parts.push(nb[k] == null ? `removed the ${monthLabel(k)} budget` : `set ${monthLabel(k)} budget to ${fmtINR(nb[k])}`);
      }
    }
    // payers/payees: who was added or removed
    const nameDiff = (key, label) => {
      const oo = new Set(Array.isArray(o[key]) ? o[key] : []);
      const nn = new Set(Array.isArray(n[key]) ? n[key] : []);
      const added = [...nn].filter((x) => !oo.has(x));
      const removed = [...oo].filter((x) => !nn.has(x));
      if (added.length) parts.push(`added ${label}${added.length > 1 ? "s" : ""} ${few(added)}`);
      if (removed.length) parts.push(`removed ${label}${removed.length > 1 ? "s" : ""} ${few(removed)}`);
    };
    nameDiff("people", "payer");
    nameDiff("payees", "payee");
    if (JSON.stringify(o.categories ?? null) !== JSON.stringify(n.categories ?? null)) {
      const oc = Array.isArray(o.categories) ? o.categories : [], nc = Array.isArray(n.categories) ? n.categories : [];
      const oById = Object.fromEntries(oc.map((c) => [c.id, c]));
      const ncIds = new Set(nc.map((c) => c.id));
      const addedC = nc.filter((c) => !oById[c.id]).map((c) => `${c.emoji} ${c.name}`);
      const removedC = oc.filter((c) => !ncIds.has(c.id)).map((c) => `${c.emoji} ${c.name}`);
      if (addedC.length) parts.push(`added categor${addedC.length > 1 ? "ies" : "y"} ${few(addedC)}`);
      if (removedC.length) parts.push(`removed categor${removedC.length > 1 ? "ies" : "y"} ${few(removedC)}`);
      for (const c of nc) {
        const prev = oById[c.id];
        if (!prev) continue;
        if (prev.name !== c.name) parts.push(`renamed category "${prev.name}" to "${c.name}"`);
        if (prev.emoji !== c.emoji) parts.push(`changed ${c.name}'s emoji ${prev.emoji} → ${c.emoji}`);
        if (prev.color !== c.color && prev.name === c.name && prev.emoji === c.emoji) parts.push(`recolored category ${c.name}`);
      }
      if (!parts.length) parts.push("edited categories");
    }
    return parts.join("; ") || "updated settings";
  }
  if (e.table_name === "buckets") {
    if (e.action === "insert") return "created this bucket";
    if (e.action === "delete") return "deleted bucket";
    if (o.name !== n.name || o.emoji !== n.emoji) return `renamed bucket to ${n.emoji || ""} ${n.name || ""}`;
    return "updated bucket";
  }
  return `${e.action} ${e.table_name}`;
}
