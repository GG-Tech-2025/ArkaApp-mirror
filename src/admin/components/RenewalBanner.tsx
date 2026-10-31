import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { daysUntil, formatDate } from "../../utils/dates";

const SOON_DAYS = 7;

/**
 * A slim reminder at the top of the admin app when the active branch's renewal is
 * due within a week, or has passed. A "due soon" reminder can be dismissed for the
 * rest of the session; an overdue one stays, because the branch is at risk of
 * being paused.
 */
export function RenewalBanner() {
  const { activeBranch } = useTenant();
  const key = activeBranch ? `renewal-banner:${activeBranch.id}:${activeBranch.renewalDate}` : "";
  const [, redraw] = useState(0);
  // Read per branch on every render, so switching branches never shows another branch's answer.
  let dismissed = false;
  try {
    dismissed = key !== "" && sessionStorage.getItem(key) === "1";
  } catch {
    /* no session storage: the reminder simply cannot be dismissed */
  }

  if (!activeBranch?.renewalDate) return null;
  const days = daysUntil(activeBranch.renewalDate);
  if (days > SOON_DAYS) return null;

  const overdue = days < 0;
  if (!overdue && dismissed) return null;

  const when = overdue
    ? `was due on ${formatDate(activeBranch.renewalDate)} (${-days} day${days === -1 ? "" : "s"} ago)`
    : days === 0
      ? `is due today (${formatDate(activeBranch.renewalDate)})`
      : `is due on ${formatDate(activeBranch.renewalDate)} (in ${days} day${days === 1 ? "" : "s"})`;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 px-4 py-3 text-sm ${
        overdue ? "bg-red-50 text-red-800 border-b border-red-200" : "bg-amber-50 text-amber-900 border-b border-amber-200"
      }`}
    >
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <p className="flex-1">
        The payment for <strong>{activeBranch.name}</strong> {when}.{" "}
        {overdue
          ? "Please pay now to avoid this branch being paused."
          : "Please make the payment to avoid any interruption."}
      </p>
      {!overdue && (
        <button
          aria-label="Dismiss"
          onClick={() => {
            try {
              sessionStorage.setItem(key, "1");
            } catch {
              /* the reminder just comes back next time */
            }
            redraw((n) => n + 1);
          }}
          className="shrink-0 hover:opacity-70"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
