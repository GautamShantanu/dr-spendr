import { useState } from "react";
import { Loader2, Mail, Lock } from "lucide-react";
import { supabase } from "../supabaseClient";
import { Card } from "./ui/Card";

export function AuthScreen() {
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
