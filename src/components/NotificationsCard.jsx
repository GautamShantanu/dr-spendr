import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { VAPID_PUBLIC_KEY } from "../lib/constants";
import { urlBase64ToUint8Array } from "../lib/helpers";
import { Card } from "./ui/Card";

export function NotificationsCard({ userId }) {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const standaloneNeeded = /iphone|ipad/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches && !navigator.standalone;
  const [status, setStatus] = useState("checking"); // checking | off | on | denied | unsupported
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!supported) { setStatus("unsupported"); return; }
      if (Notification.permission === "denied") { setStatus("denied"); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "on" : "off");
      } catch { setStatus("off"); }
    })();
  }, [supported]);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: json.endpoint, user_id: userId, keys: json.keys }, { onConflict: "endpoint" });
      if (error) throw error;
      setStatus("on");
    } catch (e) { console.error(e); setStatus("off"); } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-slate-500" /><h3 className="font-semibold text-slate-800">Notifications</h3></div>
      {status === "unsupported" && <p className="text-sm text-slate-400">This browser doesn't support push notifications.</p>}
      {status === "denied" && <p className="text-sm text-slate-500">Notifications are blocked for this app — allow them in your device's browser/app settings, then come back here.</p>}
      {(status === "off" || status === "checking") && (
        <>
          <p className="text-sm text-slate-500 mb-3">Get notified on this device when others add expenses, change budgets, or join your buckets. You're never notified about your own actions.</p>
          {standaloneNeeded && <p className="text-xs text-amber-600 mb-3">On iPhone, first add the app to your Home Screen (Share → Add to Home Screen) and enable notifications from there.</p>}
          <button onClick={enable} disabled={busy || status === "checking" || standaloneNeeded}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Enable on this device
          </button>
        </>
      )}
      {status === "on" && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">Notifications are on for this device.</p>
          <button onClick={disable} disabled={busy} className="text-sm text-slate-500 hover:text-rose-600">{busy ? "…" : "Turn off"}</button>
        </div>
      )}
    </Card>
  );
}
