import { ArrowLeft } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useAddLoanTransaction } from '../../../hooks/useAddLoanTransaction';

export function AddLoanTransactionScreen() {
  const {
    loanId,
    loan,
    loanLoading,
    accounts,
    accountsLoading,
    transactionInput,
    updateTransactionInput,
    errors,
    showSuccessPopup,
    showFailurePopup,
    errorMessage,
    submitting,
    today,
    selectedAccountBalance,
    handleSubmit,
    handleSuccessClose,
    handleFailureClose,
    handleBackToLedger,
    getTransactionDescription,
    getFormattedLoanType,
  } = useAddLoanTransaction();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBackToLedger}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Loan Ledger
          </button>

          <h1 className="text-gray-900">Add Loan Transaction</h1>
          <p className="text-gray-600 mt-1">Record a new transaction for {loan?.lender_name || 'this loan'}</p>
        </div>

        {/* Loan Details Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          {loanLoading ? (
            <p className="text-gray-600">Loading loan details...</p>
          ) : loan ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Loan Type</p>
                <p className="text-gray-900">{getFormattedLoanType()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Principal Amount</p>
                <p className="text-gray-900">₹{loan.principal_amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Outstanding Balance</p>
                <p className={`${loan.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{loan.outstanding_balance.toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-600">Loan details not found.</p>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Transaction Type */}
            <div>
              <label htmlFor="transactionType" className="block text-gray-700 mb-2">
                Transaction Type <span className="text-red-600">*</span>
              </label>
              <select
                id="transactionType"
                value={transactionInput.transaction_type}
                onChange={(e) => updateTransactionInput('transaction_type', e.target.value as 'REPAYMENT' | 'INTEREST')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="REPAYMENT">Repayment</option>
                <option value="INTEREST">Interest Payment</option>
              </select>
              <p className="text-blue-600 text-sm mt-2">{getTransactionDescription()}</p>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-gray-700 mb-2">
                Amount <span className="text-red-600">*</span>
              </label>
              <input
                id="amount"
                type="number"
                value={transactionInput.amount || ''}
                onChange={(e) => updateTransactionInput('amount', parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter amount"
                min="0.01"
                step="0.01"
              />
              {errors.amount && (
                <p className="text-red-600 text-sm mt-1">{errors.amount}</p>
              )}
              {selectedAccountBalance !== undefined && transactionInput.amount > 0 && !errors.amount && (
                <p className={`text-sm mt-1 ${transactionInput.amount > selectedAccountBalance ? 'text-red-600' : 'text-gray-500'}`}>
                  Available account balance: ₹{selectedAccountBalance.toLocaleString()}
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-gray-700 mb-2">
                Date <span className="text-red-600">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={transactionInput.transaction_date}
                max={today}
                onChange={(e) => updateTransactionInput('transaction_date', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {errors.transaction_date && (
                <p className="text-red-600 text-sm mt-1">{errors.transaction_date}</p>
              )}
              <p className="text-gray-500 text-sm mt-1">Future dates are disabled</p>
            </div>

            {/* Mode of Payment */}
            <div>
              <label htmlFor="modeOfPayment" className="block text-gray-700 mb-2">
                Mode of Payment <span className="text-red-600">*</span>
              </label>
              <select
                id="modeOfPayment"
                value={transactionInput.payment_mode}
                onChange={(e) => updateTransactionInput('payment_mode', e.target.value as 'CASH' | 'BANK' | 'UPI' | 'CHEQUE')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            {/* Sender Account Info (SAI) */}
            <div>
              <label htmlFor="sai" className="block text-gray-700 mb-2">
                Sender Account Info (SAI) {transactionInput.payment_mode !== 'CASH' && <span className="text-red-600">*</span>}
              </label>
              <select
                id="sai"
                value={transactionInput.sender_account_id}
                onChange={(e) => updateTransactionInput('sender_account_id', e.target.value)}
                disabled={transactionInput.payment_mode === 'CASH' || accountsLoading}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  transactionInput.payment_mode === 'CASH' || accountsLoading ? 'bg-gray-100 text-gray-500' : ''
                }`}
              >
                <option value="">{accountsLoading ? 'Loading accounts...' : 'Select account'}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    #{account.account_number} (Balance: ₹{account.balance.toLocaleString()})
                  </option>
                ))}
              </select>
              {errors.sender_account_id && (
                <p className="text-red-600 text-sm mt-1">{errors.sender_account_id}</p>
              )}
              {transactionInput.payment_mode === 'CASH' && (
                <p className="text-gray-500 text-sm mt-1">Not required for cash payments</p>
              )}
            </div>

            {/* Receiver Account Info (RAI) */}
            <div>
              <label htmlFor="rai" className="block text-gray-700 mb-2">
                Receiver Account Info (RAI) {transactionInput.payment_mode !== 'CASH' && <span className="text-red-600">*</span>}
              </label>
              <input
                id="rai"
                type="text"
                value={transactionInput.receiver_account_info}
                onChange={(e) => updateTransactionInput('receiver_account_info', e.target.value)}
                disabled={transactionInput.payment_mode === 'CASH'}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  transactionInput.payment_mode === 'CASH' ? 'bg-gray-100 text-gray-500' : ''
                }`}
                placeholder="Enter receiver account info"
              />
              {errors.receiver_account_info && (
                <p className="text-red-600 text-sm mt-1">{errors.receiver_account_info}</p>
              )}
              {transactionInput.payment_mode === 'CASH' && (
                <p className="text-gray-500 text-sm mt-1">Not required for cash payments</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-gray-700 mb-2">
                Notes <span className="text-gray-500 text-sm">(Optional)</span>
              </label>
              <textarea
                id="notes"
                value={transactionInput.notes}
                onChange={(e) => updateTransactionInput('notes', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                rows={3}
                placeholder="Enter any additional notes"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleBackToLedger}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Success"
          message="Loan transaction recorded successfully."
          onClose={handleSuccessClose}
          type="success"
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Failed to create transaction"
          message={errorMessage || 'Failed to create loan transaction. Please try again.'}
          onClose={handleFailureClose}
          type="error"
        />
      )}
    </div>
  );
}
