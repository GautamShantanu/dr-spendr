import { lastGrapheme } from "../../lib/helpers";

/* Small input for typing any emoji (phone emoji keyboard, paste, etc.). */
export function EmojiInput({ value, onChange }) {
  return (
    <input
      value={value}
      onChange={(e) => { const g = lastGrapheme(e.target.value.trim()); if (g) onChange(g); }}
      onFocus={(e) => e.target.select()}
      aria-label="Category emoji — type any emoji"
      className="w-12 h-9 rounded-lg border border-slate-200 bg-white text-center text-lg outline-none focus:border-slate-400"
    />
  );
}
