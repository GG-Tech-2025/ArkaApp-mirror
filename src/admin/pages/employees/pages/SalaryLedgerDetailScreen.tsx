import React, { useState } from 'react';
import { ArrowLeft, Plus, Filter, Info } from 'lucide-react';
import { SalaryLedgerTransaction } from '../../../../services/types';
import { useSalaryLedgerDetail } from '../../../hooks/useSalaryLedgerDetail';

const CATEGORY_LABELS: Record<string, string> = {
  DAILY: 'Daily Wages',
  FIXED: 'Fixed Salary',
  LOADMEN: 'Loadmen',
};

function formatDateTime(isoString: string): { date: string; time: string } {
  const dt = new Date(isoString);
  return {
    date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getEntryTypeStyle(entryType: string): string {
  const lower = entryType.toLowerCase();
  if (lower.includes('settlement') || lower.includes('credit') || lower.includes('salary')) {
    return 'bg-green-100 text-green-800';
  }
  if (lower.includes('advance') || lower.includes('payment') || lower.includes('debit')) {
    return 'bg-red-100 text-red-800';
  }
  return 'bg-blue-100 text-blue-800';
}

function formatEntryType(entryType: string): string {
  return entryType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SalaryLedgerDetailScreen() {
  const {
    employee,
    transactions,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    stagedSortOrder,
    stagedFromDate,
    stagedToDate,
    setStagedSortOrder,
    setStagedFromDate,
    setStagedToDate,
    handleApplyFilter,
    handleLoadMore,
    handleAddPayment,
    goBack,
  } = useSalaryLedgerDetail();

  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SalaryLedgerTransaction | null>(null);

  const handleShowAudit = (entry: SalaryLedgerTransaction) => {
    setSelectedEntry(entry);
    setShowAuditModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/employees/salary-ledger')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Salary Ledger
          </button>
          <h1 className="text-gray-900">Salary Ledger Details</h1>
          <p className="text-gray-600 mt-1">Employee passbook and transaction history</p>
        </div>

        {/* Employee Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Employee Name</p>
              <p className="text-gray-900">{employee?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Employee ID</p>
              <p className="text-gray-900 truncate">{employee?.id ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Role</p>
              <p className="text-gray-900">{employee?.role_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Category</p>
              <span className="inline-block px-2 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                {CATEGORY_LABELS[employee?.role_category ?? ''] ?? employee?.role_category ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Running Balance Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-md p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-1">Current Running Balance</p>
              <p className="text-3xl">
                {(() => {
                  const bal = employee?.running_balance ?? 0;
                  if (bal < 0) return `-₹${Math.abs(bal).toLocaleString()}`;
                  return `₹${bal.toLocaleString()}`;
                })()}
              </p>
            </div>
            <button
              onClick={handleAddPayment}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Payment
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleApplyFilter}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Filter className="w-4 h-4" />
              Apply Filter
            </button>
          </div>
        </div>

        {/* Ledger Entries */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900">Transaction History</h2>
              {totalCount > 0 && (
                <span className="text-gray-500 text-sm">{transactions.length} of {totalCount}</span>
              )}
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No salary transactions recorded for this employee.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700">Date & Time</th>
                        <th className="px-4 py-3 text-left text-gray-700">Type</th>
                        <th className="px-4 py-3 text-left text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left text-gray-700">Notes</th>
                        <th className="px-4 py-3 text-left text-gray-700">Mode of Payment</th>
                        <th className="px-4 py-3 text-left text-gray-700">SAI</th>
                        <th className="px-4 py-3 text-left text-gray-700">RAI</th>
                        <th className="px-4 py-3 text-left text-gray-700">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {transactions.map((entry) => {
                        const { date, time } = formatDateTime(entry.created_at);
                        return (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-gray-900">{date}, {time}</td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-full text-sm ${getEntryTypeStyle(entry.entry_type)}`}>
                                {formatEntryType(entry.entry_type)}
                              </span>
                            </td>
                            <td className={`px-4 py-4 ${entry.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {entry.amount > 0 ? '+' : ''}₹{Math.abs(entry.amount).toLocaleString()}
                            </td>
                            <td className="px-4 py-4 text-gray-600 text-sm">{entry.notes || '—'}</td>
                            <td className="px-4 py-4 text-gray-900 text-sm">{entry.payment_mode || '—'}</td>
                            <td className="px-4 py-4 text-gray-600 text-sm">{entry.sender_account_id || '—'}</td>
                            <td className="px-4 py-4 text-gray-600 text-sm">{entry.receiver_account || '—'}</td>
                            <td className="px-4 py-4">
                              <button
                                onClick={() => handleShowAudit(entry)}
                                className="text-blue-600 hover:text-blue-800"
                                title="View Audit Details"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="lg:hidden space-y-4">
                  {transactions.map((entry) => {
                    const { date, time } = formatDateTime(entry.created_at);
                    return (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-gray-900 text-sm">{date}, {time}</p>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs mt-1 ${getEntryTypeStyle(entry.entry_type)}`}>
                              {formatEntryType(entry.entry_type)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleShowAudit(entry)}
                            className="text-blue-600 hover:text-blue-800 p-2"
                            title="View Audit Details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Amount:</span>
                            <span className={entry.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                              {entry.amount > 0 ? '+' : ''}₹{Math.abs(entry.amount).toLocaleString()}
                            </span>
                          </div>
                          {entry.notes && (
                            <div>
                              <span className="text-gray-600">Notes: </span>
                              <span className="text-gray-900">{entry.notes}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Mode of Payment: </span>
                            <span className="text-gray-900">{entry.payment_mode || '—'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">SAI: </span>
                            <span className="text-gray-900 text-xs">{entry.sender_account_id || '—'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">RAI: </span>
                            <span className="text-gray-900 text-xs">{entry.receiver_account || '—'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Modal */}
      {showAuditModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
            <div className="flex flex-col">
              <h2 className="text-gray-900 mb-4">Audit Details</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-gray-600 text-sm">Transaction ID</p>
                  <p className="text-gray-900 text-sm break-all">{selectedEntry.id}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Created At</p>
                  <p className="text-gray-900">{formatDateTime(selectedEntry.created_at).date}, {formatDateTime(selectedEntry.created_at).time}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Mode of Payment</p>
                  <p className="text-gray-900">{selectedEntry.payment_mode || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Sender Account Info</p>
                  <p className="text-gray-900 text-sm break-all">{selectedEntry.sender_account_id || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Receiver Account Info</p>
                  <p className="text-gray-900 text-sm break-all">{selectedEntry.receiver_account || '—'}</p>
                </div>
                {selectedEntry.notes && (
                  <div>
                    <p className="text-gray-600 text-sm">Notes</p>
                    <p className="text-gray-900">{selectedEntry.notes}</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}