import { PAYMENT_METHODS } from "./constants";

export const rowToExpense = (r) => ({
  id: r.id, amount: Number(r.amount), category: r.category, description: r.description || "",
  date: r.date, method: r.method, paidBy: r.paid_by || "Me", paidTo: r.paid_to || "",
  split: r.split && typeof r.split === "object" && Object.keys(r.split).length ? r.split : null,
  attachments: Array.isArray(r.attachments) ? r.attachments : [],
});

/* Resize/compress a photo before upload (~150-250 KB instead of multi-MB). */
export const compressImage = (file, maxDim = 1280, quality = 0.72) => new Promise((resolve) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => { URL.revokeObjectURL(url); resolve(b || file); }, "image/jpeg", quality);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});

export const normalizeRole = (r) => (r === "member" ? "manager" : r || "manager");

/* Last grapheme of a string — lets users type/paste any emoji from their keyboard. */
export const lastGrapheme = (s) => {
  if (!s) return "";
  try {
    const seg = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)];
    return seg.length ? seg[seg.length - 1].segment : "";
  } catch {
    const a = Array.from(s);
    return a.length ? a[a.length - 1] : "";
  }
};

export const buildSplit = (shares, people, amt) => {
  const s = {};
  people.forEach((p) => { const v = parseFloat(shares[p]); if (v > 0) s[p] = Math.round(v * 100) / 100; });
  const sum = Object.values(s).reduce((a, b) => a + b, 0);
  if (!Object.keys(s).length) return { error: "Assign the split amounts first." };
  if (Math.abs(sum - amt) > 0.01) return { error: "Split must add up to the amount." };
  return { split: s };
};

/* budget for month mk: exact entry, else the latest earlier month's value (inheritance) */
export const resolveBudget = (budgets, mk) => {
  if (!budgets) return { amount: null, from: null };
  const keys = Object.keys(budgets).filter((k) => k <= mk).sort();
  if (!keys.length) return { amount: null, from: null };
  const from = keys[keys.length - 1];
  const v = Number(budgets[from]);
  return { amount: v > 0 ? v : null, from };
};

export const methodMeta = (id) => PAYMENT_METHODS.find((m) => m.id === id) || PAYMENT_METHODS.find((m) => m.id === "other");

export const urlBase64ToUint8Array = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};
