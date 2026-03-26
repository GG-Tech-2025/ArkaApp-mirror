import { useState, useEffect } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import { searchVendors } from '../../services/middleware.service';
import type { Vendor } from '../../services/types';

export function useVendorManagement() {
  const { goBack, goTo } = useAdminNavigation();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalVendors, setTotalVendors] = useState(0);

  const fetchVendors = async (currentPage: number, search: string) => {
    try {
      setLoading(true);
      const result = await searchVendors(search, currentPage);
      
      if (currentPage === 0) {
        setVendors(result.data);
      } else {
        setVendors(prev => [...prev, ...result.data]);
      }
      
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch total vendor count once on mount (unfiltered)
  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const result = await searchVendors('', 0);
        setTotalVendors(result.total);
      } catch (err) {
        console.error('Failed to fetch total vendor count:', err);
      }
    };
    fetchTotalCount();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchVendors(0, searchQuery);
      setPage(0);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchVendors(nextPage, searchQuery);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  return {
    vendors,
    loading,
    hasMore,
    searchQuery,
    totalVendors,
    handleSearchChange,
    handleLoadMore,
    goBack,
    goTo,
  };
}
