import React, { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPlatformBranches, getPlatformOrganizations } from "../services/middleware.service";
import type { PlatformBranchRow, PlatformOrganization } from "../services/types";
import { daysUntil, formatDate, renewalStatus, toneClass } from "../utils/dates";
import { PlatformLayout } from "./components/PlatformLayout";
import { OrganizationStatusBadge } from "./components/StatusBadge";
import { RecordPaymentModal } from "./components/RecordPaymentModal";

const SOON_DAYS = 7;

interface Attention {
  /** Lower comes first. */
  rank: number;
  /** Tie-break inside a rank: days until renewal (most overdue first). */
  days: number;
  label: string;
  tone: "overdue" | "soon" | "none";
}

/** What, if anything, needs the operator's attention about a branch. */
function attentionOf(b: PlatformBranchRow): Attention | null {
  const paused = b.status !== "ACTIVE";
  const r = b.renewalDate ? daysUntil(b.renewalDate) : null;
  const overdueText = r !== null && r < 0 ? `overdue by ${-r} day${r === -1 ? "" : "s"}` : null;

  if (paused) {
    return { rank: 2, days: r ?? 0, label: overdueText ? `Paused, ${overdueText}` : "Paused", tone: "overdue" };
  }
  if (r === null) return { rank: 5, days: 0, label: "No renewal date set", tone: "none" };
  if (r < 0) return { rank: 1, days: r, label: `Overdue by ${-r} day${r === -1 ? "" : "s"}`, tone: "overdue" };
  if (r <= SOON_DAYS) {
    return { rank: 3, days: r, label: r === 0 ? "Due today" : `Due in ${r} day${r === 1 ? "" : "s"}`, tone: "soon" };
  }
  return null;
}

function Card({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "bad" | "warn" }) {
  const color = tone === "bad" && value > 0 ? "text-red-700" : tone === "warn" && value > 0 ? "text-amber-700" : "text-gray-900";
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

/** The platform's front page: how the business stands, what needs attention, and every client. */
export function PlatformHomeScreen() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [branches, setBranches] = useState<PlatformBranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payFor, setPayFor] = useState<PlatformBranchRow | null>(null);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [o, b] = await Promise.all([getPlatformOrganizations(), getPlatformBranches()]);
      setOrgs(o);
      setBranches(b);
      setError("");
    } catch {
      setError("Could not load the platform. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const withIssues = branches
    .map((b) => ({ b, a: attentionOf(b) }))
    .filter((x): x is { b: PlatformBranchRow; a: Attention } => x.a !== null)
    .sort((x, y) => x.a.rank - y.a.rank || x.a.days - y.a.days);

  const activeBranches = branches.filter((b) => b.status === "ACTIVE").length;
  const pausedBranches = branches.length - activeBranches;
  const overdue = branches.filter((b) => b.renewalDate && daysUntil(b.renewalDate) < 0).length;
  const dueSoon = branches.filter((b) => b.renewalDate && daysUntil(b.renewalDate) >= 0 && daysUntil(b.renewalDate) <= SOON_DAYS).length;
  const noDate = branches.filter((b) => !b.renewalDate).length;
  const suspendedClients = orgs.filter((o) => o.status !== "ACTIVE").length;

  return (
    <PlatformLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-gray-900">Overview</h1>
        <button
          onClick={() => navigate("/platform/organizations/new")}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700"
        >
          <Plus className="w-4 h-4" /> New organization
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 flex justify-between gap-4">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss" className="hover:opacity-70">
            ×
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card label="Clients" value={orgs.length} sub={suspendedClients ? `${suspendedClients} suspended` : undefined} tone="bad" />
            <Card label="Active branches" value={activeBranches} />
            <Card label="Paused branches" value={pausedBranches} tone="bad" />
            <Card label="Overdue" value={overdue} tone="bad" />
            <Card label={`Due in ${SOON_DAYS} days`} value={dueSoon} tone="warn" />
            <Card label="No renewal date" value={noDate} />
          </div>

          <section className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-gray-900 mb-4">Needs attention</h2>
            {withIssues.length === 0 ? (
              <p className="text-gray-500">Nothing needs attention right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-gray-500 text-sm">
                    <tr>
                      <th className="py-2 pr-4">Client</th>
                      <th className="py-2 pr-4">Branch</th>
                      <th className="py-2 pr-4">Issue</th>
                      <th className="py-2 pr-4">Renewal</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {withIssues.map(({ b, a }) => (
                      <tr key={b.id} className="border-t border-gray-100">
                        <td className="py-3 pr-4">
                          <button onClick={() => navigate(`/platform/organizations/${b.organizationId}`)} className="text-gray-900 hover:underline text-left">
                            {b.organizationName}
                          </button>
                          {b.organizationStatus !== "ACTIVE" && <div className="text-xs text-red-700">client suspended</div>}
                        </td>
                        <td className="py-3 pr-4">{b.name}</td>
                        <td className={`py-3 pr-4 ${a.tone === "overdue" ? "text-red-700" : a.tone === "soon" ? "text-amber-700" : "text-gray-500"}`}>{a.label}</td>
                        <td className="py-3 pr-4">{formatDate(b.renewalDate)}</td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <button onClick={() => setPayFor(b)} className="text-sm px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-700 mr-2">
                            Record payment
                          </button>
                          <button onClick={() => navigate(`/platform/organizations/${b.organizationId}`)} className="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
                            Open client
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-gray-900 mb-4">Clients</h2>
            {orgs.length === 0 ? (
              <p className="text-gray-500">No clients yet. Create the first one.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-gray-500 text-sm">
                    <tr>
                      <th className="py-2 pr-4">Client</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Branches</th>
                      <th className="py-2 pr-4">Next renewal</th>
                      <th className="py-2 pr-4">Admin phone</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((o) => {
                      const r = renewalStatus(o.nextRenewalDate);
                      return (
                        <tr key={o.id} className="border-t border-gray-100">
                          <td className="py-3 pr-4">
                            <div className="text-gray-900">{o.name}</div>
                            <div className="text-sm text-gray-500">{o.slug}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <OrganizationStatusBadge status={o.status} />
                          </td>
                          <td className="py-3 pr-4">
                            {o.branchCount}
                            {o.branchesPaused > 0 && <div className="text-sm text-red-700">{o.branchesPaused} paused</div>}
                          </td>
                          <td className="py-3 pr-4">
                            <div>{formatDate(o.nextRenewalDate)}</div>
                            <div className={`text-sm ${toneClass[r.tone]}`}>{r.text}</div>
                          </td>
                          <td className="py-3 pr-4">{o.adminPhones.join(", ") || "—"}</td>
                          <td className="py-3 pr-4">{formatDate(o.createdAt)}</td>
                          <td className="py-3 text-right">
                            <button onClick={() => navigate(`/platform/organizations/${o.id}`)} className="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {payFor && (
        <RecordPaymentModal
          branchId={payFor.id}
          branchName={`${payFor.organizationName} · ${payFor.name}`}
          isPaused={payFor.status !== "ACTIVE"}
          renewalDate={payFor.renewalDate}
          onDone={async (message) => {
            setPayFor(null);
            setNotice(message);
            await refresh();
          }}
          onClose={() => setPayFor(null)}
        />
      )}
    </PlatformLayout>
  );
}
