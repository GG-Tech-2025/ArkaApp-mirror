import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createLoanLedgerTransaction, getAccounts, getLoanById, CASH_ACCOUNT_ID } from '../../services/middleware.service';
import type { Account, CreateLoanLedgerInput, Loan, LoanTransactionType } from '../../services/types';
import { validateAddLoanTransaction } from '../validators/addLoanTransaction.validator.ts';

type TransactionInput = {
  transaction_type: LoanTransactionType;
  amount: number;
  transaction_date: string;
  payment_mode: 'CASH' | 'BANK' | 'UPI' | 'CHEQUE';
  sender_account_id: string;
  receiver_account_info: string;
  notes: string;
};

export function useAddLoanTransaction() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loanLoading, setLoanLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [transactionInput, setTransactionInput] = useState<TransactionInput>({
    transaction_type: 'REPAYMENT',
    amount: 0,
    transaction_date: '',
    payment_mode: 'BANK',
    sender_account_id: '',
    receiver_account_info: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load loan details
  useEffect(() => {
    if (!loanId) return;

    let mounted = true;
    (async () => {
      try {
        setLoanLoading(true);
        const loanData = await getLoanById(loanId);
        if (!mounted) return;
        setLoan(loanData || null);
      } catch (err) {
        console.error('Failed to load loan details:', err);
      } finally {
        if (mounted) setLoanLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loanId]);

  // Load accounts
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setAccountsLoading(true);
        const data = await getAccounts();
        if (!mounted) return;
        setAccounts(data);
      } catch (err) {
        console.error('Failed to load accounts:', err);
      } finally {
        if (mounted) setAccountsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const updateTransactionInput = <K extends keyof TransactionInput>(
    key: K,
    value: TransactionInput[K]
  ) => {
    setTransactionInput((prev) => ({ ...prev, [key]: value }));

    // Set sender_account_id to CASH_ACCOUNT_ID and clear RAI when mode changes to CASH
    if (key === 'payment_mode' && value === 'CASH') {
      setTransactionInput((prev) => ({
        ...prev,
        payment_mode: 'CASH',
        sender_account_id: CASH_ACCOUNT_ID,
        receiver_account_info: '',
      }));
    }

    // Clear account balance error when account changes
    if (key === 'sender_account_id' || key === 'amount') {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.amount_exceeds_balance;
        return next;
      });
    }
  };

  // Get selected account's balance for validation
  const getSelectedAccountBalance = (): number | undefined => {
    const accountId = transactionInput.payment_mode === 'CASH'
      ? CASH_ACCOUNT_ID
      : transactionInput.sender_account_id;
    if (!accountId) return undefined;
    const account = accounts.find((a) => a.id === accountId);
    return account?.balance;
  };

  const selectedAccountBalance = getSelectedAccountBalance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loanId) return;

    // Create input object for validation
    const input: Omit<CreateLoanLedgerInput, 'loan_id'> = {
      transaction_type: transactionInput.transaction_type,
      amount: transactionInput.amount,
      transaction_date: transactionInput.transaction_date,
      payment_mode: transactionInput.payment_mode,
      sender_account_id: transactionInput.sender_account_id,
      receiver_account_info: transactionInput.receiver_account_info || null,
      notes: transactionInput.notes || null,
    };

    // Validate
    const validationErrors = validateAddLoanTransaction(input, loan?.outstanding_balance);

    // Validate amount against selected account balance
    const accountId = transactionInput.payment_mode === 'CASH'
      ? CASH_ACCOUNT_ID
      : transactionInput.sender_account_id;
    if (accountId && input.amount > 0) {
      const account = accounts.find((a) => a.id === accountId);
      if (account && input.amount > account.balance) {
        validationErrors.amount = `Amount (₹${input.amount.toLocaleString()}) exceeds the selected account balance of ₹${account.balance.toLocaleString()}`;
      }
    }

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);
      await createLoanLedgerTransaction({
        ...input,
        loan_id: loanId,
      });
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Failed to create loan transaction:', err);
      setErrorMessage((err as Error).message || 'Failed to create loan transaction');
      setShowFailurePopup(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
    navigate(`/admin/loans/ledger/${loanId}`);
  };

  const handleFailureClose = () => {
    setShowFailurePopup(false);
  };

  const handleBackToLedger = () => {
    navigate(`/admin/loans/ledger/${loanId}`);
  };

  const getTransactionDescription = () => {
    switch (transactionInput.transaction_type) {
      case 'REPAYMENT':
        return 'Cash Out increases, Loan outstanding balance decreases';
      case 'INTEREST':
        return 'Cash Out increases, Recorded as Expense';
      default:
        return '';
    }
  };

  const getFormattedLoanType = () => {
    if (!loan) return 'Loan';
    switch (loan.loan_type) {
      case 'OWNER':
        return 'Owner Loan';
      case 'BANK':
        return 'Bank Loan';
      case 'SHORT_TERM':
        return 'Short-term Borrowing';
      default:
        return 'Loan';
    }
  };

  // Get max date (today)
  const today = new Date().toISOString().split('T')[0];

  return {
    loanId,
    loan,
    loanLoading,
    accounts,
    accountsLoading,
    transactionInput,
    updateTransactionInput,
    errors,
    showSuccessPopup,
    showFailurePopup,
    errorMessage,
    submitting,
    today,
    selectedAccountBalance,
    handleSubmit,
    handleSuccessClose,
    handleFailureClose,
    handleBackToLedger,
    getTransactionDescription,
    getFormattedLoanType,
  };
}
