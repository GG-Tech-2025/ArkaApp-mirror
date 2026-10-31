import React, { useState } from "react";
import { Modal, fieldClass } from "./Modal";
import { recordBranchPayment } from "../../services/middleware.service";
import { addMonths, daysUntil, formatDate, todayPlus } from "../../utils/dates";

interface RecordPaymentModalProps {
  branchId: string;
  branchName: string;
  isPaused: boolean;
  renewalDate: string | null;
  onDone: (message: string) => void;
  onClose: () => void;
}

/**
 * Records a payment received for a branch and moves its renewal date. The new date
 * is suggested from the current one (or from today when it has passed or is unset),
 * with quick buttons for the usual periods.
 */
export function RecordPaymentModal({ branchId, branchName, isPaused, renewalDate, onDone, onClose }: RecordPaymentModalProps) {
  const today = todayPlus(0);
  // Extend from the current renewal date while it is still ahead; otherwise start from today.
  const base = renewalDate && daysUntil(renewalDate) >= 0 ? renewalDate : today;

  const [paidOn, setPaidOn] = useState(today);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [newRenewal, setNewRenewal] = useState(addMonths(base, 1));
  const [resume, setResume] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    if (!paidOn || !newRenewal) {
      setError("The payment date and the new renewal date are required.");
      return;
    }
    if (newRenewal <= paidOn) {
      setError("The new renewal date must be after the payment date.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await recordBranchPayment({
        branchId,
        paidOn,
        renewalDate: newRenewal,
        amount: amount.trim() === "" ? undefined : Number(amount),
        reference,
        note,
        resume: isPaused && resume,
      });
      onDone(
        `Payment recorded for ${branchName}. Renewal is now ${formatDate(newRenewal)}${isPaused && resume ? " and the branch is active again" : ""}.`
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const quick = (months: number) => (
    <button
      type="button"
      onClick={() => setNewRenewal(addMonths(base, months))}
      className="px-2 py-1 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
    >
      {months === 12 ? "+1 year" : `+${months} month${months === 1 ? "" : "s"}`}
    </button>
  );

  return (
    <Modal title={`Record payment: ${branchName}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-700 text-sm mb-1">Payment date *</label>
            <input type="date" max={today} className={fieldClass} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          <div>
            <label className="block text-gray-700 text-sm mb-1">Amount (₹)</label>
            <input type="number" min={0} step="0.01" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-gray-700 text-sm mb-1">Reference</label>
          <input className={fieldClass} value={reference} maxLength={200} placeholder="UPI / cheque / bank reference" onChange={(e) => setReference(e.target.value)} />
        </div>
        <div>
          <label className="block text-gray-700 text-sm mb-1">New renewal date *</label>
          <input type="date" className={fieldClass} value={newRenewal} onChange={(e) => setNewRenewal(e.target.value)} />
          <div className="flex gap-2 mt-2 items-center">
            <span className="text-xs text-gray-500">From {formatDate(base)}:</span>
            {quick(1)}
            {quick(3)}
            {quick(12)}
          </div>
        </div>
        <div>
          <label className="block text-gray-700 text-sm mb-1">Note</label>
          <input className={fieldClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
        {isPaused && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={resume} onChange={(e) => setResume(e.target.checked)} />
            This branch is paused: resume it now
          </label>
        )}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mt-4 text-sm">{error}</div>}
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={submit} disabled={busy} className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-60">
          {busy ? "Saving..." : "Record payment"}
        </button>
      </div>
    </Modal>
  );
}
