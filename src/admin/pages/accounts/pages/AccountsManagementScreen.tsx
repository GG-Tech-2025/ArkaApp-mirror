import { useState } from 'react';
import { ArrowLeft, Plus, Wallet, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useAccountsIncome } from '../../../hooks/useAccountsIncome';
import { useAccountsExpenses } from '../../../hooks/useAccountsExpenses';
import { useAccountsLoanIncome } from '../../../hooks/useAccountsLoanIncome';
import { useAccountsLoanInterest } from '../../../hooks/useAccountsLoanInterest';

type FilterType = 'Current Month' | 'Last month' | 'Last year' | 'Custom range';

export function AccountsManagementScreen() {
  const { goBack, goTo } = useAdminNavigation();
  const [filterType, setFilterType] = useState<FilterType>('Current Month');
  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('Overall');

  // Fetch income data based on filter
  const { 
    orders, 
    loading: incomeLoading, 
    error: incomeError, 
    totalIncome, 
    showError: showIncomeError, 
    closeError: closeIncomeError 
  } = useAccountsIncome(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined
  );

  // Fetch loan interest expenses based on filter
  const {
    loanInterestEntries,
    loading: loanInterestLoading,
    error: loanInterestError,
    totalLoanInterest,
    showError: showLoanInterestError,
    closeError: closeLoanInterestError,
  } = useAccountsLoanInterest(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined
  );

  // Fetch loan disbursement income based on filter
  const {
    loanDisbursements,
    loading: loanIncomeLoading,
    error: loanIncomeError,
    totalLoanIncome,
    showError: showLoanIncomeError,
    closeError: closeLoanIncomeError,
  } = useAccountsLoanIncome(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined
  );

  // Fetch expenses data based on filter and selected type (pass loanInterestTotal for pie chart)
  const {
    expenses,
    procurements,
    salaryEntries,
    expenseTypes,
    loading: expensesLoading,
    error: expensesError,
    totalExpenses,
    totalProcurements,
    totalSalary,
    pieChartData,
    showError: showExpensesError,
    closeError: closeExpensesError,
  } = useAccountsExpenses(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined,
    selectedExpenseTypeId,
    totalLoanInterest
  );

  // Calculate profit (includes procurements, loan income, loan interest, and salary)
  const profit = totalIncome + totalLoanIncome - totalExpenses - totalProcurements - totalLoanInterest - totalSalary;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  const handleFilterChange = (value: FilterType) => {
    if (value === 'Custom range') {
      setShowCustomRangeModal(true);
    } else {
      setFilterType(value);
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      setFilterType('Custom range');
      setShowCustomRangeModal(false);
    }
  };

  const handleCloseCustomRangeModal = () => {
    setShowCustomRangeModal(false);
    setCustomStartDate('');
    setCustomEndDate('');
  };

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
              <h1 className="text-gray-900">Accounts Management</h1>
              <p className="text-gray-600 mt-1">Track income, expenses, and business finances</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Filter Dropdown */}
              <select
                value={filterType === 'Custom range' ? 'Custom range' : filterType}
                onChange={(e) => handleFilterChange(e.target.value as FilterType)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="Current Month">Current Month</option>
                <option value="Last month">Last month</option>
                <option value="Last year">Last year</option>
                <option value="Custom range">Custom range</option>
              </select>
              
              {/* Add Expense Button */}
              <button
                onClick={() => goTo('/admin/accounts/expense')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Add Expense
              </button>
            </div>
          </div>
        </div>

        {/* Profit Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600 mb-2">Profit</p>
              <p className={`${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{Math.abs(profit).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Income and Expenses Split Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-96">
          {/* Income Section */}
          <div className="bg-white rounded-lg shadow-lg flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-gray-900">Income</h2>
            </div>
            
            {/* Income Top Half - Total Income with Icon */}
            <div className="p-6 border-b border-gray-200 bg-green-50 flex-shrink-0">
              <div className="flex flex-col items-center justify-center">
                <div className="bg-green-100 p-4 rounded-full mb-4">
                  <Wallet className="w-10 h-10 text-green-600" />
                </div>
                <p className="text-gray-700 mb-2">Total Income</p>
                {incomeLoading || loanIncomeLoading ? (
                  <p className="text-green-600 text-lg">Loading...</p>
                ) : (
                  <p className="text-green-600 text-lg">₹{(totalIncome + totalLoanIncome).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Income Bottom Half - Orders & Loan Disbursements List */}
            <div className="p-6 flex flex-col flex-grow overflow-hidden">
              {incomeLoading && loanIncomeLoading ? (
                <div className="flex justify-center items-center flex-grow">
                  <p className="text-gray-500">Loading income...</p>
                </div>
              ) : orders.length === 0 && loanDisbursements.length === 0 ? (
                <div className="flex justify-center items-center flex-grow">
                  <p className="text-gray-500">No income found for this period</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto flex-grow">
                  {/* Orders Section */}
                  {orders.length > 0 && (
                    <>
                      <div className="border-b border-gray-200 pb-2">
                        <h4 className="text-sm font-semibold text-gray-700">🧾 Orders (₹{totalIncome.toLocaleString()})</h4>
                      </div>
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          onClick={() => goTo(`/admin/orders/${order.id}`)}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors flex-shrink-0"
                        >
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">Name</p>
                              <p className="text-gray-900">{order.customers?.name || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Bricks</p>
                              <p className="text-gray-900">{order.brick_quantity.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Revenue</p>
                              <p className="text-gray-900">₹{(order.final_price || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Status</p>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                                order.payment_status === 'FULLY_PAID'
                                  ? 'bg-green-100 text-green-800'
                                  : order.payment_status === 'PARTIALLY_PAID'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {order.payment_status === 'FULLY_PAID' ? 'Fully Paid' : order.payment_status === 'PARTIALLY_PAID' ? 'Partially Paid' : 'Not Paid'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Loan Disbursements Section */}
                  {loanDisbursements.length > 0 && (
                    <>
                      <div className="border-b border-gray-200 pb-2 mt-4">
                        <h4 className="text-sm font-semibold text-gray-700">🏦 Loan Disbursements (₹{totalLoanIncome.toLocaleString()})</h4>
                      </div>
                      {loanDisbursements.map((disbursement) => (
                        <div
                          key={disbursement.id}
                          className="border border-purple-200 bg-purple-50 rounded-lg p-4 hover:bg-purple-100 transition-colors flex-shrink-0"
                        >
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">Lender</p>
                              <p className="text-gray-900">{disbursement.loans?.lender_name || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Loan Type</p>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                                disbursement.loans?.loan_type === 'GIVEN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {disbursement.loans?.loan_type === 'GIVEN' ? 'Given' : 'Taken'}
                              </span>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Amount</p>
                              <p className="text-purple-700 font-semibold">₹{(disbursement.amount || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Date</p>
                              <p className="text-gray-900">{new Date(disbursement.transaction_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          {disbursement.notes && (
                            <div className="mt-2 pt-2 border-t border-purple-200">
                              <p className="text-gray-500 text-xs">Notes: {disbursement.notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Expenses Section */}
          <div className="bg-white rounded-lg shadow-lg flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-gray-900">Expenses</h2>
            </div>

            {/* Expense Type Filter */}
            <div className="px-6 pt-4 pb-2 bg-red-50 border-b border-gray-200 flex-shrink-0">
              <label className="block text-gray-700 text-sm mb-2">Filter by Expense Type</label>
              <select
                value={selectedExpenseTypeId}
                onChange={(e) => {
                  setSelectedExpenseTypeId(e.target.value);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="Overall">Overall</option>
                <option value="Procurement">📦 Procurement</option>
                <option value="LoanInterest">💰 Loan Interest</option>
                <option value="Salary">👷 Salary</option>
                {expenseTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Expenses Top Half - Pie Chart */}
            <div className="p-6 border-b border-gray-200 bg-red-50 flex-shrink-0">
              <div className="flex flex-col items-center">
                {expensesLoading || loanInterestLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-gray-500">Loading chart...</p>
                  </div>
                ) : pieChartData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-gray-500">No expenses for this period</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₹${(value as number).toLocaleString()}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="text-gray-700 mt-4 mb-2">Total Expenses</p>
                    <p className="text-red-600 text-lg">₹{(totalExpenses + totalProcurements + totalLoanInterest + totalSalary).toLocaleString()}</p>
                  </>
                )}
              </div>
            </div>

            {/* Expenses Bottom Half - Expenses List */}
            <div className="p-6 flex flex-col flex-grow overflow-hidden">
              {expensesLoading || loanInterestLoading ? (
                <div className="flex justify-center items-center flex-grow">
                  <p className="text-gray-500">Loading expenses...</p>
                </div>
              ) : expenses.length === 0 && procurements.length === 0 && loanInterestEntries.length === 0 && salaryEntries.length === 0 ? (
                <div className="flex justify-center items-center flex-grow">
                  <p className="text-gray-500">No expenses found for this period</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto flex-grow">
                  {/* Manual Expenses Section */}
                  {expenses.length > 0 && (
                    <>
                      <div className="border-b border-gray-200 pb-2">
                        <h4 className="text-sm font-semibold text-gray-700">🏢 Manual Expenses (₹{totalExpenses.toLocaleString()})</h4>
                      </div>
                      {expenses.map((expense: any) => (
                        <div
                          key={expense.id}
                          onClick={() => goTo(`/admin/accounts/expense/${expense.id}`)}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors flex-shrink-0"
                        >
                          <div className="grid grid-cols-5 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">Type</p>
                              <p className="text-gray-900 truncate">{expense.expense_types?.name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Subtype</p>
                              <p className="text-gray-900 truncate">{expense.expense_subtypes?.name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Comments</p>
                              <p className="text-gray-900 truncate">{expense.comments || '-'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Amount</p>
                              <p className="text-gray-900">₹{(expense.amount || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Payment Mode</p>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                                expense.payment_mode === 'CASH'
                                  ? 'bg-gray-100 text-gray-800'
                                  : expense.payment_mode === 'UPI'
                                  ? 'bg-blue-100 text-blue-800'
                                  : expense.payment_mode === 'BANK'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {expense.payment_mode === 'CASH' ? 'Cash' : expense.payment_mode === 'UPI' ? 'UPI' : expense.payment_mode === 'BANK' ? 'Bank' : 'Cheque'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Procurements Section */}
                  {procurements.length > 0 && (
                    <>
                      <div className="border-b border-gray-200 pb-2 mt-4">
                        <h4 className="text-sm font-semibold text-gray-700">📦 Procurements (₹{totalProcurements.toLocaleString()})</h4>
                      </div>
                      {procurements.map((procurement: any) => (
                        <div
                          key={procurement.id}
                          className="border border-blue-200 bg-blue-50 rounded-lg p-4 hover:bg-blue-100 transition-colors flex-shrink-0"
                        >
                          <div className="grid grid-cols-5 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">Date</p>
                              <p className="text-gray-900">{new Date(procurement.date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Material</p>
                              <p className="text-gray-900 truncate">{procurement.materials?.[0]?.name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Vendor</p>
                              <p className="text-gray-900 truncate">{procurement.vendors?.[0]?.name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Amount</p>
                              <p className="text-gray-900 font-semibold">₹{(procurement.total_price || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Status</p>
                              <span className="inline-block px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                                Approved
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Loan Interest Section */}
                  {loanInterestEntries.length > 0 && (
                    <>
                      <div className="border-b border-gray-200 pb-2 mt-4">
                        <h4 className="text-sm font-semibold text-gray-700">💰 Loan Interest (₹{totalLoanInterest.toLocaleString()})</h4>
                      </div>
                      {loanInterestEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="border border-amber-200 bg-amber-50 rounded-lg p-4 hover:bg-amber-100 transition-colors flex-shrink-0"
                        >
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">Lender</p>
                              <p className="text-gray-900">{entry.loans?.lender_name || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Loan Type</p>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                                entry.loans?.loan_type === 'GIVEN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {entry.loans?.loan_type === 'GIVEN' ? 'Given' : 'Taken'}
                              </span>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Amount</p>
                              <p className="text-amber-700 font-semibold">₹{(entry.amount || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Date</p>
                              <p className="text-gray-900">{new Date(entry.transaction_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          {entry.notes && (
                            <div className="mt-2 pt-2 border-t border-amber-200">
                              <p className="text-gray-500 text-xs">Notes: {entry.notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Salary Section */}
                  {salaryEntries.length > 0 && (
                    <>
                      <div className="border-b border-gray-200 pb-2 mt-4">
                        <h4 className="text-sm font-semibold text-gray-700">👷 Salary (₹{totalSalary.toLocaleString()})</h4>
                      </div>
                      {salaryEntries.map((entry: any) => (
                        <div
                          key={entry.id}
                          className="border border-teal-200 bg-teal-50 rounded-lg px-4 py-2 hover:bg-teal-100 transition-colors flex-shrink-0"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 min-w-0">
                              <p className="text-gray-500">Employee:</p>
                              <p className="text-gray-900 truncate">{entry.employees?.name || 'Unknown'}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-gray-500">Amount:</p>
                              <p className="text-teal-700 font-semibold">₹{(entry.amount || 0).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-gray-500">Date:</p>
                              <p className="text-gray-900">{new Date(entry.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          {entry.notes && (
                            <p className="text-gray-400 text-xs mt-1">Notes: {entry.notes}</p>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Popup - Income */}
      {showIncomeError && incomeError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={closeIncomeError}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close error"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <X className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Income Data</h3>
                <p className="text-gray-600 text-sm mb-4">{incomeError}</p>
                <button
                  onClick={closeIncomeError}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Popup - Expenses */}
      {showExpensesError && expensesError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={closeExpensesError}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close error"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <X className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Expenses Data</h3>
                <p className="text-gray-600 text-sm mb-4">{expensesError}</p>
                <button
                  onClick={closeExpensesError}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Popup - Loan Income */}
      {showLoanIncomeError && loanIncomeError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={closeLoanIncomeError}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close error"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <X className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Loan Income Data</h3>
                <p className="text-gray-600 text-sm mb-4">{loanIncomeError}</p>
                <button
                  onClick={closeLoanIncomeError}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Popup - Loan Interest */}
      {showLoanInterestError && loanInterestError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={closeLoanInterestError}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close error"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <X className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Loan Interest Data</h3>
                <p className="text-gray-600 text-sm mb-4">{loanInterestError}</p>
                <button
                  onClick={closeLoanInterestError}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Range Modal */}
      {showCustomRangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Close Icon */}
            <button
              onClick={handleCloseCustomRangeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-6">Custom Date Range</h2>

            <div className="space-y-4">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-gray-700 mb-2">
                  Start <span className="text-red-600">*</span>
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="endDate" className="block text-gray-700 mb-2">
                  End <span className="text-red-600">*</span>
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={handleCloseCustomRangeModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCustomRange}
                  disabled={!customStartDate || !customEndDate}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    customStartDate && customEndDate
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}