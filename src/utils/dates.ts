/** Small date helpers for the platform screens. Dates are plain YYYY-MM-DD strings (no time zone). */

const pad = (n: number) => String(n).padStart(2, "0");

/** Today (in the browser's local time) plus `days`, as YYYY-MM-DD. */
export function todayPlus(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days from today until `iso` (negative when it is in the past). */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** Accepts a plain date (YYYY-MM-DD) or a full timestamp. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = iso.length > 10 ? new Date(iso) : (() => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** "Overdue by 3 days", "Due today", "In 5 days", or "Not set", with a tone the screens colour by. */
export function renewalStatus(iso: string | null): { text: string; tone: "none" | "overdue" | "soon" | "ok" } {
  if (!iso) return { text: "Not set", tone: "none" };
  const n = daysUntil(iso);
  if (n < 0) return { text: `Overdue by ${-n} day${n === -1 ? "" : "s"}`, tone: "overdue" };
  if (n === 0) return { text: "Due today", tone: "soon" };
  if (n <= 7) return { text: `In ${n} day${n === 1 ? "" : "s"}`, tone: "soon" };
  return { text: `In ${n} days`, tone: "ok" };
}

export const toneClass: Record<"none" | "overdue" | "soon" | "ok", string> = {
  none: "text-gray-500",
  overdue: "text-red-700",
  soon: "text-amber-700",
  ok: "text-gray-500",
};

/** `iso` plus `months` calendar months, keeping the day (or the month's last day when it is shorter). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = total % 12;
  const lastDay = new Date(ty, tm + 1, 0).getDate();
  return `${ty}-${pad(tm + 1)}-${pad(Math.min(d, lastDay))}`;
}
