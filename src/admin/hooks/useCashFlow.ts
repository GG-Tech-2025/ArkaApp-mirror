import { useEffect, useState, useCallback } from 'react';
import {
  getAccounts,
  createAccount,
  getFinancialSummary,
  getDailyCashSummary,
  CASH_ACCOUNT_ID,
} from '../../services/middleware.service';
import type { Account, CreateAccountInput, DailyCashSummary } from '../../services/types';
import { useAdminNavigation } from './useAdminNavigation';
import { validateCreateAccount } from '../validators/createAccount.validator';

export function useCashFlow() {
  const { goBack, goTo } = useAdminNavigation();

  // ─── Accounts ───
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // ─── Outstanding summary values ───
  const [outstandingReceivables, setOutstandingReceivables] = useState<number>(0);
  const [outstandingVendorPayables, setOutstandingVendorPayables] = useState<number>(0);
  const [outstandingLoanAmount, setOutstandingLoanAmount] = useState<number>(0);
  const [outstandingSalary, setOutstandingSalary] = useState<number>(0);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ─── Daily Cash Ledger ───
  const [dayLedgers, setDayLedgers] = useState<DailyCashSummary[]>([]);
  const [dayLedgersLoading, setDayLedgersLoading] = useState(false);
  const [dayLedgersLoadingMore, setDayLedgersLoadingMore] = useState(false);
  const [dayLedgersPage, setDayLedgersPage] = useState(0);
  const [hasMoreDayLedgers, setHasMoreDayLedgers] = useState(false);

  // ─── Create account form ───
  const [createAccountInput, setCreateAccountInput] = useState({
    account_number: '',
    opening_balance: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // ─── Popups ───
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');

  // ─── Derived values ───
  const cashAccount = accounts.find((a) => a.id === CASH_ACCOUNT_ID);
  const cashBalance = cashAccount ? Number(cashAccount.balance) : 0;
  const bankAccounts = accounts.filter((a) => a.id !== CASH_ACCOUNT_ID);

  // ─── Fetch accounts ───
  const fetchAccounts = useCallback(async () => {
    try {
      setAccountsLoading(true);
      const data = await getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setFailureMessage((err as Error).message || 'Failed to load accounts');
      setShowFailurePopup(true);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  // ─── Fetch outstanding summaries ───
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const summary = await getFinancialSummary();
      setOutstandingReceivables(summary.total_receivables);
      setOutstandingVendorPayables(summary.total_vendor_payables);
      setOutstandingLoanAmount(summary.total_loan_outstanding);
      setOutstandingSalary(summary.total_salary_payable);
    } catch (err) {
      console.error('Failed to load outstanding summaries:', err);
      setFailureMessage((err as Error).message || 'Failed to load summaries');
      setShowFailurePopup(true);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // ─── Fetch daily cash summary ───
  const fetchDayLedgers = useCallback(async (page: number, append = false) => {
    try {
      if (append) {
        setDayLedgersLoadingMore(true);
      } else {
        setDayLedgersLoading(true);
      }

      const result = await getDailyCashSummary(page, 20);

      if (append) {
        setDayLedgers((prev) => [...prev, ...result.data]);
      } else {
        setDayLedgers(result.data);
      }

      setDayLedgersPage(page);
      setHasMoreDayLedgers(result.has_more);
    } catch (err) {
      console.error('Failed to load daily cash summary:', err);
      setFailureMessage((err as Error).message || 'Failed to load daily cash ledger');
      setShowFailurePopup(true);
    } finally {
      setDayLedgersLoading(false);
      setDayLedgersLoadingMore(false);
    }
  }, []);

  const handleLoadMoreDayLedgers = useCallback(() => {
    if (hasMoreDayLedgers && !dayLedgersLoadingMore) {
      fetchDayLedgers(dayLedgersPage + 1, true);
    }
  }, [hasMoreDayLedgers, dayLedgersLoadingMore, dayLedgersPage, fetchDayLedgers]);

  // ─── Load on mount ───
  useEffect(() => {
    fetchAccounts();
    fetchSummary();
    fetchDayLedgers(0);
  }, [fetchAccounts, fetchSummary, fetchDayLedgers]);

  // ─── Create account form helpers ───
  const updateCreateAccountInput = (field: 'account_number' | 'opening_balance', value: string) => {
    setCreateAccountInput((prev) => ({ ...prev, [field]: value }));
  };

  const openCreateAccountModal = () => {
    setCreateAccountInput({ account_number: '', opening_balance: '' });
    setErrors({});
    setShowCreateAccountModal(true);
  };

  const closeCreateAccountModal = () => {
    setShowCreateAccountModal(false);
    setErrors({});
  };

  const handleCreateAccount = async () => {
    const parsed: CreateAccountInput = {
      account_number: createAccountInput.account_number,
      opening_balance: createAccountInput.opening_balance === '' ? NaN : Number(createAccountInput.opening_balance),
    };
    const validationErrors = validateCreateAccount(parsed);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      setCreateLoading(true);
      await createAccount({
        account_number: parsed.account_number.trim(),
        opening_balance: parsed.opening_balance,
      });
      setShowCreateAccountModal(false);
      setShowSuccessPopup(true);
      await fetchAccounts();
    } catch (err) {
      console.error('Failed to create account:', err);
      setFailureMessage((err as Error).message || 'Failed to create account');
      setShowFailurePopup(true);
    } finally {
      setCreateLoading(false);
    }
  };

  return {
    // Accounts
    accounts,
    accountsLoading,
    cashBalance,
    bankAccounts,

    // Outstanding summaries
    outstandingReceivables,
    outstandingVendorPayables,
    outstandingLoanAmount,
    outstandingSalary,
    summaryLoading,

    // Daily cash ledger
    dayLedgers,
    dayLedgersLoading,
    dayLedgersLoadingMore,
    hasMoreDayLedgers,
    handleLoadMoreDayLedgers,

    // Create account
    createAccountInput,
    errors,
    showCreateAccountModal,
    createLoading,
    updateCreateAccountInput,
    openCreateAccountModal,
    closeCreateAccountModal,
    handleCreateAccount,

    // Popups
    showSuccessPopup,
    setShowSuccessPopup,
    showFailurePopup,
    setShowFailurePopup,
    failureMessage,

    // Navigation
    goBack,
    goTo,
  };
}
