import React from 'react';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';
import { useSalaryLedger } from '../../../hooks/useSalaryLedger';

const CATEGORY_LABELS: Record<string, string> = {
  DAILY: 'Daily Wages',
  FIXED: 'Fixed Salary',
  LOADMEN: 'Loadmen',
};

export function SalaryLedgerScreen() {
  const {
    employees,
    loading,
    hasMore,
    searchQuery,
    handleSearchChange,
    handleLoadMore,
    handleOpenLedger,
    goBack,
  } = useSalaryLedger();

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
          <h1 className="text-gray-900">Employee Salary Ledger</h1>
          <p className="text-gray-600 mt-1">View and manage employee salary records</p>
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

        {/* Employee Cards */}
        <div className="space-y-4">
          {loading && employees.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-600">Loading employees...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No employees found</p>
            </div>
          ) : (
            employees.map((employee) => (
              <div key={employee.id} className="bg-white rounded-lg shadow-md p-6">
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
                onClick={handleLoadMore}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
