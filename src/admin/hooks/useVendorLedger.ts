import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAdminNavigation } from './useAdminNavigation';
import {
  getVendorByIdWithMaterials,
  getVendorProcurements,
  getVendorPayments,
  getVendorFinancials,
  deleteVendorPayment,
} from '../../services/middleware.service';

export type VendorLedgerTab = 'procurements' | 'payments';

export function useVendorLedger() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { goBack, goTo } = useAdminNavigation();

  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Active tab
  const [activeTab, setActiveTab] = useState<VendorLedgerTab>('procurements');

  // Procurements state
  const [procurements, setProcurements] = useState<any[]>([]);
  const [procurementsTotal, setProcurementsTotal] = useState(0);
  const [procurementsPage, setProcurementsPage] = useState(0);
  const [procurementsHasMore, setProcurementsHasMore] = useState(false);
  const [procurementsLoading, setProcurementsLoading] = useState(false);
  const [procurementsLoadingMore, setProcurementsLoadingMore] = useState(false);

  // Payments state
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(0);
  const [paymentsHasMore, setPaymentsHasMore] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsLoadingMore, setPaymentsLoadingMore] = useState(false);

  // Financials (totals from DB view)
  const [financials, setFinancials] = useState<{
    total_purchase: number;
    total_paid: number;
    outstanding_balance: number;
  } | null>(null);

  // Staged filters
  const [stagedSortOrder, setStagedSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [stagedFromDate, setStagedFromDate] = useState('');
  const [stagedToDate, setStagedToDate] = useState('');

  // Applied filters
  const [appliedSortOrder, setAppliedSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');

  // Track if payments tab has been loaded at least once
  const [paymentsInitialized, setPaymentsInitialized] = useState(false);

  // ─── Fetch vendor details ───
  useEffect(() => {
    if (!vendorId) return;
    const fetchVendor = async () => {
      try {
        setLoading(true);
        const v = await getVendorByIdWithMaterials(vendorId);
        setVendor(v);
      } catch (error) {
        console.error('Failed to fetch vendor:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [vendorId]);

  // ─── Fetch financials ───
  const fetchFinancials = useCallback(async () => {
    if (!vendorId) return;
    try {
      const data = await getVendorFinancials(vendorId);
      setFinancials({
        total_purchase: Number(data.total_purchase ?? 0),
        total_paid: Number(data.total_paid ?? 0),
        outstanding_balance: Number(data.outstanding_balance ?? 0),
      });
    } catch (err) {
      console.error('Failed to load financials:', err);
      setFinancials(null);
    }
  }, [vendorId]);

  // ─── Fetch procurements (paginated, server-side) ───
  const fetchProcurements = useCallback(async (
    page: number,
    sortOrder: 'newest' | 'oldest',
    fromDate: string,
    toDate: string,
    append: boolean
  ) => {
    if (!vendorId) return;
    if (append) {
      setProcurementsLoadingMore(true);
    } else {
      setProcurementsLoading(true);
    }
    try {
      const isAscending = sortOrder === 'oldest';
      const result = await getVendorProcurements(
        vendorId,
        page,
        isAscending,
        fromDate || undefined,
        toDate || undefined
      );
      if (append) {
        setProcurements(prev => [...prev, ...result.data]);
      } else {
        setProcurements(result.data);
      }
      setProcurementsTotal(result.total);
      setProcurementsHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load procurements:', err);
      if (!append) setProcurements([]);
    } finally {
      setProcurementsLoading(false);
      setProcurementsLoadingMore(false);
    }
  }, [vendorId]);

  // ─── Fetch payments (paginated, server-side) ───
  const fetchPayments = useCallback(async (
    page: number,
    sortOrder: 'newest' | 'oldest',
    fromDate: string,
    toDate: string,
    append: boolean
  ) => {
    if (!vendorId) return;
    if (append) {
      setPaymentsLoadingMore(true);
    } else {
      setPaymentsLoading(true);
    }
    try {
      const isAscending = sortOrder === 'oldest';
      const result = await getVendorPayments(
        vendorId,
        page,
        isAscending,
        fromDate || undefined,
        toDate || undefined
      );
      if (append) {
        setPayments(prev => [...prev, ...result.data]);
      } else {
        setPayments(result.data);
      }
      setPaymentsTotal(result.total);
      setPaymentsHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load payments:', err);
      if (!append) setPayments([]);
    } finally {
      setPaymentsLoading(false);
      setPaymentsLoadingMore(false);
    }
  }, [vendorId]);

  // ─── Initial fetch: vendor details + financials + procurements (active tab) ───
  useEffect(() => {
    if (!vendorId) return;
    fetchFinancials();
    fetchProcurements(0, 'newest', '', '', false);
  }, [vendorId, fetchFinancials, fetchProcurements]);

  // ─── Tab change handler ───
  const handleTabChange = (tab: VendorLedgerTab) => {
    setActiveTab(tab);
    // Reset staged filters on tab change
    setStagedSortOrder('newest');
    setStagedFromDate('');
    setStagedToDate('');
    setAppliedSortOrder('newest');
    setAppliedFromDate('');
    setAppliedToDate('');

    if (tab === 'procurements') {
      setProcurementsPage(0);
      fetchProcurements(0, 'newest', '', '', false);
    } else {
      setPaymentsPage(0);
      fetchPayments(0, 'newest', '', '', false);
      setPaymentsInitialized(true);
    }
  };

  // ─── Apply Filter ───
  const handleApplyFilter = () => {
    if (!vendorId) return;
    setAppliedSortOrder(stagedSortOrder);
    setAppliedFromDate(stagedFromDate);
    setAppliedToDate(stagedToDate);

    if (activeTab === 'procurements') {
      setProcurementsPage(0);
      fetchProcurements(0, stagedSortOrder, stagedFromDate, stagedToDate, false);
    } else {
      setPaymentsPage(0);
      fetchPayments(0, stagedSortOrder, stagedFromDate, stagedToDate, false);
    }
  };

  // ─── Clear Filter ───
  const handleClearFilter = () => {
    if (!vendorId) return;
    setStagedSortOrder('newest');
    setStagedFromDate('');
    setStagedToDate('');
    setAppliedSortOrder('newest');
    setAppliedFromDate('');
    setAppliedToDate('');

    if (activeTab === 'procurements') {
      setProcurementsPage(0);
      fetchProcurements(0, 'newest', '', '', false);
    } else {
      setPaymentsPage(0);
      fetchPayments(0, 'newest', '', '', false);
    }
  };

  // ─── Load More ───
  const handleLoadMore = () => {
    if (!vendorId) return;

    if (activeTab === 'procurements') {
      if (procurementsLoadingMore || !procurementsHasMore) return;
      const nextPage = procurementsPage + 1;
      setProcurementsPage(nextPage);
      fetchProcurements(nextPage, appliedSortOrder, appliedFromDate, appliedToDate, true);
    } else {
      if (paymentsLoadingMore || !paymentsHasMore) return;
      const nextPage = paymentsPage + 1;
      setPaymentsPage(nextPage);
      fetchPayments(nextPage, appliedSortOrder, appliedFromDate, appliedToDate, true);
    }
  };

  // ─── Delete a vendor payment ───
  const [deletingPayment, setDeletingPayment] = useState(false);

  const handleDeletePayment = async (paymentId: string) => {
    try {
      setDeletingPayment(true);
      await deleteVendorPayment(paymentId);
      // Refresh payments and financials after deletion
      setPaymentsPage(0);
      fetchPayments(0, appliedSortOrder, appliedFromDate, appliedToDate, false);
      fetchFinancials();
    } catch (err) {
      console.error('Failed to delete payment:', err);
      throw err;
    } finally {
      setDeletingPayment(false);
    }
  };

  return {
    vendor,
    vendorId,
    loading,
    // Tab
    activeTab,
    handleTabChange,
    // Procurements
    procurements,
    procurementsTotal,
    procurementsLoading,
    procurementsLoadingMore,
    procurementsHasMore,
    // Payments
    payments,
    paymentsTotal,
    paymentsLoading,
    paymentsLoadingMore,
    paymentsHasMore,
    // Financials
    financials,
    // Staged filters
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
    deletingPayment,
    handleDeletePayment,
    goBack,
    goTo,
  };
}
