import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAdminNavigation } from './useAdminNavigation';
import { getEmployeeLedger } from '../../services/middleware.service';
import { EmployeeSummary, SalaryLedgerTransaction } from '../../services/types';

const PAGE_SIZE = 20;

export function useSalaryLedgerDetail() {
  const { id: employeeId } = useParams<{ id: string }>();
  const { goBack, goTo } = useAdminNavigation();

  // Employee & transaction state
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [transactions, setTransactions] = useState<SalaryLedgerTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Staged filters — updated by the user in the UI, not yet applied to the API
  const [stagedSortOrder, setStagedSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [stagedFromDate, setStagedFromDate] = useState('');
  const [stagedToDate, setStagedToDate] = useState('');

  // Applied filters — committed on "Apply Filter" press, used in actual API calls
  const [appliedSortOrder, setAppliedSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');

  const fetchLedger = useCallback(async (
    empId: string,
    currentPage: number,
    sortOrder: 'newest' | 'oldest',
    fromDate: string,
    toDate: string,
    append: boolean
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const isAscending = sortOrder === 'oldest';
      const result = await getEmployeeLedger(
        empId,
        currentPage,
        isAscending,
        fromDate || undefined,
        toDate || undefined
      );

      if (append) {
        setTransactions(prev => {
          const updated = [...prev, ...result.transactions];
          setHasMore(updated.length < result.total_count);
          return updated;
        });
      } else {
        setEmployee(result.employee);
        setTransactions(result.transactions);
        setTotalCount(result.total_count);
        setHasMore(result.transactions.length < result.total_count);
      }
    } catch (err) {
      console.error('Failed to fetch employee ledger:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (employeeId) {
      fetchLedger(employeeId, 0, 'newest', '', '', false);
    }
  }, [employeeId]);

  // Make end date inclusive by adding one day
  const getInclusiveToDate = (toDate: string): string => {
    if (!toDate) return '';
    const date = new Date(toDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  };

  const handleApplyFilter = () => {
    if (!employeeId) return;
    setAppliedSortOrder(stagedSortOrder);
    setAppliedFromDate(stagedFromDate);
    setAppliedToDate(stagedToDate);
    setPage(0);
    fetchLedger(employeeId, 0, stagedSortOrder, stagedFromDate, getInclusiveToDate(stagedToDate), false);
  };

  const handleClearFilter = () => {
    if (!employeeId) return;
    setStagedSortOrder('newest');
    setStagedFromDate('');
    setStagedToDate('');
    setAppliedSortOrder('newest');
    setAppliedFromDate('');
    setAppliedToDate('');
    setPage(0);
    fetchLedger(employeeId, 0, 'newest', '', '', false);
  };

  const handleLoadMore = () => {
    if (!employeeId || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLedger(employeeId, nextPage, appliedSortOrder, appliedFromDate, getInclusiveToDate(appliedToDate), true);
  };

  const handleAddPayment = () => {
    goTo(`/admin/employees/salary-ledger/${employeeId}/add-payment`);
  };

  return {
    employee,
    transactions,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    PAGE_SIZE,
    // Staged filter state
    stagedSortOrder,
    stagedFromDate,
    stagedToDate,
    setStagedSortOrder,
    setStagedFromDate,
    setStagedToDate,
    // Actions
    handleApplyFilter,
    handleClearFilter,
    handleLoadMore,
    handleAddPayment,
    goBack,
  };
}
