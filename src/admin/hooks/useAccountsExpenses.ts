import { useState, useEffect, useMemo } from 'react';
import { getExpensesByDateRange, getExpenseTypes, getExpenseSubtypes, getProcurementsByDateRange } from '../../services/middleware.service';

type FilterType = 'Current Month' | 'Last month' | 'Last year' | 'Custom range';

interface Expense {
  id: string;
  expense_date: string;
  type_id: string;
  subtype_id: string;
  amount: number;
  payment_mode: string;
  sender_account_id?: string;
  comments?: string;
  expense_types?: {
    id: string;
    name: string;
  };
  expense_subtypes?: {
    id: string;
    name: string;
  };
}

interface Procurement {
  id: string;
  date: string;
  material_id: string;
  total_price: number;
  materials?: {
    id: string;
    name: string;
  };
  vendors?: {
    id: string;
    name: string;
  };
}

interface ExpenseType {
  id: string;
  name: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Get the date range for the current month (1st of month to today)
 */
function getCurrentMonthRange(): DateRange {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const startDate = new Date(currentYear, currentMonth, 1);
  const endDate = today;

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Get the date range for the last month (full month, 1st to last day)
 */
function getLastMonthRange(): DateRange {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1);

  const startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
  const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0); // Last day of last month

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Get the date range for the last year (full year, Jan 1 to Dec 31)
 */
function getLastYearRange(): DateRange {
  const today = new Date();
  const lastYear = today.getFullYear() - 1;

  const startDate = new Date(lastYear, 0, 1); // Jan 1 of last year
  const endDate = new Date(lastYear, 11, 31); // Dec 31 of last year

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Get the appropriate date range based on filter type
 */
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
        throw new Error('Custom date range requires both start and end dates');
      }
      return { startDate: customStartDate, endDate: customEndDate };
    default:
      return getCurrentMonthRange();
  }
}

/**
 * Custom hook for fetching and managing expenses data (with separate procurements)
 */
export function useAccountsExpenses(
  filterType: FilterType,
  customStartDate?: string,
  customEndDate?: string,
  selectedExpenseTypeId?: string,
  loanInterestTotal?: number
) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  // Fetch expense data based on filter
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get date range
        const dateRange = getDateRange(filterType, customStartDate, customEndDate);

        // Fetch expenses and procurements separately
        const [expensesData, procurementsData, typesData] = await Promise.all([
          getExpensesByDateRange(dateRange.startDate, dateRange.endDate),
          getProcurementsByDateRange(dateRange.startDate, dateRange.endDate),
          getExpenseTypes(),
        ]);

        setExpenses(expensesData);
        setProcurements(procurementsData);
        setExpenseTypes(typesData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch expenses';
        setError(errorMessage);
        setShowError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [filterType, customStartDate, customEndDate]);

  // Calculate total expenses (manual expenses only)
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  }, [expenses]);

  // Calculate total procurements
  const totalProcurements = useMemo(() => {
    return procurements.reduce((sum, proc) => sum + (proc.total_price || 0), 0);
  }, [procurements]);

  // Prepare pie chart data - by type (expenses + procurements + loan interest)
  const pieChartData = useMemo(() => {
    if (!selectedExpenseTypeId || selectedExpenseTypeId === 'Overall') {
      // Group by type (both expenses and procurements)
      const dataByType: Record<string, number> = {};
      
      // Add manual expenses
      expenses.forEach((expense) => {
        const typeName = expense.expense_types?.name || 'Uncategorized';
        dataByType[typeName] = (dataByType[typeName] || 0) + expense.amount;
      });
      
      // Add procurements as "Procurement" type
      if (procurements.length > 0) {
        const procurementTotal = procurements.reduce((sum, proc) => sum + (proc.total_price || 0), 0);
        dataByType['Procurement'] = (dataByType['Procurement'] || 0) + procurementTotal;
      }

      // Add loan interest as "Loan Interest" type
      if (loanInterestTotal && loanInterestTotal > 0) {
        dataByType['Loan Interest'] = (dataByType['Loan Interest'] || 0) + loanInterestTotal;
      }

      return Object.entries(dataByType).map(([name, value]) => ({
        name,
        value,
      }));
    } else if (selectedExpenseTypeId === 'LoanInterest') {
      // When Loan Interest filter is selected, show as single entry
      if (loanInterestTotal && loanInterestTotal > 0) {
        return [{ name: 'Loan Interest', value: loanInterestTotal }];
      }
      return [];
    } else {
      // Filter expenses by selected type and group by subtype
      const filteredByType = expenses.filter(
        (e) => e.type_id === selectedExpenseTypeId
      );

      let dataBySubtype: Record<string, number> = {};
      
      // If "Procurement" type is selected, show procurements grouped by material
      if (selectedExpenseTypeId === 'Procurement') {
        procurements.forEach((proc) => {
          const materialName = Array.isArray(proc.materials) 
            ? proc.materials?.[0]?.name 
            : proc.materials?.name 
            ? proc.materials.name 
            : 'Unknown Material';
          dataBySubtype[materialName] = (dataBySubtype[materialName] || 0) + (proc.total_price || 0);
        });
      } else {
        // Show expenses grouped by subtype for other types
        filteredByType.forEach((expense) => {
          const subtypeName = expense.expense_subtypes?.name || 'Uncategorized';
          dataBySubtype[subtypeName] = (dataBySubtype[subtypeName] || 0) + expense.amount;
        });
      }

      return Object.entries(dataBySubtype).map(([name, value]) => ({
        name,
        value,
      }));
    }
  }, [expenses, procurements, selectedExpenseTypeId, loanInterestTotal]);

  // Get filtered expenses based on selected type
  const filteredExpenses = useMemo(() => {
    if (!selectedExpenseTypeId || selectedExpenseTypeId === 'Overall') {
      return expenses;
    }
    return expenses.filter((e) => e.type_id === selectedExpenseTypeId);
  }, [expenses, selectedExpenseTypeId]);

  const closeError = () => {
    setShowError(false);
  };

  return {
    expenses: filteredExpenses,
    procurements,
    expenseTypes,
    loading,
    error,
    totalExpenses,
    totalProcurements,
    pieChartData,
    showError,
    closeError,
  };
}
