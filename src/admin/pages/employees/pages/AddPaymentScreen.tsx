import React from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useAddPayment } from '../../../hooks/useAddPayment';
import type { PaymentEntryTypeLabel, PaymentModeLabel } from '../../../validators/addPayment.validator';

const CATEGORY_LABELS: Record<string, string> = {
  DAILY: 'Daily Wages',
  FIXED: 'Fixed Salary',
  LOADMEN: 'Loadmen',
};

export function AddPaymentScreen() {
  const {
    employee,
    accounts,
    loadingData,
    loading,
    formInput,
    updateFormInput,
    handleEntryTypeChange,
    handleModeOfPaymentChange,
    errors,
    showSuccessPopup,
    showFailurePopup,
    handleCreate,
    handleSuccessClose,
    handleFailureClose,
    isAmountDisabled,
    goBack,
    employeeId,
  } = useAddPayment();

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const runningBalance = employee?.running_balance ?? 0;

  const getButtonLabel = () => {
    if (
      formInput.entryType === 'Partial Settlement' ||
      formInput.entryType === 'Full Settlement'
    ) {
      return 'Confirm Settlement';
    }
    return 'Confirm Payment';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack(`/admin/employees/salary-ledger/${employeeId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Ledger
          </button>
          <h1 className="text-gray-900">Add Payment / Settlement</h1>
          <p className="text-gray-600 mt-1">Record a payment or settlement entry</p>
        </div>

        {/* Employee Info Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-gray-900 mb-4">Employee Information</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Employee Name</p>
              <p className="text-gray-900">{employee?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Employee ID</p>
              <p className="text-gray-900">{employee?.id ?? '—'}</p>
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
            <div>
              <p className="text-gray-600 text-sm">Current Balance</p>
              <p className="text-gray-900">₹{runningBalance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Entry Type */}
            <div>
              <label htmlFor="entryType" className="block text-gray-700 mb-2">
                Type of Entry <span className="text-red-600">*</span>
              </label>
              <select
                id="entryType"
                value={formInput.entryType}
                onChange={(e) => handleEntryTypeChange(e.target.value as PaymentEntryTypeLabel)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.entryType ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={runningBalance === 0}
              >
                <option value="">Select entry type</option>
                <option value="Advance Payment">Advance Payment</option>
                <option value="Weekly Payment">Weekly Payment</option>
                <option value="Emergency Payment">Emergency Payment</option>
                <option value="Daily / Ad-hoc Payment">Daily / Ad-hoc Payment</option>
                <option value="Partial Settlement">Partial Settlement</option>
                <option value="Full Settlement">Full Settlement</option>
              </select>
              {errors.entryType && <p className="text-red-600 text-sm mt-1">{errors.entryType}</p>}
              {runningBalance === 0 && (
                <p className="text-orange-600 text-sm mt-1">No pending balance available for settlement</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-gray-700 mb-2">
                Amount (₹) <span className="text-red-600">*</span>
              </label>
              <input
                id="amount"
                type="number"
                value={formInput.amount}
                onChange={(e) => updateFormInput('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                } ${isAmountDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="Enter amount"
                min="1"
                step="0.01"
                disabled={isAmountDisabled}
              />
              {errors.amount && <p className="text-red-600 text-sm mt-1">{errors.amount}</p>}
              {formInput.entryType === 'Full Settlement' && (
                <p className="text-gray-600 text-sm mt-1">Amount auto-filled to match current running balance</p>
              )}
            </div>

            {/* Date & Time */}
            <div>
              <label htmlFor="dateTime" className="block text-gray-700 mb-2">
                Date & Time <span className="text-red-600">*</span>
              </label>
              <input
                id="dateTime"
                type="datetime-local"
                value={formInput.dateTime}
                onChange={(e) => updateFormInput('dateTime', e.target.value)}
                max={new Date().toISOString().slice(0, 16)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.dateTime ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.dateTime && <p className="text-red-600 text-sm mt-1">{errors.dateTime}</p>}
              <p className="text-gray-600 text-sm mt-1">You can backdate an entry if needed</p>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-gray-700 mb-2">Notes (Optional)</label>
              <input
                id="notes"
                type="text"
                value={formInput.notes}
                onChange={(e) => updateFormInput('notes', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="e.g., Going to native, Medical need, Weekly payout (max 80 characters)"
                maxLength={80}
              />
              <div className="flex justify-end mt-1">
                <p className="text-gray-500 text-sm">{formInput.notes.length}/80</p>
              </div>
            </div>

            {/* Mode of Payment */}
            <div>
              <label htmlFor="modeOfPayment" className="block text-gray-700 mb-2">
                Mode of Payment <span className="text-red-600">*</span>
              </label>
              <select
                id="modeOfPayment"
                value={formInput.modeOfPayment}
                onChange={(e) => handleModeOfPaymentChange(e.target.value as PaymentModeLabel)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.modeOfPayment ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
              {errors.modeOfPayment && <p className="text-red-600 text-sm mt-1">{errors.modeOfPayment}</p>}
            </div>

            {/* SAI - Only show if mode is not Cash */}
            {formInput.modeOfPayment !== 'Cash' && (
              <div>
                <label htmlFor="senderAccountId" className="block text-gray-700 mb-2">
                  SAI (Sender Account) <span className="text-red-600">*</span>
                </label>
                <select
                  id="senderAccountId"
                  value={formInput.senderAccountId}
                  onChange={(e) => updateFormInput('senderAccountId', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                    errors.senderAccountId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_number}
                    </option>
                  ))}
                </select>
                {errors.senderAccountId && (
                  <p className="text-red-600 text-sm mt-1">{errors.senderAccountId}</p>
                )}
              </div>
            )}

            {/* RAI - Only show if mode is not Cash */}
            {formInput.modeOfPayment !== 'Cash' && (
              <div>
                <label htmlFor="receiverAccountInfo" className="block text-gray-700 mb-2">
                  RAI (Receiver Account Info) <span className="text-red-600">*</span>
                </label>
                <input
                  id="receiverAccountInfo"
                  type="text"
                  value={formInput.receiverAccountInfo}
                  onChange={(e) => updateFormInput('receiverAccountInfo', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                    errors.receiverAccountInfo ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter receiver account info"
                />
                {errors.receiverAccountInfo && (
                  <p className="text-red-600 text-sm mt-1">{errors.receiverAccountInfo}</p>
                )}
              </div>
            )}

            {/* Info Box */}
            {formInput.entryType && (
              <div
                className={`p-4 rounded-lg ${
                  formInput.entryType.includes('Settlement')
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                <p className="text-sm text-gray-700">
                  {formInput.entryType.includes('Settlement')
                    ? `This settlement will ${
                        formInput.entryType === 'Full Settlement' ? 'clear the entire' : 'reduce the'
                      } running balance.`
                    : 'This payment will be deducted from the running balance.'}
                </p>
                {formInput.amount && (
                  <p className="text-sm text-gray-700 mt-1">
                    New balance after this transaction: ₹
                    {(runningBalance - Number(formInput.amount)).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading || (runningBalance === 0 && formInput.entryType === 'Full Settlement')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Saving...' : getButtonLabel()}
              </button>
              <button
                type="button"
                onClick={() => goBack(`/admin/employees/salary-ledger/${employeeId}`)}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Entry Added Successfully"
          message="The payment entry has been recorded."
          onClose={handleSuccessClose}
          type="success"
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Failed to Save Entry"
          message={errors.form || 'Unable to save entry. Please try again.'}
          onClose={handleFailureClose}
          type="error"
        />
      )}
    </div>
  );
}