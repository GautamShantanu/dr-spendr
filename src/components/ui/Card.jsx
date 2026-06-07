export const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm ${className}`}>{children}</div>
);
export const Pill = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{children}</button>
);
