import { useState, useEffect } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import { searchEmployees } from '../../services/middleware.service';
import type { EmployeeSearchResult } from '../../services/types';

export type SalaryLedgerTab = 'Active' | 'Inactive';

export function useSalaryLedger() {
  const { goBack, goTo } = useAdminNavigation();

  const [activeTab, setActiveTab] = useState<SalaryLedgerTab>('Active');

  // Active employees state
  const [activeEmployees, setActiveEmployees] = useState<EmployeeSearchResult[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [hasMoreActive, setHasMoreActive] = useState(false);
  const [totalActive, setTotalActive] = useState(0);

  // Inactive employees state
  const [inactiveEmployees, setInactiveEmployees] = useState<EmployeeSearchResult[]>([]);
  const [inactivePage, setInactivePage] = useState(0);
  const [hasMoreInactive, setHasMoreInactive] = useState(false);
  const [totalInactive, setTotalInactive] = useState(0);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);

  const fetchActiveEmployees = async (page: number, search: string) => {
    try {
      setLoading(true);
      const result = await searchEmployees(search, page, true);
      if (page === 0) {
        setActiveEmployees(result.data);
      } else {
        setActiveEmployees(prev => [...prev, ...result.data]);
      }
      setHasMoreActive(result.hasMore);
      setTotalActive(result.total);
    } catch (err) {
      console.error('Failed to fetch active employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInactiveEmployees = async (page: number, search: string) => {
    try {
      setLoading(true);
      const result = await searchEmployees(search, page, false);
      if (page === 0) {
        setInactiveEmployees(result.data);
      } else {
        setInactiveEmployees(prev => [...prev, ...result.data]);
      }
      setHasMoreInactive(result.hasMore);
      setTotalInactive(result.total);
    } catch (err) {
      console.error('Failed to fetch inactive employees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    if (!hasInitialized) {
      fetchActiveEmployees(0, '');
      setHasInitialized(true);
    }
  }, []);

  // Debounced search – re-fetches when searchQuery changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (activeTab === 'Active') {
        setActivePage(0);
        fetchActiveEmployees(0, searchQuery);
      } else {
        setInactivePage(0);
        fetchInactiveEmployees(0, searchQuery);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleTabChange = (tab: SalaryLedgerTab) => {
    setActiveTab(tab);
    setSearchQuery('');
    if (tab === 'Active') {
      setActivePage(0);
      fetchActiveEmployees(0, '');
    } else {
      setInactivePage(0);
      fetchInactiveEmployees(0, '');
    }
  };

  const handleLoadMoreActive = () => {
    const nextPage = activePage + 1;
    setActivePage(nextPage);
    fetchActiveEmployees(nextPage, searchQuery);
  };

  const handleLoadMoreInactive = () => {
    const nextPage = inactivePage + 1;
    setInactivePage(nextPage);
    fetchInactiveEmployees(nextPage, searchQuery);
  };

  const handleOpenLedger = (employeeId: string) => {
    goTo(`/admin/employees/salary-ledger/${employeeId}`);
  };

  return {
    activeTab,
    activeEmployees,
    inactiveEmployees,
    loading,
    hasMoreActive,
    hasMoreInactive,
    searchQuery,
    totalActive,
    totalInactive,
    handleSearchChange,
    handleTabChange,
    handleLoadMoreActive,
    handleLoadMoreInactive,
    handleOpenLedger,
    goBack,
    goTo,
  };
}
