import React from "react";

const styles: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
  warn: "bg-amber-100 text-amber-800",
  neutral: "bg-gray-100 text-gray-700",
};

export function StatusBadge({ kind, children }: { kind: keyof typeof styles; children: React.ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${styles[kind]}`}>{children}</span>;
}

/** Active / Paused for a branch. */
export function BranchStatusBadge({ status }: { status: string }) {
  return status === "ACTIVE" ? <StatusBadge kind="active">Active</StatusBadge> : <StatusBadge kind="paused">Paused</StatusBadge>;
}

/** Active / Suspended / Cancelled for a whole client. */
export function OrganizationStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <StatusBadge kind="active">Active</StatusBadge>;
  if (status === "SUSPENDED") return <StatusBadge kind="suspended">Suspended</StatusBadge>;
  return <StatusBadge kind="neutral">Cancelled</StatusBadge>;
}
