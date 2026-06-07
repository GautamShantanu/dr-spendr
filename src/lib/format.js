export const fmtINR = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const fmtINRshort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return "₹" + (v / 1e7).toFixed(2) + "Cr";
  if (v >= 1e5) return "₹" + (v / 1e5).toFixed(2) + "L";
  if (v >= 1e3) return "₹" + (v / 1e3).toFixed(1) + "k";
  return "₹" + v.toFixed(0);
};
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthKey = (s) => (s || "").slice(0, 7);
export const monthLabel = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
};
