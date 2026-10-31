import React, { useState } from "react";
import { Modal, fieldClass } from "./Modal";
import { setBranchRenewalDate } from "../../services/middleware.service";
import { todayPlus } from "../../utils/dates";

interface RenewalModalProps {
  branchId: string;
  branchName: string;
  currentRenewalDate: string | null;
  onDone: (message: string) => void;
  onClose: () => void;
}

/** Moves a branch's renewal date without recording a payment (for example a goodwill extension). */
export function RenewalModal({ branchId, branchName, currentRenewalDate, onDone, onClose }: RenewalModalProps) {
  const [date, setDate] = useState(currentRenewalDate ?? todayPlus(30));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy || !date) return;
    setBusy(true);
    setError("");
    try {
      await setBranchRenewalDate(branchId, date, note);
      onDone(`Renewal date for ${branchName} changed.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Change renewal date: ${branchName}`} onClose={onClose}>
      <p className="text-gray-600 text-sm mb-4">
        This only moves the date; it does not record a payment. To record a payment, use "Record payment".
      </p>
      <label className="block text-gray-700 text-sm mb-1">New renewal date</label>
      <input type="date" className={fieldClass} value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="block text-gray-700 text-sm mb-1 mt-4">Reason (optional)</label>
      <input className={fieldClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mt-4 text-sm">{error}</div>}
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={submit} disabled={busy || !date} className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-60">
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}
