import React, { useState } from "react";
import { Modal, fieldClass } from "./Modal";

interface NoteModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** Red confirm button, for actions that lock people out. */
  danger?: boolean;
  noteLabel?: string;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
}

/** Asks "are you sure?" with an optional reason that is kept in the history. */
export function NoteModal({ title, message, confirmLabel, danger, noteLabel = "Reason (optional)", onConfirm, onClose }: NoteModalProps) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(note);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-gray-600 mb-4">{message}</div>
      <label className="block text-gray-700 text-sm mb-1">{noteLabel}</label>
      <input className={fieldClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mt-4 text-sm">{error}</div>}
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-slate-800 hover:bg-slate-700"}`}
        >
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
