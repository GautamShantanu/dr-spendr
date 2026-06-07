import { AlertTriangle } from "lucide-react";
import { Card } from "./ui/Card";

export function ConfigScreen() {
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
