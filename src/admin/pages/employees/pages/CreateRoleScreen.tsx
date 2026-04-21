import React from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useCreateRole } from '../../../hooks/useCreateRole';
import type { RoleCategoryLabel } from '../../../validators/createRole.validator';

export function CreateRoleScreen() {
  const {
    createRoleInput,
    updateCreateRoleInput,
    handleCategoryChange,
    errors,
    showSuccessPopup,
    showFailurePopup,
    loading,
    handleCreate,
    handleSuccessClose,
    handleFailureClose,
    goBack,
  } = useCreateRole();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/employees/role-setup')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Role & Salary Setup
          </button>
          <h1 className="text-gray-900">Create New Role</h1>
          <p className="text-gray-600 mt-1">Define a new employee role with salary structure</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Role Name */}
            <div>
              <label htmlFor="roleName" className="block text-gray-700 mb-2">
                Role Name <span className="text-red-600">*</span>
              </label>
              <input
                id="roleName"
                type="text"
                value={createRoleInput.roleName}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[a-zA-Z\s]*$/.test(value)) {
                    updateCreateRoleInput('roleName', value);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="e.g., Machine Operator, Supervisor, Driver"
              />
              {errors.roleName && <p className="text-red-600 text-sm mt-1">{errors.roleName}</p>}
            </div>

            {/* Employee Category */}
            <div>
              <label htmlFor="employeeCategory" className="block text-gray-700 mb-2">
                Employee Category <span className="text-red-600">*</span>
              </label>
              <select
                id="employeeCategory"
                value={createRoleInput.category}
                onChange={(e) => handleCategoryChange(e.target.value as RoleCategoryLabel)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select category</option>
                <option value="Daily Wages">Daily Wages</option>
                <option value="Fixed Salary">Fixed Salary</option>
                <option value="Loadmen">Loadmen (Order-Based Salary)</option>
              </select>
              {errors.category && <p className="text-red-600 text-sm mt-1">{errors.category}</p>}
            </div>

            {/* Dynamic Salary Fields - Daily Wages */}
            {createRoleInput.category === 'Daily Wages' && (
              <div>
                <label htmlFor="perDayWage" className="block text-gray-700 mb-2">
                  Per Day Wage (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  id="perDayWage"
                  type="number"
                  value={createRoleInput.perDayWage}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*$/.test(value)) {
                      updateCreateRoleInput('perDayWage', value);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter daily wage (integers only, max 5 digits)"
                  min="1"
                  step="1"
                />
                {errors.perDayWage && <p className="text-red-600 text-sm mt-1">{errors.perDayWage}</p>}
              </div>
            )}

            {/* Dynamic Salary Fields - Fixed Salary */}
            {createRoleInput.category === 'Fixed Salary' && (
              <div>
                <label htmlFor="monthlySalary" className="block text-gray-700 mb-2">
                  Monthly Salary (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  id="monthlySalary"
                  type="number"
                  value={createRoleInput.monthlySalary}
                  onChange={(e) => updateCreateRoleInput('monthlySalary', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter monthly salary (max 6 digits)"
                  min="1"
                  step="0.01"
                />
                {errors.monthlySalary && <p className="text-red-600 text-sm mt-1">{errors.monthlySalary}</p>}
                <p className="text-gray-600 text-sm mt-2">
                  Deductions for absent/half days can be configured per employee basis
                </p>
              </div>
            )}

            {/* Dynamic Salary Fields - Loadmen */}
            {createRoleInput.category === 'Loadmen' && (
              <>
                {/* UPDATED: Show info message instead of rate input */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-2">💡 Salary Calculation for Loadmen:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Salary is calculated based on a <strong>global per-brick rate</strong></li>
                        <li>Rate applies equally to all employees doing loading work</li>
                        <li>No need to set individual rate for this role</li>
                        <li>Configuration will be available in Settings after database update</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="minimumLoadRequirement" className="block text-gray-700 mb-2">
                    Minimum Load Requirement (Optional)
                  </label>
                  <input
                    id="minimumLoadRequirement"
                    type="number"
                    value={createRoleInput.minimumLoadRequirement}
                    onChange={(e) => updateCreateRoleInput('minimumLoadRequirement', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Enter minimum loads per month"
                    min="0"
                  />
                  <p className="text-gray-600 text-sm mt-2">
                    For business rules and performance tracking (optional)
                  </p>
                </div>
              </>
            )}

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Creating...' : 'Create Role'}
              </button>
              <button
                type="button"
                onClick={() => goBack('/admin/employees/role-setup')}
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
          title="Role Created Successfully"
          message="The role has been created successfully."
          onClose={handleSuccessClose}
          type="success"
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Creation Failed"
          message={errors.form || 'Failed to create role. Please try again.'}
          onClose={handleFailureClose}
          type="error"
        />
      )}
    </div>
  );
}