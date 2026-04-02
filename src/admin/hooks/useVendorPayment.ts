import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAdminNavigation } from './useAdminNavigation';
import {
  getVendorByIdWithMaterials,
  getVendorFinancials,
  getAccountsForPayments,
  getVendorPayments,
  createVendorPayment,
  CASH_ACCOUNT_ID,
} from '../../services/middleware.service';

type PaymentMode = 'UPI' | 'Bank Transfer' | 'Cheque' | 'Cash';

/** Maps UI mode label → DB enum value */
function mapModeToDb(mode: PaymentMode): 'CASH' | 'UPI' | 'BANK' | 'CHEQUE' {
  switch (mode) {
    case 'Cash':
      return 'CASH';
    case 'UPI':
      return 'UPI';
    case 'Bank Transfer':
      return 'BANK';
    case 'Cheque':
      return 'CHEQUE';
    default:
      return 'UPI';
  }
}

export function useVendorPayment() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { goBack } = useAdminNavigation();

  // ─── Data ───
  const [vendor, setVendor] = useState<any>(null);
  const [financials, setFinancials] = useState<{
    total_purchase: number;
    total_paid: number;
    outstanding_balance: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; account_number: string }[]>([]);
  const [lastTransactionDate, setLastTransactionDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Form ───
  const [formData, setFormData] = useState({
    paymentAmount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    modeOfPayment: 'UPI' as PaymentMode,
    senderAccountId: '',      // account uuid
    receiverAccountInfo: '',  // free-text
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState<'success' | 'error'>('success');
  const [popupMessage, setPopupMessage] = useState('');

  // ─── Load vendor + financials + accounts ───
  useEffect(() => {
    if (!vendorId) return;

    const load = async () => {
      try {
        setLoading(true);

        // Fetch each resource independently so one failure doesn't block others
        const [vendorResult, financialsResult, accountsResult, paymentsResult] =
          await Promise.allSettled([
            getVendorByIdWithMaterials(vendorId),
            getVendorFinancials(vendorId),
            getAccountsForPayments(),
            getVendorPayments(vendorId, 1),
          ]);

        // Vendor (critical)
        if (vendorResult.status === 'fulfilled') {
          setVendor(vendorResult.value);
        } else {
          console.error('Failed to load vendor:', vendorResult.reason);
        }

        // Financials (may not exist for new vendors)
        if (financialsResult.status === 'fulfilled') {
          const fin = financialsResult.value;
          setFinancials({
            total_purchase: Number(fin.total_purchase ?? 0),
            total_paid: Number(fin.total_paid ?? 0),
            outstanding_balance: Number(fin.outstanding_balance ?? 0),
          });
        } else {
          console.error('Failed to load financials:', financialsResult.reason);
          setFinancials({ total_purchase: 0, total_paid: 0, outstanding_balance: 0 });
        }

        // Accounts
        if (accountsResult.status === 'fulfilled') {
          setAccounts(accountsResult.value);
        } else {
          console.error('Failed to load accounts:', accountsResult.reason);
        }

        // Payments (last transaction date)
        if (paymentsResult.status === 'fulfilled' && paymentsResult.value.data.length > 0) {
          setLastTransactionDate(paymentsResult.value.data[0].payment_date);
        }
      } catch (err) {
        console.error('Failed to load vendor payment data:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [vendorId]);

  // ─── Validation ───
  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    const amount = parseFloat(formData.paymentAmount);
    const outstanding = financials?.outstanding_balance ?? 0;

    if (!formData.paymentAmount || isNaN(amount) || amount <= 0) {
      newErrors.paymentAmount = 'Please enter a valid amount.';
    } else if (amount > outstanding) {
      newErrors.paymentAmount = `Amount cannot exceed outstanding balance (₹${outstanding.toLocaleString()}).`;
    }

    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required.';
    } else {
      // Parse as local date parts to avoid UTC timezone offset issues
      const [y, m, d] = formData.paymentDate.split('-').map(Number);
      const selected = new Date(y, m - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected > today) {
        newErrors.paymentDate = 'Date cannot be in the future.';
      }
    }

    if (!formData.modeOfPayment) {
      newErrors.modeOfPayment = 'Please select a payment mode.';
    }

    if (formData.modeOfPayment !== 'Cash') {
      if (!formData.senderAccountId) {
        newErrors.senderAccountId = 'Sender account is required.';
      }
      if (!formData.receiverAccountInfo.trim()) {
        newErrors.receiverAccountInfo = 'Receiver account info is required.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, financials]);

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!validate() || !vendorId) return;

    try {
      setSubmitting(true);

      const dbMode = mapModeToDb(formData.modeOfPayment);

      // For Cash mode, use the CASH_ACCOUNT_ID
      const senderAccountId =
        formData.modeOfPayment === 'Cash'
          ? CASH_ACCOUNT_ID
          : formData.senderAccountId;

      await createVendorPayment({
        vendor_id: vendorId,
        payment_date: formData.paymentDate,
        amount: parseFloat(formData.paymentAmount),
        mode: dbMode,
        sender_account_id: senderAccountId,
        receiver_account_info: formData.receiverAccountInfo || undefined,
      });

      setPopupType('success');
      setPopupMessage('Vendor payment recorded successfully.');
      setShowPopup(true);
    } catch (err: any) {
      console.error('Failed to create vendor payment:', err);
      setPopupType('error');
      setPopupMessage(err?.message || 'Unable to save payment. Please try again.');
      setShowPopup(true);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Popup close handler ───
  const handlePopupClose = () => {
    setShowPopup(false);
    if (popupType === 'success') {
      goBack(`/admin/vendors/${vendorId}/ledger`);
    }
  };

  // ─── Derived account lists ───
  const cashAccount = accounts.find(a => a.id === CASH_ACCOUNT_ID) ?? null;
  const nonCashAccounts = accounts.filter(a => a.id !== CASH_ACCOUNT_ID);

  // ─── Field updater ───
  const updateField = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // When mode changes, reset account fields appropriately
      if (field === 'modeOfPayment') {
        if (value === 'Cash') {
          updated.senderAccountId = CASH_ACCOUNT_ID;
          updated.receiverAccountInfo = '';
        } else {
          updated.senderAccountId = '';
          updated.receiverAccountInfo = '';
        }
      }

      return updated;
    });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return {
    vendorId,
    vendor,
    financials,
    accounts: nonCashAccounts,
    cashAccount,
    lastTransactionDate,
    loading,
    formData,
    errors,
    submitting,
    showPopup,
    popupType,
    popupMessage,
    updateField,
    handleSubmit,
    handlePopupClose,
    goBack,
  };
}
