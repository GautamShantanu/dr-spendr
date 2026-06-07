import {
  Banknote, CreditCard, Smartphone, FileText, ArrowLeftRight, Building2, Zap,
  Landmark, CalendarClock, MoreHorizontal,
} from "lucide-react";

export const DEFAULT_CATEGORIES = [
  { id: "food", name: "Food", emoji: "🍜", color: "#F4845F" },
  { id: "transport", name: "Transport", emoji: "🚕", color: "#5B8DEF" },
  { id: "groceries", name: "Groceries", emoji: "🛒", color: "#4FB286" },
  { id: "rent", name: "Rent/Bills", emoji: "🏠", color: "#9B7EDE" },
  { id: "shopping", name: "Shopping", emoji: "🛍️", color: "#E86FA8" },
  { id: "health", name: "Health", emoji: "💊", color: "#3FB8C4" },
  { id: "entertainment", name: "Entertainment", emoji: "🎬", color: "#F2B33D" },
  { id: "travel", name: "Travel", emoji: "✈️", color: "#6CC4A1" },
  { id: "other", name: "Other", emoji: "📦", color: "#9AA5B1" },
];
export const PALETTE = ["#5B8DEF","#F4845F","#4FB286","#9B7EDE","#E86FA8","#3FB8C4","#F2B33D","#6CC4A1","#EE6C6C","#7A93FF"];
export const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "cheque", label: "Cheque", icon: FileText },
  { id: "neft", label: "NEFT", icon: ArrowLeftRight },
  { id: "rtgs", label: "RTGS", icon: Building2 },
  { id: "imps", label: "IMPS", icon: Zap },
  { id: "loan", label: "Loan", icon: Landmark },
  { id: "emi", label: "EMI", icon: CalendarClock },
  { id: "other", label: "Other", icon: MoreHorizontal },
];
export const EMOJI_CHOICES = ["🍜","🍕","☕","🛒","🚕","🚗","⛽","🏠","💡","📱","🛍️","👕","💊","🏥","🎬","🎮","🎵","✈️","🏨","🏝️","📦","🎁","💰","📚","🐶","💪","💅","🍻"];
export const BUCKET_EMOJIS = ["💼","🏠","🧑‍🤝‍🧑","❤️","🛫","🎉","💰","🏖️","🍽️","🚗","🐱","🎓"];

export const MAX_PHOTOS = 2;

export const ROLE_LABELS = { owner: "Owner", manager: "Manager", viewer: "Viewer", payee: "Payee", member: "Manager" };

export const VAPID_PUBLIC_KEY = "BMue4ibU3zWXEtg6bwFgRP5h3lcBMs524xkemKqtrq62Rxk2KqO1mpV4VX04FrNa9Jnp53aK2pg36e-ImpgTd0o";
