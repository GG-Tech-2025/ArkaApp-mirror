import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getBillingEvents,
  getOrganizationAdmins,
  getOrganizationBranches,
  getPlatformOrganization,
  setBranchActive,
  setOrganizationActive,
  validateSession,
} from "../services/middleware.service";
import type {
  BranchBillingEvent,
  OrganizationAdmin,
  PlatformBranch,
  PlatformOrganizationDetail,
} from "../services/types";
import { formatDate, renewalStatus, toneClass } from "../utils/dates";
import { describeEvent } from "./billingText";
import { PlatformLayout } from "./components/PlatformLayout";
import { BranchStatusBadge, OrganizationStatusBadge } from "./components/StatusBadge";
import { NoteModal } from "./components/NoteModal";
import { RecordPaymentModal } from "./components/RecordPaymentModal";
import { RenewalModal } from "./components/RenewalModal";

type ModalState =
  | { kind: "payment"; branch: PlatformBranch }
  | { kind: "renewal"; branch: PlatformBranch }
  | { kind: "pause"; branch: PlatformBranch }
  | { kind: "resume"; branch: PlatformBranch }
  | { kind: "suspend" }
  | { kind: "unsuspend" }
  | null;

const cardClass = "bg-white rounded-lg shadow p-6 mb-6";

