import { useState, useEffect } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import { searchEmployees } from '../../services/middleware.service';
import type { EmployeeSearchResult } from '../../services/types';

export function useSalaryLedger() {
  const { goBack, goTo } = useAdminNavigation();

  const [employees, setEmployees] = useState<EmployeeSearchResult[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  const fetchEmployees = async (currentPage: number, search: string) => {
    try {
      setLoading(true);
      const result = await searchEmployees(search, currentPage);

      if (currentPage === 0) {
        setEmployees(result.data);
      } else {
        setEmployees(prev => [...prev, ...result.data]);
      }

      setHasMore(result.hasMore);
      setTotalEmployees(result.total);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on mount (immediate, no debounce)
  useEffect(() => {
    if (!hasInitialized) {
      fetchEmployees(0, '');
      setHasInitialized(true);
    }
  }, []);

  // Debounced search – re-fetches when searchQuery changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEmployees(0, searchQuery);
      setPage(0);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEmployees(nextPage, searchQuery);
  };

  const handleOpenLedger = (employeeId: string) => {
    goTo(`/admin/employees/salary-ledger/${employeeId}`);
  };

  return {
    employees,
    loading,
    hasMore,
    searchQuery,
    totalEmployees,
    handleSearchChange,
    handleLoadMore,
    handleOpenLedger,
    goBack,
    goTo,
  };
}
