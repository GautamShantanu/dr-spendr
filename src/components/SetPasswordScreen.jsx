import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "../supabaseClient";
import { Card } from "./ui/Card";

/* Shown after a user opens a password-reset link (Supabase fires a
   PASSWORD_RECOVERY auth event and signs them in with a recovery session). */
export function SetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (password.length < 6) { setErr("Use at least 6 characters."); return; }
    setErr(""); setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr(e.message || "Couldn't update password.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.svg" alt="Dr Spendr" className="w-14 h-14 rounded-2xl mb-3 shadow-lg" />
          <h1 className="text-xl font-bold text-slate-900">Set a new password</h1>
          <p className="text-sm text-slate-500">Choose a new password for your account.</p>
        </div>
        <Card className="p-5 space-y-2.5">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="New password"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800 text-sm" />
          </div>
          {err && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
          <button onClick={submit} disabled={busy || !password} className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Update password
          </button>
        </Card>
      </div>
    </div>
  );
}
