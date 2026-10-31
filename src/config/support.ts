/**
 * Where a client should turn when their branch is paused. Set these in the app's
 * environment (.env locally, the hosting dashboard in production):
 *
 *   VITE_SUPPORT_PHONE=+91 98765 43210
 *   VITE_SUPPORT_EMAIL=support@example.com
 *
 * With neither set, the paused screen just says to contact GG-Tech support.
 */
const clean = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

export const support = {
  phone: clean(import.meta.env.VITE_SUPPORT_PHONE),
  email: clean(import.meta.env.VITE_SUPPORT_EMAIL),
};
