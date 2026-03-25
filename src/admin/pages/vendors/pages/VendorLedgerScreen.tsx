import  { useState, useRef } from 'react';
import { ArrowLeft, Trash2, X, Filter } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useVendorLedger } from '../../../hooks/useVendorLedger';
import { VendorLedgerExport } from './VendorLedgerExport';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function VendorLedgerScreen() {
  const {
    vendor,
    vendorId,
    loading,
    // Tab
    activeTab,
    handleTabChange,
    // Procurements
    procurements,
    procurementsLoading,
    procurementsLoadingMore,
    procurementsHasMore,
    // Payments
    payments,
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
  } = useVendorLedger();
  const exportRef = useRef<HTMLDivElement>(null);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  
  // Export Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [exportFormat, setExportFormat] = useState<'PDF' | 'Image'>('PDF');
  const [exportFromDateError, setExportFromDateError] = useState('');
  const [exportToDateError, setExportToDateError] = useState('');
  const [showNoTransactionsPopup, setShowNoTransactionsPopup] = useState(false);
  const [showExportErrorPopup, setShowExportErrorPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [exportProcurements, setExportProcurements] = useState<any[]>([]);
  const [exportPayments, setExportPayments] = useState<any[]>([]);

  // Delete Payment Confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Totals from DB view
  const totalPurchase = financials?.total_purchase ?? 0;
  const totalPayment = financials?.total_paid ?? 0;
  const outstandingBalance = financials?.outstanding_balance ?? 0;

  // Determine active tab's loading and data
  const isTabLoading = activeTab === 'procurements' ? procurementsLoading : paymentsLoading;
  const isLoadingMore = activeTab === 'procurements' ? procurementsLoadingMore : paymentsLoadingMore;
  const hasMore = activeTab === 'procurements' ? procurementsHasMore : paymentsHasMore;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };
  
  const handleOpenExportModal = () => {
    setExportFromDate('');
    setExportToDate('');
    setExportFormat('PDF');
    setExportFromDateError('');
    setExportToDateError('');
    setShowExportModal(true);
  };
  
  const handleCloseExportModal = () => {
    setShowExportModal(false);
    setExportFromDateError('');
    setExportToDateError('');
  };

  const handleOpenDeleteConfirm = (paymentId: string) => {
    setDeletingPaymentId(paymentId);
    setShowDeleteConfirm(true);
  };

  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeletingPaymentId(null);
  };

  const handleConfirmDeletePayment = async () => {
    if (!deletingPaymentId) return;
    try {
      await handleDeletePayment(deletingPaymentId);
      setShowDeleteConfirm(false);
      setDeletingPaymentId(null);
      setSuccessMessage('Payment deleted successfully');
      setShowSuccessPopup(true);
    } catch {
      setShowDeleteConfirm(false);
      setDeletingPaymentId(null);
      setPopupMessage('Failed to delete payment. Please try again.');
      setShowPopup(true);
    }
  };
  
  const handleDownloadExport = async () => {
    // Clear previous errors
    setExportFromDateError('');
    setExportToDateError('');
    
    // Validate required fields
    let hasError = false;
    
    if (!exportFromDate) {
      setExportFromDateError('From date is required');
      hasError = true;
    }
    
    if (!exportToDate) {
      setExportToDateError('To date is required');
      hasError = true;
    }
    
    if (hasError) {
      return;
    }
    
    // Filter procurements and payments within date range
    const fromDateObj = new Date(exportFromDate);
    const toDateObj = new Date(exportToDate);

    if (fromDateObj > toDateObj) {
      setExportFromDateError('From date cannot be greater than To date.');
      return;
    }
    
    const procurementsInRange = procurements.filter(proc => {
      const procDate = new Date(proc.date);
      return procDate >= fromDateObj && procDate <= toDateObj;
    });
    
    const paymentsInRange = payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      return paymentDate >= fromDateObj && paymentDate <= toDateObj;
    });
    
    // Check if transactions exist
    if (procurementsInRange.length === 0 && paymentsInRange.length === 0) {
      setShowExportModal(false);
      setShowNoTransactionsPopup(true);
      return;
    }

    // Store filtered data for the export component
    setExportProcurements(procurementsInRange);
    setExportPayments(paymentsInRange);

    // Wait for component render
    setTimeout(async () => {
      try {
        const element = exportRef.current;
        if (!element) return;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
        });

        const imgData = canvas.toDataURL('image/png');

        if (exportFormat === 'Image') {
          const link = document.createElement('a');
          link.href = imgData;
          link.download = `Arka_Vendor_Ledger_${vendor?.name}.png`;
          link.click();
        } else {
          const pdf = new jsPDF('p', 'mm', 'a4');
          const imgProps = pdf.getImageProperties(imgData);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Arka_Vendor_Ledger_${vendor?.name}.pdf`);
        }

        setShowExportModal(false);
        setSuccessMessage(`Vendor ledger exported successfully as ${exportFormat}`);
        setShowSuccessPopup(true);
      } catch (err) {
        console.error(err);
        setShowExportModal(false);
        setShowExportErrorPopup(true);
      }
    }, 400);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading vendor details...</p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Vendor not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/vendors')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Vendors
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Vendor Ledger</h1>
              <p className="text-gray-600 mt-1">Transaction history for {vendor.name}</p>
            </div>
            <button
              onClick={handleOpenExportModal}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
            >
              Export
            </button>
          </div>
        </div>

        {/* Vendor Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-gray-600 text-sm">Vendor Name</p>
              <p className="text-gray-900">{vendor.name}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Phone Number</p>
              <p className="text-gray-900">{vendor.phone || '-'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Address</p>
              <p className="text-gray-900">{vendor.address || '-'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">GST Number</p>
              <p className="text-gray-900">{vendor.gst_number || '-'}</p>
            </div>
          </div>
        </div>

        {/* Summary Card with Add Payment Button */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
              <div>
                <p className="text-gray-600 text-sm">Total Purchase</p>
                <p className="text-gray-900">
                  {totalPurchase === 0 ? 'No Purchase.' : `₹${totalPurchase.toLocaleString()}`}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Payment</p>
                <p className="text-gray-900">
                  {totalPayment === 0 ? 'No Payment.' : `₹${totalPayment.toLocaleString()}`}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Current Outstanding Balance</p>
                <p className={`${outstandingBalance === 0 ? 'text-gray-900' : outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {outstandingBalance === 0 ? 'No pending balance.' : `₹${outstandingBalance.toLocaleString()}`}
                </p>
              </div>
            </div>
            <div>
              <button
                onClick={() => goTo(`/admin/vendors/${vendorId}/payment`)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => handleTabChange('procurements')}
                className={`flex-1 px-6 py-4 text-center transition-colors ${
                  activeTab === 'procurements'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Procurements
              </button>
              <button
                onClick={() => handleTabChange('payments')}
                className={`flex-1 px-6 py-4 text-center transition-colors ${
                  activeTab === 'payments'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Payments
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-gray-700 text-sm mb-2">Sort Order</label>
                <select
                  value={stagedSortOrder}
                  onChange={(e) => setStagedSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-gray-700 text-sm mb-2">From Date</label>
                <input
                  type="date"
                  value={stagedFromDate}
                  onChange={(e) => setStagedFromDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-gray-700 text-sm mb-2">To Date</label>
                <input
                  type="date"
                  value={stagedToDate}
                  onChange={(e) => setStagedToDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end items-center gap-4">
              <button
                onClick={handleClearFilter}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Clear Filter
              </button>
              <button
                onClick={handleApplyFilter}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <Filter className="w-4 h-4" />
                Apply Filter
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-6">
            {isTabLoading ? (
              <div className="py-12 text-center">
                <p className="text-gray-600">Loading...</p>
              </div>
            ) : (activeTab === 'procurements' ? procurements : payments).length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-600">
                  {stagedFromDate || stagedToDate 
                    ? 'No transactions found for the selected date range.' 
                    : 'No transactions recorded for this vendor.'}
                </p>
              </div>
            ) : (
              <>
                {activeTab === 'procurements' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left text-gray-700">Material</th>
                          <th className="px-4 py-3 text-left text-gray-700">Quantity</th>
                          <th className="px-4 py-3 text-left text-gray-700">Rate</th>
                          <th className="px-4 py-3 text-left text-gray-700">Amount</th>
                          <th className="px-4 py-3 text-left text-gray-700">Paid</th>
                          <th className="px-4 py-3 text-left text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {procurements.map((proc: any) => {
                          const material = Array.isArray(proc.materials) ? proc.materials[0] : proc.materials;
                          const materialName = material?.name ?? '-';
                          const materialUnit = material?.unit ?? '';
                          const statusColor =
                            proc.payment_status === 'PAID'
                              ? 'bg-green-100 text-green-800'
                              : proc.payment_status === 'PARTIALLY_PAID'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800';
                          const statusLabel =
                            proc.payment_status === 'PAID'
                              ? 'Paid'
                              : proc.payment_status === 'PARTIALLY_PAID'
                              ? 'Partial'
                              : 'Unpaid';
                          return (
                            <tr key={proc.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-gray-900">{formatDate(proc.date)}</td>
                              <td className="px-4 py-4 text-gray-900">{materialName}</td>
                              <td className="px-4 py-4 text-gray-900">{Number(proc.quantity).toLocaleString()} {materialUnit}</td>
                              <td className="px-4 py-4 text-gray-900">₹{Number(proc.rate_per_unit).toLocaleString()}</td>
                              <td className="px-4 py-4 text-gray-900">₹{Number(proc.total_price).toLocaleString()}</td>
                              <td className="px-4 py-4 text-gray-900">₹{Number(proc.total_paid ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 rounded-full text-sm ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left text-gray-700">Amount</th>
                          <th className="px-4 py-3 text-left text-gray-700">Mode</th>
                          <th className="px-4 py-3 text-left text-gray-700">Sender Account</th>
                          <th className="px-4 py-3 text-left text-gray-700">Receiver Info</th>
                          <th className="px-4 py-3 text-left text-gray-700">Created At</th>
                          <th className="px-4 py-3 text-left text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {payments.map((pay: any) => {
                          const account = Array.isArray(pay.accounts) ? pay.accounts[0] : pay.accounts;
                          return (
                            <tr key={pay.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-gray-900">{formatDate(pay.payment_date)}</td>
                              <td className="px-4 py-4 text-gray-900">₹{Number(pay.amount).toLocaleString()}</td>
                              <td className="px-4 py-4 text-gray-900">{pay.mode}</td>
                              <td className="px-4 py-4 text-gray-900">{account?.account_number ?? '-'}</td>
                              <td className="px-4 py-4 text-gray-900">{pay.receiver_account_info || '-'}</td>
                              <td className="px-4 py-4 text-gray-900">{formatDate(pay.created_at)}</td>
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => handleOpenDeleteConfirm(pay.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  aria-label="Delete payment"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className={`px-6 py-2 rounded-lg transition-colors ${
                        isLoadingMore
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {isLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Popup */}
      {showPopup && (
        <Popup
          title="Error"
          message={popupMessage}
          onClose={() => setShowPopup(false)}
          type="error"
        />
      )}
      
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Close Icon */}
            <button
              onClick={handleCloseExportModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-6">Export Vendor Ledger</h2>

            <div className="space-y-4">
              {/* From Date */}
              <div>
                <label htmlFor="exportFromDate" className="block text-gray-700 mb-2">
                  From Date <span className="text-red-600">*</span>
                </label>
                <input
                  id="exportFromDate"
                  type="date"
                  value={exportFromDate}
                  onChange={(e) => setExportFromDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {exportFromDateError && (
                  <p className="text-red-600 text-sm mt-1">{exportFromDateError}</p>
                )}
              </div>

              {/* To Date */}
              <div>
                <label htmlFor="exportToDate" className="block text-gray-700 mb-2">
                  To Date <span className="text-red-600">*</span>
                </label>
                <input
                  id="exportToDate"
                  type="date"
                  value={exportToDate}
                  onChange={(e) => setExportToDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {exportToDateError && (
                  <p className="text-red-600 text-sm mt-1">{exportToDateError}</p>
                )}
              </div>

              {/* Export Format */}
              <div>
                <label htmlFor="exportFormat" className="block text-gray-700 mb-2">
                  Export Format <span className="text-red-600">*</span>
                </label>
                <select
                  id="exportFormat"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'PDF' | 'Image')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="PDF">PDF</option>
                  <option value="Image">Image</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={handleCloseExportModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadExport}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Success"
          message={successMessage}
          onClose={() => setShowSuccessPopup(false)}
          type="success"
        />
      )}

      {/* Delete Payment Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <button
              onClick={handleCloseDeleteConfirm}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-4">Delete Payment</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this payment? This will add back the
              amount to the sender account and reverse the settlement on associated
              procurements. This action cannot be undone.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseDeleteConfirm}
                disabled={deletingPayment}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeletePayment}
                disabled={deletingPayment}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  deletingPayment
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {deletingPayment ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* No Transactions Popup */}
      {showNoTransactionsPopup && (
        <Popup
          title="No Transactions Found"
          message="No transactions found for the selected date range."
          onClose={() => setShowNoTransactionsPopup(false)}
        />
      )}
      
      {/* Export Error Popup */}
      {showExportErrorPopup && (
        <Popup
          title="Export Failed"
          message="Unable to export vendor ledger. Please try again."
          onClose={() => setShowExportErrorPopup(false)}
        />
      )}

      {/* Offscreen Export Component */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <VendorLedgerExport
          ref={exportRef}
          vendor={vendor}
          procurements={exportProcurements}
          payments={exportPayments}
          fromDate={exportFromDate}
          toDate={exportToDate}
        />
      </div>
    </div>
  );
}