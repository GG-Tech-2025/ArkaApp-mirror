import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Search, Calculator, Settings, Save } from 'lucide-react';
import { useSalaryLedger } from '../../../hooks/useSalaryLedger';
import { getLoadingPerBrickRate, updateLoadingPerBrickRate } from '../../../../services/middleware.service';
import { Popup } from '../../../../components/Popup';

const CATEGORY_LABELS: Record<string, string> = {
  DAILY: 'Daily Wages',
  FIXED: 'Fixed Salary',
  LOADMEN: 'Loadmen',
};

export function SalaryLedgerScreen() {
  const {
    activeTab,
    activeEmployees,
    inactiveEmployees,
    loading,
    hasMoreActive,
    hasMoreInactive,
    searchQuery,
    handleSearchChange,
    handleTabChange,
    handleLoadMoreActive,
    handleLoadMoreInactive,
    handleOpenLedger,
    goBack,
    goTo,
  } = useSalaryLedger();

  // Loading per-brick rate configuration
  const [perBrickRate, setPerBrickRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [rateError, setRateError] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);

  useEffect(() => {
    fetchRate();
  }, []);

  const fetchRate = async () => {
    try {
      const rate = await getLoadingPerBrickRate();
      setPerBrickRate(rate.toString());
    } catch (err) {
      console.error('Error fetching rate:', err);
    }
  };

  const handleSaveRate = async () => {
    // Validate
    if (!perBrickRate.trim()) {
      setRateError('Rate is required');
      return;
    }

    const rate = Number(perBrickRate);
    if (isNaN(rate)) {
      setRateError('Please enter a valid number');
      return;
    }

    if (rate < 0) {
      setRateError('Rate cannot be negative');
      return;
    }

    if (rate > 1000) {
      setRateError('Rate seems too high');
      return;
    }

    try {
      setIsSaving(true);
      setRateError('');
      await updateLoadingPerBrickRate(rate);
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Error saving rate:', err);
      setShowFailurePopup(true);
    } finally {
      setIsSaving(false);
    }
  };

  const displayedEmployees = activeTab === 'Active' ? activeEmployees : inactiveEmployees;
  const hasMore = activeTab === 'Active' ? hasMoreActive : hasMoreInactive;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/home')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Employee Salary Ledger</h1>
              <p className="text-gray-600 mt-1">View and manage employee salary records</p>
            </div>
            <button
              onClick={() => goTo('/admin/employees/salary-ledger/calculate')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Calculator className="w-5 h-5" />
              Calculate Salary
            </button>
          </div>
        </div>

        {/* Loading Per-Brick Rate Configuration */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <Settings className="w-5 h-5 text-blue-600 mt-1 shrink-0" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Loading Work Configuration</h2>
              <p className="text-sm text-gray-600 mb-4">
                Set the per-brick rate for loading and unloading work. This rate is used to calculate salaries for employees who perform loading/unloading tasks. The amount is automatically divided equally among all selected employees for each order.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1 max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Per Brick Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1000"
                    value={perBrickRate}
                    onChange={(e) => {
                      setPerBrickRate(e.target.value);
                      setRateError('');
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {rateError && (
                    <p className="text-red-600 text-sm mt-1">{rateError}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Example: ₹{perBrickRate || '0'} × 5000 bricks ÷ 3 employees = ₹{((Number(perBrickRate || 0) * 5000) / 3).toFixed(2)} per person
                  </p>
                </div>
                
                <button
                  onClick={handleSaveRate}
                  disabled={isSaving || !perBrickRate}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Rate'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, or phone number..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabs + Content */}
        <div className="bg-white rounded-lg shadow-lg">
          {/* Tab Buttons */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => handleTabChange('Active')}
                className={`px-6 py-4 whitespace-nowrap transition-colors ${
                  activeTab === 'Active'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => handleTabChange('Inactive')}
                className={`px-6 py-4 whitespace-nowrap transition-colors ${
                  activeTab === 'Inactive'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            <div className="space-y-4">
              {loading && displayedEmployees.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-gray-600">Loading employees...</p>
                </div>
              ) : displayedEmployees.length === 0 ? (
                <div className="p-12 text-center">
                  <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No {activeTab.toLowerCase()} employees found</p>
                </div>
              ) : (
                displayedEmployees.map((employee) => (
                  <div key={employee.id} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Employee Info */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                        <div>
                          <p className="text-gray-600 text-sm">Name</p>
                          <p className="text-gray-900">{employee.name}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-sm">ID</p>
                          <p className="text-gray-900">{employee.id}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-sm">Role</p>
                          <p className="text-gray-900">{employee.role_name}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-sm">Category</p>
                          <span className={`inline-block px-2 py-1 rounded-full text-sm ${
                            employee.category === 'DAILY' ? 'bg-purple-100 text-purple-800' :
                            employee.category === 'FIXED' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {CATEGORY_LABELS[employee.category] ?? employee.category}
                          </span>
                        </div>
                      </div>

                      {/* Running Balance & Action */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-gray-600 text-sm">Running Balance</p>
                          <p className={`text-lg ${employee.running_balance > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                            ₹{employee.running_balance.toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenLedger(employee.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          <BookOpen className="w-4 h-4" />
                          Open Ledger
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={activeTab === 'Active' ? handleLoadMoreActive : handleLoadMoreInactive}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Rate Updated Successfully"
          message={`Per-brick rate has been updated to ₹${perBrickRate}`}
          type="success"
          onClose={() => setShowSuccessPopup(false)}
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Update Failed"
          message="Failed to update the per-brick rate. Please try again."
          type="error"
          onClose={() => setShowFailurePopup(false)}
        />
      )}
    </div>
  );
}
