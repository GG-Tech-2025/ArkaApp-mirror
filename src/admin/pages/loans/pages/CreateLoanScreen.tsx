import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useCreateLoan } from '../../../hooks/useCreateLoan';

export function CreateLoanScreen() {
  const {
    createLoanInput,
    updateCreateLoanInput,
    accounts,
    accountsLoading,
    errors,
    showSuccessPopup,
    showFailurePopup,
    loading,
    handleCreate,
    handleSuccessClose,
    handleFailureClose,
    goBack,
  } = useCreateLoan();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/loans')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Loan Management
          </button>

          <h1 className="text-gray-900">Create Loan</h1>
          <p className="text-gray-600 mt-1">Add a new loan record</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Lender Name */}
            <div>
              <label htmlFor="lenderName" className="block text-gray-700 mb-2">
                Lender Name <span className="text-red-600">*</span>
              </label>
              <input
                id="lenderName"
                type="text"
                value={createLoanInput.lender_name}
                onChange={(e) => updateCreateLoanInput('lender_name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter lender name"
              />
              {errors.lender_name && (
                <p className="text-red-600 text-sm mt-1">{errors.lender_name}</p>
              )}
            </div>

            {/* Loan Type */}
            <div>
              <label htmlFor="loanType" className="block text-gray-700 mb-2">
                Loan Type <span className="text-red-600">*</span>
              </label>
              <select
                id="loanType"
                value={createLoanInput.loan_type}
                onChange={(e) => updateCreateLoanInput('loan_type', e.target.value as 'OWNER' | 'BANK' | 'SHORT_TERM')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="OWNER">Owner Loan</option>
                <option value="BANK">Bank Loan</option>
                <option value="SHORT_TERM">Short-term Borrowing</option>
              </select>
            </div>

            {/* Principal Amount */}
            <div>
              <label htmlFor="principalAmount" className="block text-gray-700 mb-2">
                Principal Amount <span className="text-red-600">*</span>
              </label>
              <input
                id="principalAmount"
                type="number"
                value={createLoanInput.principal_amount || ''}
                onChange={(e) => updateCreateLoanInput('principal_amount', parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter principal amount"
                min="0.01"
                step="0.01"
              />
              {errors.principal_amount && (
                <p className="text-red-600 text-sm mt-1">{errors.principal_amount}</p>
              )}
            </div>

            {/* Interest Rate */}
            <div>
              <label htmlFor="interestRate" className="block text-gray-700 mb-2">
                Interest Rate (%) <span className="text-gray-500 text-sm">(Optional)</span>
              </label>
              <input
                id="interestRate"
                type="number"
                step="0.01"
                value={createLoanInput.interest_rate ?? ''}
                onChange={(e) => updateCreateLoanInput('interest_rate', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter interest rate"
                min="0"
              />
              {errors.interest_rate && (
                <p className="text-red-600 text-sm mt-1">{errors.interest_rate}</p>
              )}
            </div>

            {/* Disbursement Account */}
            <div>
              <label htmlFor="disbursementAccount" className="block text-gray-700 mb-2">
                Disbursement Account <span className="text-red-600">*</span>
              </label>
              <select
                id="disbursementAccount"
                value={createLoanInput.disbursement_account_id ?? ''}
                onChange={(e) => updateCreateLoanInput('disbursement_account_id', e.target.value || null)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select Account</option>
                {accountsLoading ? (
                  <option value="" disabled>Loading accounts...</option>
                ) : accounts.length > 0 ? (
                  accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_number}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No accounts found</option>
                )}
              </select>
              {errors.disbursement_account_id && (
                <p className="text-red-600 text-sm mt-1">{errors.disbursement_account_id}</p>
              )}
            </div>

            {/* Loan Start Date */}
            <div>
              <label htmlFor="loanStartDate" className="block text-gray-700 mb-2">
                Loan Start Date <span className="text-red-600">*</span>
              </label>
              <input
                id="loanStartDate"
                type="date"
                value={createLoanInput.start_date}
                onChange={(e) => updateCreateLoanInput('start_date', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {errors.start_date && (
                <p className="text-red-600 text-sm mt-1">{errors.start_date}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-gray-700 mb-2">
                Notes <span className="text-gray-500 text-sm">(Optional, max 100 characters)</span>
              </label>
              <textarea
                id="notes"
                value={createLoanInput.notes ?? ''}
                onChange={(e) => updateCreateLoanInput('notes', e.target.value.slice(0, 100))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                rows={3}
                maxLength={100}
                placeholder="Enter any additional notes"
              />
              <p className="text-gray-500 text-sm mt-1">{(createLoanInput.notes ?? '').length}/100 characters</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => goBack('/admin/loans')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Loan Created Successfully"
          message="The loan has been created successfully."
          onClose={handleSuccessClose}
          type="success"
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Creation Failed"
          message={errors.form || 'Failed to create loan. Please try again.'}
          onClose={handleFailureClose}
          type="error"
        />
      )}
    </div>
  );
}
