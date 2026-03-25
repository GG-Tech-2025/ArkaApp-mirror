import React from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useLoanLedger } from '../../../hooks/useLoanLedger';

export function LoanLedgerScreen() {
  const { loanId } = useParams<{ loanId: string }>();
  const {
    loan,
    loanLoading,
    formattedLoanType,
    transactions,
    loading,
    hasMore,
    loadingMore,
    showFailurePopup,
    errorMessage,
    getStatusLabel,
    getTransactionTypeLabel,
    getTransactionTypeColor,
    handleBackToLoans,
    handleAddTransaction,
    handleFailureClose,
    loadMore,
  } = useLoanLedger(loanId);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBackToLoans}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Loan Management
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Loan Ledger - {loan?.lender_name || 'Loan'}</h1>
              <p className="text-gray-600 mt-1">Transaction history and details</p>
            </div>
            <button
              onClick={handleAddTransaction}
              disabled={!loanId}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Add Transaction
            </button>
          </div>
        </div>

        {/* Loan Details Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          {loanLoading ? (
            <p className="text-gray-600">Loading loan details...</p>
          ) : loan ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div>
                <p className="text-gray-600 text-sm">Loan Type</p>
                <p className="text-gray-900">{formattedLoanType}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Principal Amount</p>
                <p className="text-gray-900">₹{loan.principal_amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Interest Rate</p>
                <p className="text-gray-900">
                  {loan.interest_rate != null ? `${loan.interest_rate}%` : '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Outstanding Balance</p>
                <p className={`${loan.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{loan.outstanding_balance.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <span className={`px-3 py-1 rounded-full text-sm ${loan.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {getStatusLabel(loan.status)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-600">Loan details not found.</p>
          )}
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-gray-900">Transaction History</h2>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-12 text-center">
                <p className="text-gray-600">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-600">No transactions found for this loan.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left text-gray-700">Transaction Type</th>
                        <th className="px-4 py-3 text-left text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left text-gray-700">Running Loan Balance</th>
                        <th className="px-4 py-3 text-left text-gray-700">Mode of Payment</th>
                        <th className="px-4 py-3 text-left text-gray-700">SAI</th>
                        <th className="px-4 py-3 text-left text-gray-700">RAI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-gray-900">{formatDate(transaction.transaction_date)}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-sm ${getTransactionTypeColor(transaction.transaction_type)}`}>
                              {getTransactionTypeLabel(transaction.transaction_type)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-900">₹{transaction.amount.toLocaleString()}</td>
                          <td className="px-4 py-4 text-gray-900">₹{transaction.running_balance.toLocaleString()}</td>
                          <td className="px-4 py-4 text-gray-900">{transaction.payment_mode}</td>
                          <td className="px-4 py-4 text-gray-900">{transaction.sender_account_id || '-'}</td>
                          <td className="px-4 py-4 text-gray-900">{transaction.receiver_account_info || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Failed to load loan ledger"
          message={errorMessage || 'Failed to load loan ledger. Please try again.'}
          onClose={handleFailureClose}
          type="error"
        />
      )}
    </div>
  );
}