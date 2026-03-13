import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAdminNavigation } from './useAdminNavigation';
import {
  getAccounts,
  getEmployeeLedger,
  createSalaryLedgerEntry,
} from '../../services/middleware.service';
import {
  validateAddPayment,
  type AddPaymentFormInput,
  type PaymentEntryTypeLabel,
  type PaymentModeLabel,
} from '../validators/addPayment.validator';
import type { Account, EmployeeSummary, SalaryLedgerEntryType } from '../../services/types';

const ENTRY_TYPE_TO_DB: Record<Exclude<PaymentEntryTypeLabel, ''>, SalaryLedgerEntryType> = {
  'Advance Payment': 'ADVANCE',
  'Weekly Payment': 'WEEKLY',
  'Emergency Payment': 'EMERGENCY',
  'Daily / Ad-hoc Payment': 'DAILY',
  'Partial Settlement': 'PARTIAL_SETTLEMENT',
  'Full Settlement': 'FULL_SETTLEMENT',
};

const PAYMENT_MODE_TO_DB: Record<PaymentModeLabel, string> = {
  UPI: 'UPI',
  'Bank Transfer': 'BANK',
  Cheque: 'CHEQUE',
  Cash: 'CASH',
};

export function useAddPayment() {
  const { id: employeeId } = useParams<{ id: string }>();
  const { goBack } = useAdminNavigation();

  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);

  const [formInput, setFormInput] = useState<AddPaymentFormInput>({
    entryType: '',
    amount: '',
    dateTime: new Date().toISOString().slice(0, 16),
    notes: '',
    modeOfPayment: 'UPI',
    senderAccountId: '',
    receiverAccountInfo: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);

  useEffect(() => {
    if (!employeeId) return;

    Promise.all([
      getEmployeeLedger(employeeId, 0, false, undefined, undefined),
      getAccounts(),
    ])
      .then(([ledger, accts]) => {
        setEmployee(ledger.employee);
        setAccounts(accts);
      })
      .catch((err) => console.error('Failed to load data:', err))
      .finally(() => setLoadingData(false));
  }, [employeeId]);

  function updateFormInput<K extends keyof AddPaymentFormInput>(
    field: K,
    value: AddPaymentFormInput[K]
  ) {
    setFormInput((prev) => ({ ...prev, [field]: value }));
  }

  function handleEntryTypeChange(type: PaymentEntryTypeLabel) {
    const runningBalance = employee?.running_balance ?? 0;
    if (type === 'Full Settlement') {
      setFormInput((prev) => ({ ...prev, entryType: type, amount: runningBalance.toString() }));
    } else {
      setFormInput((prev) => ({
        ...prev,
        entryType: type,
        amount: prev.entryType === 'Full Settlement' ? '' : prev.amount,
      }));
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.entryType;
      delete next.amount;
      return next;
    });
  }

  function handleModeOfPaymentChange(mode: PaymentModeLabel) {
    setFormInput((prev) => ({
      ...prev,
      modeOfPayment: mode,
      senderAccountId: '',
      receiverAccountInfo: '',
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.senderAccountId;
      delete next.receiverAccountInfo;
      return next;
    });
  }

  const handleCreate = async () => {
    if (!employeeId) return;

    const runningBalance = employee?.running_balance ?? 0;
    const newErrors = validateAddPayment(formInput, runningBalance);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    if (!formInput.entryType) return;

    try {
      setLoading(true);
      await createSalaryLedgerEntry({
        employee_id: employeeId,
        entry_type: ENTRY_TYPE_TO_DB[formInput.entryType as Exclude<PaymentEntryTypeLabel, ''>],
        amount: Number(formInput.amount),
        payment_mode: PAYMENT_MODE_TO_DB[formInput.modeOfPayment],
        sender_account_id:
          formInput.modeOfPayment !== 'Cash' ? formInput.senderAccountId : null,
        receiver_account:
          formInput.modeOfPayment !== 'Cash' ? formInput.receiverAccountInfo.trim() : null,
        notes: formInput.notes.trim() || null,
        created_at: new Date(formInput.dateTime).toISOString(),
      });
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Failed to create salary ledger entry:', err);
      setErrors((prev) => ({
        ...prev,
        form: (err as Error).message || 'Failed to save entry',
      }));
      setShowFailurePopup(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
    goBack(`/admin/employees/salary-ledger/${employeeId}`);
  };

  const handleFailureClose = () => {
    setShowFailurePopup(false);
  };

  const isAmountDisabled = formInput.entryType === 'Full Settlement';

  return {
    employee,
    accounts,
    loadingData,
    loading,
    formInput,
    updateFormInput,
    handleEntryTypeChange,
    handleModeOfPaymentChange,
    errors,
    showSuccessPopup,
    showFailurePopup,
    handleCreate,
    handleSuccessClose,
    handleFailureClose,
    isAmountDisabled,
    goBack,
    employeeId,
  };
}
