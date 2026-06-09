import { useState } from "react";
import { X, Check } from "lucide-react";

/* Lightweight single-field prompt modal — a reliable replacement for
   window.prompt() (which is flaky/blocked in iOS standalone PWAs). */
export function PromptModal({ title, label, placeholder, initial = "", confirmLabel = "Create", onSubmit, onClose }) {
  const [value, setValue] = useState(initial);
  const submit = () => { const v = value.trim(); if (v) { onSubmit(v); onClose(); } };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          {label && <label className="text-xs font-medium text-slate-500 block mb-1.5">{label}</label>}
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={placeholder}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none text-slate-800" />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-600 text-sm hover:bg-slate-100">Cancel</button>
            <button onClick={submit} disabled={!value.trim()} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"><Check className="w-4 h-4" /> {confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
