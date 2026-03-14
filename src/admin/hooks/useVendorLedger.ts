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

export function useVendorLedger() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { goBack, goTo } = useAdminNavigation();

  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Procurements
  const [procurements, setProcurements] = useState<any[]>([]);
  const [procurementsLoading, setProcurementsLoading] = useState(false);

  // Payments
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsHasMore, setPaymentsHasMore] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);

  // Financials (totals from DB view)
  const [financials, setFinancials] = useState<{
    total_purchase: number;
    total_paid: number;
    outstanding_balance: number;
  } | null>(null);

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

  // ─── Fetch procurements ───
  const fetchProcurements = useCallback(async () => {
    if (!vendorId) return;
    try {
      setProcurementsLoading(true);
      const data = await getVendorProcurements(vendorId);
      setProcurements(data);
    } catch (err) {
      console.error('Failed to load procurements:', err);
      setProcurements([]);
    } finally {
      setProcurementsLoading(false);
    }
  }, [vendorId]);

  // ─── Fetch payments (paginated) ───
  const fetchPayments = useCallback(async (page = 1) => {
    if (!vendorId) return;
    try {
      setPaymentsLoading(true);
      const result = await getVendorPayments(vendorId, page);
      if (page === 1) {
        setPayments(result.data);
      } else {
        setPayments(prev => [...prev, ...result.data]);
      }
      setPaymentsHasMore(result.hasMore);
      setPaymentsPage(page);
    } catch (err) {
      console.error('Failed to load payments:', err);
      if (page === 1) setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }, [vendorId]);

  // ─── Fetch financials (totals) ───
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

  // ─── Kick off data fetch once vendorId is available ───
  useEffect(() => {
    if (!vendorId) return;
    fetchProcurements();
    fetchPayments(1);
    fetchFinancials();
  }, [vendorId, fetchProcurements, fetchPayments, fetchFinancials]);

  // ─── Load more payments ───
  const loadMorePayments = () => {
    fetchPayments(paymentsPage + 1);
  };

  // ─── Refresh everything (after adding a payment, etc.) ───
  const refresh = () => {
    fetchProcurements();
    fetchPayments(1);
    fetchFinancials();
  };

  // ─── Delete a vendor payment ───
  const [deletingPayment, setDeletingPayment] = useState(false);

  const handleDeletePayment = async (paymentId: string) => {
    try {
      setDeletingPayment(true);
      await deleteVendorPayment(paymentId);
      // Refresh everything after deletion
      refresh();
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
    procurements,
    procurementsLoading,
    payments,
    paymentsLoading,
    paymentsHasMore,
    loadMorePayments,
    financials,
    refresh,
    deletingPayment,
    handleDeletePayment,
    goBack,
    goTo,
  };
}
