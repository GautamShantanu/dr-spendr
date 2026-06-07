import { useState, useEffect } from "react";
import { History, X, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { describeEvent } from "../lib/audit";

export function ActivityPanel({ bucketId, bucketName, onClose }) {
  const [events, setEvents] = useState(null);
  const [limit, setLimit] = useState(30);
  useEffect(() => {
    if (!bucketId) return;
    (async () => {
      const { data, error } = await supabase.from("audit_log").select("id,table_name,action,actor_email,actor_name,old_data,new_data,created_at").eq("bucket_id", bucketId).order("id", { ascending: false }).limit(limit);
      if (error) { console.error(error); setEvents([]); return; }
      setEvents(data || []);
    })();
  }, [bucketId, limit]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-slate-500 shrink-0" />
            <h3 className="font-semibold text-slate-800">Activity</h3>
            <span className="text-xs text-slate-400 truncate">· {bucketName}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 pt-3 space-y-1.5">
          {events === null ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            : events.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No activity recorded yet. (Logging starts from when the audit log was installed.)</p>
            : events.map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-semibold shrink-0 mt-0.5">{(e.actor_name || e.actor_email || "?").slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-slate-700"><strong className="font-medium">{e.actor_name || (e.actor_email ? e.actor_email.split("@")[0] : "system")}</strong> {describeEvent(e)}</span>
                  <span className="block text-[11px] text-slate-400">{new Date(e.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </span>
              </div>
            ))}
          {events && events.length === limit && (
            <button onClick={() => setLimit((l) => l + 50)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">Show more</button>
          )}
        </div>
      </div>
    </div>
  );
}
