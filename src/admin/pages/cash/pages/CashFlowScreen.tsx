import { useState } from 'react';
import { ArrowLeft, Plus, Repeat, X, Loader2, ArrowDownCircle } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useNavigate } from 'react-router-dom';
import { useCashFlow } from '../../../hooks/useCashFlow';

export function CashFlowScreen() {
  const navigate = useNavigate();
  const {
    // Accounts
    accountsLoading,
    cashBalance,
    bankAccounts,

    // Outstanding summaries
    outstandingReceivables,
    outstandingVendorPayables,
    outstandingLoanAmount,
    outstandingSalary,
    summaryLoading,

    // Daily cash ledger
    dayLedgers,
    dayLedgersLoading,
    dayLedgersLoadingMore,
    hasMoreDayLedgers,
    handleLoadMoreDayLedgers,

    // Create account
    createAccountInput,
    errors,
    showCreateAccountModal,
    createLoading,
    updateCreateAccountInput,
    openCreateAccountModal,
    closeCreateAccountModal,
    handleCreateAccount,

    // Popups
    showSuccessPopup,
    setShowSuccessPopup,
    showFailurePopup,
    setShowFailurePopup,
    failureMessage,
  } = useCashFlow();

  const [showBypassErrorPopup, setShowBypassErrorPopup] = useState(false);
  const [bypassErrorMessage, setBypassErrorMessage] = useState('');

  const stripDate = (dateString: string) => dateString.split(' ')[0].split('T')[0];

  const formatDate = (dateString: string) => {
    const dateOnly = stripDate(dateString);
    const date = new Date(dateOnly + 'T00:00:00');
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleDayLedgerClick = (date: string) => {
    navigate(`/admin/cash/ledger/${stripDate(date)}`);
  };

  const isLoading = accountsLoading || summaryLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/home')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Cash Flow Management</h1>
              <p className="text-gray-600 mt-1">Track cash and account balances</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => navigate('/admin/cash/withdraw')}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <ArrowDownCircle className="w-5 h-5" />
                Withdraw
              </button>
              <button
                onClick={() => navigate('/admin/cash/transfer')}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <Repeat className="w-5 h-5" />
                Switch Balance
              </button>
              <button
                onClick={openCreateAccountModal}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Create Account
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Cash Balance */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                <p className="text-gray-600 text-sm mb-2">Cash</p>
                <p className="text-gray-900 text-2xl">₹{cashBalance.toLocaleString()}</p>
              </div>

              {/* Dynamic Bank Account Cards */}
              {bankAccounts.map((account) => (
                <div key={account.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                  <p className="text-gray-600 text-sm mb-2">Account #{account.account_number}</p>
                  <p className="text-gray-900 text-2xl">₹{Number(account.balance).toLocaleString()}</p>
                </div>
              ))}

              {/* Outstanding Receivables */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
                <p className="text-gray-600 text-sm mb-2">Outstanding Receivables</p>
                <p className="text-gray-900 text-2xl">₹{outstandingReceivables.toLocaleString()}</p>
              </div>

              {/* Outstanding Payables (Vendor) */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                <p className="text-gray-600 text-sm mb-2">Outstanding Payables (Vendor)</p>
                <p className="text-gray-900 text-2xl">₹{outstandingVendorPayables.toLocaleString()}</p>
              </div>

              {/* Outstanding Salary */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
                <p className="text-gray-600 text-sm mb-2">Outstanding Salary</p>
                <p className="text-gray-900 text-2xl">₹{outstandingSalary.toLocaleString()}</p>
              </div>

              {/* Outstanding Loan Amount */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                <p className="text-gray-600 text-sm mb-2">Outstanding Loan Amount</p>
                <p className="text-gray-900 text-2xl">₹{outstandingLoanAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* Daily Cash Ledger Table */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-gray-900">Daily Cash Ledger</h2>
              </div>

              <div className="p-6">
                {dayLedgersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : dayLedgers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No cash ledger data available.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left text-gray-700">Cash In</th>
                          <th className="px-4 py-3 text-left text-gray-700">Cash Out</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {dayLedgers.map((ledger) => (
                          <tr
                            key={ledger.date}
                            onClick={() => handleDayLedgerClick(ledger.date)}
                            className="hover:bg-gray-50 cursor-pointer"
                          >
                            <td className="px-4 py-4 text-gray-900">{formatDate(ledger.date)}</td>
                            <td className="px-4 py-4 text-green-600">₹{ledger.cash_in.toLocaleString()}</td>
                            <td className="px-4 py-4 text-red-600">₹{ledger.cash_out.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {hasMoreDayLedgers && (
                <div className="p-6 text-center">
                  <button
                    onClick={handleLoadMoreDayLedgers}
                    disabled={dayLedgersLoadingMore}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {dayLedgersLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Account Modal */}
      {showCreateAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={closeCreateAccountModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-6">Create Account</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="accountNumber" className="block text-gray-700 mb-2">
                  Account Number <span className="text-red-600">*</span>
                </label>
                <input
                  id="accountNumber"
                  type="text"
                  value={createAccountInput.account_number}
                  onChange={(e) => updateCreateAccountInput('account_number', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter account number"
                />
                {errors.account_number && (
                  <p className="text-red-600 text-sm mt-1">{errors.account_number}</p>
                )}
              </div>

              <div>
                <label htmlFor="openingBalance" className="block text-gray-700 mb-2">
                  Opening Balance <span className="text-red-600">*</span>
                </label>
                <input
                  id="openingBalance"
                  type="number"
                  value={createAccountInput.opening_balance}
                  onChange={(e) => updateCreateAccountInput('opening_balance', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter opening balance"
                />
                {errors.opening_balance && (
                  <p className="text-red-600 text-sm mt-1">{errors.opening_balance}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={closeCreateAccountModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAccount}
                  disabled={createLoading}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
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
          message="Account created successfully"
          onClose={() => setShowSuccessPopup(false)}
          type="success"
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Error"
          message={failureMessage}
          onClose={() => setShowFailurePopup(false)}
        />
      )}
    </div>
  );
}
