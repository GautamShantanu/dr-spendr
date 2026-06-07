// Vercel serverless function: receives Supabase database-webhook calls for
// audit_log inserts and pushes notifications to the bucket's members.
//
// Required Vercel env vars:
//   VAPID_PRIVATE_KEY            (pair of the public key hardcoded below/in the app)
//   SUPABASE_SERVICE_ROLE_KEY    (Supabase → Project Settings → API)
//   WEBHOOK_SECRET               (same value set on the Supabase webhook header)
import webpush from "web-push";

const SUPABASE_URL = "https://ohhkbotxmbdwehaidqsu.supabase.co";
const VAPID_PUBLIC_KEY = "BMue4ibU3zWXEtg6bwFgRP5h3lcBMs524xkemKqtrq62Rxk2KqO1mpV4VX04FrNa9Jnp53aK2pg36e-ImpgTd0o";

const fmtINR = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const monthLabel = (mk) => {
  const [y, m] = String(mk).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
};
const ROLE_LABELS = { owner: "owner", manager: "manager", viewer: "viewer", payee: "payee", member: "manager" };

async function sb(path, key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

/* Decide whether/what to notify for an audit row. Returns {title, body, payeeOnlyFor} or null. */
function describe(rec, bucketName) {
  const n = rec.new_data || {}, o = rec.old_data || {};
  const who = rec.actor_name || (rec.actor_email ? rec.actor_email.split("@")[0] : "Someone");
  const t = rec.table_name, a = rec.action;

  if (t === "expenses") {
    // skip merge storms: lone payer/payee reassignments
    if (a === "update") {
      const FIELDS = ["amount", "category", "description", "date", "method", "paid_by", "paid_to", "split", "attachments"];
      const changed = FIELDS.filter((k) => JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null));
      if (changed.length === 1 && (changed[0] === "paid_to" || changed[0] === "paid_by")) return null;
    }
    const x = a === "delete" ? o : n;
    const label = `${fmtINR(x.amount)}${x.paid_to ? ` to ${x.paid_to}` : ""}${x.description ? ` — ${String(x.description).slice(0, 60)}` : ""}`;
    const verbs = { insert: "added", update: "edited", delete: "deleted" };
    return { title: bucketName, body: `${who} ${verbs[a]} ${label}`, payeeName: x.paid_to || null };
  }
  if (t === "bucket_members") {
    if (a === "insert") return { title: bucketName, body: `${who} invited ${n.email} as ${ROLE_LABELS[n.role] || n.role}` };
    if (a === "delete") return { title: bucketName, body: `${who} removed ${o.email}` };
    if (!o.user_id && n.user_id) return { title: bucketName, body: `${n.display_name || n.email} joined` };
    if (o.role !== n.role) return { title: bucketName, body: `${who} changed ${n.email} to ${ROLE_LABELS[n.role] || n.role}` };
    return null;
  }
  if (t === "bucket_settings" && a === "update") {
    const ob = o.budgets || {}, nb = n.budgets || {};
    for (const k of new Set([...Object.keys(ob), ...Object.keys(nb)])) {
      if (JSON.stringify(ob[k]) !== JSON.stringify(nb[k])) {
        return {
          title: bucketName,
          body: nb[k] == null ? `${who} removed the ${monthLabel(k)} budget` : `${who} set the ${monthLabel(k)} budget to ${fmtINR(nb[k])}`,
        };
      }
    }
    return null; // category/payer/payee list edits: too noisy
  }
  if (t === "buckets") {
    if (a === "update" && (o.name !== n.name || o.emoji !== n.emoji)) return { title: n.name, body: `${who} renamed the bucket to ${n.emoji || ""} ${n.name}` };
    if (a === "delete") return { title: o.name, body: `${who} deleted the bucket` };
    return null;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (req.headers["x-webhook-secret"] !== process.env.WEBHOOK_SECRET) return res.status(401).json({ error: "auth" });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rec = req.body?.record;
  if (!rec || !rec.bucket_id) return res.status(200).json({ skipped: "no bucket" });

  try {
    const [bucket] = await sb(`buckets?id=eq.${rec.bucket_id}&select=name,emoji,owner_id`, key);
    if (!bucket) return res.status(200).json({ skipped: "bucket gone" });

    const msg = describe(rec, `${bucket.emoji || ""} ${bucket.name}`.trim());
    if (!msg) return res.status(200).json({ skipped: "not notifiable" });

    // recipients: active members + owner, minus the actor; payee-role members
    // only hear about payments made to them
    const members = await sb(`bucket_members?bucket_id=eq.${rec.bucket_id}&user_id=not.is.null&select=user_id,role,payee_name`, key);
    const ids = new Set();
    for (const m of members) {
      const role = m.role === "member" ? "manager" : m.role;
      if (role === "payee") {
        if (rec.table_name === "expenses" && msg.payeeName && m.payee_name && msg.payeeName.toLowerCase() === m.payee_name.toLowerCase()) ids.add(m.user_id);
      } else ids.add(m.user_id);
    }
    ids.add(bucket.owner_id);
    if (rec.actor) ids.delete(rec.actor);
    if (!ids.size) return res.status(200).json({ skipped: "no recipients" });

    const subs = await sb(`push_subscriptions?user_id=in.(${[...ids].join(",")})&select=endpoint,keys,user_id`, key);
    if (!subs.length) return res.status(200).json({ skipped: "no subscriptions" });

    webpush.setVapidDetails("mailto:gautamshantanu.in@gmail.com", VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const payload = JSON.stringify({ title: msg.title, body: msg.body, tag: `audit-${rec.id}` });

    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // dead subscription: clean it up
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
            method: "DELETE", headers: { apikey: key, authorization: `Bearer ${key}` },
          });
        }
      }
    }));
    return res.status(200).json({ sent, recipients: ids.size });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