/** One client: its branches with the billing controls, its admins, and its history. */
export function OrganizationScreen() {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();

  const [org, setOrg] = useState<PlatformOrganizationDetail | null>(null);
  const [branches, setBranches] = useState<PlatformBranch[]>([]);
  const [admins, setAdmins] = useState<OrganizationAdmin[]>([]);
  const [events, setEvents] = useState<BranchBillingEvent[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [o, b, a, e, user] = await Promise.all([
        getPlatformOrganization(organizationId),
        getOrganizationBranches(organizationId),
        getOrganizationAdmins(organizationId),
        getBillingEvents(organizationId),
        validateSession(),
      ]);
      setOrg(o);
      setBranches(b);
      setAdmins(a);
      setEvents(e);
      setMyId(user?.id ?? null);
      setError(o ? "" : "Client not found.");
    } catch {
      setError("Could not load this client. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const done = async (message: string) => {
    setModal(null);
    setNotice(message);
    await refresh();
  };

  if (loading) {
    return (
      <PlatformLayout>
        <p className="text-gray-500">Loading...</p>
      </PlatformLayout>
    );
  }

  if (!org) {
    return (
      <PlatformLayout>
        <p className="text-red-700 mb-4">{error || "Client not found."}</p>
        <button onClick={() => navigate("/platform")} className="text-slate-700 underline">
          Back to all clients
        </button>
      </PlatformLayout>
    );
  }

  const suspended = org.status !== "ACTIVE";
  const branchName = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? "Removed branch" : "Whole client");

  return (
    <PlatformLayout>
      <button onClick={() => navigate("/platform")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-5 h-5" /> All clients
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-gray-900">{org.name}</h1>
            <OrganizationStatusBadge status={org.status} />
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {org.slug}
            {org.contactEmail ? ` · ${org.contactEmail}` : ""}
            {org.contactPhone ? ` · ${org.contactPhone}` : ""} · created {formatDate(org.createdAt)}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/platform/organizations/${org.id}/branches/new`)}
            className="flex items-center gap-2 border border-gray-300 bg-white text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" /> Add branch
          </button>
          {org.status === "ACTIVE" && (
            <button onClick={() => setModal({ kind: "suspend" })} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              Suspend client
            </button>
          )}
          {org.status === "SUSPENDED" && (
            <button onClick={() => setModal({ kind: "unsuspend" })} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
              Resume client
            </button>
          )}
        </div>
      </div>

      {suspended && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          This client is {org.status === "SUSPENDED" ? "suspended" : "cancelled"}: nobody at any of its branches can use the app, whatever
          each branch's own status says.
        </div>
      )}
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex justify-between gap-4">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss" className="hover:opacity-70">
            ×
          </button>
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

      <section className={cardClass}>
        <h2 className="text-gray-900 mb-4">Branches</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-gray-500 text-sm">
              <tr>
                <th className="py-2 pr-4">Branch</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last payment</th>
                <th className="py-2 pr-4">Renewal</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => {
                const r = renewalStatus(b.renewalDate);
                const paused = b.status !== "ACTIVE";
                return (
                  <tr key={b.id} className="border-t border-gray-100 align-top">
                    <td className="py-3 pr-4">
                      <div className="text-gray-900">{b.name}</div>
                      <div className="text-sm text-gray-500">{b.code}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <BranchStatusBadge status={b.status} />
                    </td>
                    <td className="py-3 pr-4">{formatDate(b.lastPaymentDate)}</td>
                    <td className="py-3 pr-4">
                      <div>{formatDate(b.renewalDate)}</div>
                      <div className={`text-sm ${toneClass[r.tone]}`}>{r.text}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button onClick={() => setModal({ kind: "payment", branch: b })} className="text-sm px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                          Record payment
                        </button>
                        <button onClick={() => setModal({ kind: "renewal", branch: b })} className="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
                          Renewal date
                        </button>
                        {paused ? (
                          <button onClick={() => setModal({ kind: "resume", branch: b })} className="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
                            Resume
                          </button>
                        ) : (
                          <button onClick={() => setModal({ kind: "pause", branch: b })} className="text-sm px-3 py-1 border border-red-300 text-red-700 rounded-lg hover:bg-red-50">
                            Pause
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-gray-900 mb-4">Admins</h2>
        {admins.length === 0 ? (
          <p className="text-gray-500">This client has no admin yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-gray-500 text-sm">
                <tr>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.userId} className="border-t border-gray-100">
                    <td className="py-3 pr-4 break-all">{a.email}</td>
                    <td className="py-3 pr-4">{a.phone}</td>
                    <td className="py-3">{a.lastSignInAt ? formatDate(a.lastSignInAt) : <span className="text-gray-500">Never</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-gray-900 mb-4">History</h2>
        {events.length === 0 ? (
          <p className="text-gray-500">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {events.map((e) => (
              <li key={e.id} className="py-3 flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-gray-500 text-sm w-28 shrink-0">{formatDate(e.eventType === "PAYMENT" ? e.happenedOn : e.createdAt)}</span>
                <span className="text-gray-500 text-sm w-32 shrink-0">{branchName(e.branchId)}</span>
                <span className="flex-1 text-gray-900 min-w-[12rem]">{describeEvent(e)}</span>
                <span className="text-gray-400 text-sm">{e.actorId === null ? "" : e.actorId === myId ? "by you" : "by another operator"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal?.kind === "payment" && (
        <RecordPaymentModal
          branchId={modal.branch.id}
          branchName={modal.branch.name}
          isPaused={modal.branch.status !== "ACTIVE"}
          renewalDate={modal.branch.renewalDate}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "renewal" && (
        <RenewalModal
          branchId={modal.branch.id}
          branchName={modal.branch.name}
          currentRenewalDate={modal.branch.renewalDate}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "pause" && (
        <NoteModal
          title={`Pause ${modal.branch.name}?`}
          message="Everyone at this branch, admins and employees, will lose access right away, even if they are signed in. Their data is kept. Their other branches are not affected."
          confirmLabel="Pause branch"
          danger
          onConfirm={async (note) => {
            await setBranchActive(modal.branch.id, false, note);
            await done(`${modal.branch.name} is paused.`);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "resume" && (
        <NoteModal
          title={`Resume ${modal.branch.name} without a payment?`}
          message="Access comes back right away. If a payment has been received, use Record payment instead: it resumes the branch and records the payment too."
          confirmLabel="Resume branch"
          onConfirm={async (note) => {
            await setBranchActive(modal.branch.id, true, note);
            await done(`${modal.branch.name} is active again.`);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "suspend" && (
        <NoteModal
          title={`Suspend ${org.name}?`}
          message="Nobody at any of this client's branches will be able to use the app until you resume it, whatever each branch's own status is."
          confirmLabel="Suspend client"
          danger
          onConfirm={async (note) => {
            await setOrganizationActive(org.id, false, note);
            await done(`${org.name} is suspended.`);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "unsuspend" && (
        <NoteModal
          title={`Resume ${org.name}?`}
          message="Its branches that are active will work again right away. Branches you paused individually stay paused."
          confirmLabel="Resume client"
          onConfirm={async (note) => {
            await setOrganizationActive(org.id, true, note);
            await done(`${org.name} is active again.`);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </PlatformLayout>
  );
}
