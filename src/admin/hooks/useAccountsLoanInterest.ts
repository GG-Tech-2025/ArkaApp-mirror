import { useEffect, useState, useMemo } from 'react';
import { getLoanInterestByDateRange } from '../../services/middleware.service';

type FilterType = 'Current Month' | 'Last month' | 'Last year' | 'Custom range';

interface DateRange {
  startDate: string;
  endDate: string;
}

export interface LoanInterestEntry {
  id: string;
  loan_id: string;
  amount: number;
  payment_mode: string;
  transaction_date: string;
  notes: string | null;
  sender_account_id: string | null;
  loans?: {
    lender_name: string;
    loan_type: string;
  };
}

interface UseAccountsLoanInterestResult {
  loanInterestEntries: LoanInterestEntry[];
  loading: boolean;
  error: string | null;
  totalLoanInterest: number;
  showError: boolean;
  closeError: () => void;
}

function getCurrentMonthRange(): DateRange {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  };
}

function getLastMonthRange(): DateRange {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

function getLastYearRange(): DateRange {
  const year = new Date().getFullYear() - 1;
  return {
    startDate: new Date(year, 0, 1).toISOString().split('T')[0],
    endDate: new Date(year, 11, 31).toISOString().split('T')[0],
  };
}

function getDateRange(
  filterType: FilterType,
  customStartDate?: string,
  customEndDate?: string
): DateRange {
  switch (filterType) {
    case 'Current Month':
      return getCurrentMonthRange();
    case 'Last month':
      return getLastMonthRange();
    case 'Last year':
      return getLastYearRange();
    case 'Custom range':
      if (!customStartDate || !customEndDate) {
        return getCurrentMonthRange();
      }
      return { startDate: customStartDate, endDate: customEndDate };
    default:
      return getCurrentMonthRange();
  }
}

/**
 * Hook to fetch loan interest entries for a given date range.
 * Used in AccountsManagementScreen — Expenses section (Loan Interest).
 */
export function useAccountsLoanInterest(
  filterType: FilterType,
  customStartDate?: string,
  customEndDate?: string
): UseAccountsLoanInterestResult {
  const [loanInterestEntries, setLoanInterestEntries] = useState<LoanInterestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setShowError(false);

        const dateRange = getDateRange(filterType, customStartDate, customEndDate);
        const data = await getLoanInterestByDateRange(
          dateRange.startDate,
          dateRange.endDate
        );

        if (mounted) {
          setLoanInterestEntries(data);
        }
      } catch (err) {
        console.error('Failed to load loan interest entries:', err);
        if (mounted) {
          const errorMessage = (err as Error).message || 'Failed to load loan interest data';
          setError(errorMessage);
          setShowError(true);
          setLoanInterestEntries([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [filterType, customStartDate, customEndDate]);

  const totalLoanInterest = useMemo(() => {
    return loanInterestEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  }, [loanInterestEntries]);

  const closeError = () => {
    setShowError(false);
  };

  return {
    loanInterestEntries,
    loading,
    error,
    totalLoanInterest,
    showError,
    closeError,
  };
}
