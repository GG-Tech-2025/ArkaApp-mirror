import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Wallet, X, Trash2, ChevronDown, ChevronUp, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useAccountsIncome } from '../../../hooks/useAccountsIncome';
import { useAccountsExpenses } from '../../../hooks/useAccountsExpenses';
import { useAccountsLoanIncome } from '../../../hooks/useAccountsLoanIncome';
import { useAccountsLoanInterest } from '../../../hooks/useAccountsLoanInterest';
import { deleteExpense } from '../../../../services/middleware.service';
import { Popup } from '../../../../components/Popup';

type FilterType = 'Current Month' | 'Last month' | 'Last year' | 'Custom range';

export function AccountsManagementScreen() {
  const { goBack, goTo } = useAdminNavigation();
  const [filterType, setFilterType] = useState<FilterType>('Current Month');
  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('Overall');
  const [activeTab, setActiveTab] = useState<'income' | 'expenses'>('income');

  // Delete expense state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorPopupMessage, setErrorPopupMessage] = useState('');

  // ─── Income filters ───
  const [incomeSearch, setIncomeSearch] = useState('');
  const [incomePaymentFilter, setIncomePaymentFilter] = useState<'All' | 'FULLY_PAID' | 'PARTIALLY_PAID' | 'NOT_PAID'>('All');
  const [ordersShowCount, setOrdersShowCount] = useState(10);
  const [loanDisbShowCount, setLoanDisbShowCount] = useState(10);

  // ─── Expense section collapse & pagination ───
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [manualExpShowCount, setManualExpShowCount] = useState(10);
  const [procShowCount, setProcShowCount] = useState(10);
  const [loanIntShowCount, setLoanIntShowCount] = useState(10);
  const [salaryShowCount, setSalaryShowCount] = useState(10);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

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
    refetchExpenses,
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

  // ─── Derived: filtered orders ───
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch = incomeSearch === '' || (order.customers?.name || '').toLowerCase().includes(incomeSearch.toLowerCase());
      const matchesPayment = incomePaymentFilter === 'All' || order.payment_status === incomePaymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [orders, incomeSearch, incomePaymentFilter]);

  // ─── Derived: adaptive chart data (group small slices into "Others") ───
  const adaptedChartData = useMemo(() => {
    if (pieChartData.length === 0) return [];
    const total = pieChartData.reduce((sum, d) => sum + d.value, 0);
    const THRESHOLD = 0.05; // 5%
    const main = pieChartData.filter((d) => d.value / total >= THRESHOLD);
    const others = pieChartData.filter((d) => d.value / total < THRESHOLD);
    const othersTotal = others.reduce((sum, d) => sum + d.value, 0);
    const result = [...main];
    if (othersTotal > 0) result.push({ name: 'Others', value: othersTotal });
    return result;
  }, [pieChartData]);

  const useBarChart = adaptedChartData.length > 5;

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

  // ─── Delete Expense Handlers ───
  const handleOpenDeleteConfirm = (expenseId: string) => {
    setDeletingExpenseId(expenseId);
    setShowDeleteConfirm(true);
  };

  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeletingExpenseId(null);
  };

  const handleConfirmDeleteExpense = async () => {
    if (!deletingExpenseId) return;

    try {
      setDeletingExpense(true);
      await deleteExpense(deletingExpenseId);

      setShowDeleteConfirm(false);
      setDeletingExpenseId(null);

      // Refresh expenses data so totals and profit recalculate
      await refetchExpenses();

      setSuccessMessage('Expense deleted successfully');
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Failed to delete expense:', err);
      setShowDeleteConfirm(false);
      setDeletingExpenseId(null);
      setErrorPopupMessage('Failed to delete expense. Please try again.');
      setShowErrorPopup(true);
    } finally {
      setDeletingExpense(false);
    }
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-xs text-gray-500 mb-1">Total Income</p>
            <p className="text-green-600 font-semibold text-lg">₹{(totalIncome + totalLoanIncome).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
            <p className="text-red-600 font-semibold text-lg">₹{(totalExpenses + totalProcurements + totalLoanInterest + totalSalary).toLocaleString()}</p>
          </div>
          <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${profit >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
            <p className="text-xs text-gray-500 mb-1">Net Profit</p>
            <div className="flex items-center gap-1">
              {profit >= 0
                ? <TrendingUp className="w-4 h-4 text-blue-500" />
                : <TrendingDown className="w-4 h-4 text-orange-500" />}
              <p className={`font-semibold text-lg ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {profit < 0 ? '-' : ''}₹{Math.abs(profit).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
            <p className="text-xs text-gray-500 mb-1">Loan Interest</p>
            <p className="text-amber-600 font-semibold text-lg">₹{totalLoanInterest.toLocaleString()}</p>
          </div>
        </div>

        {/* Income / Expenses Tabbed Container */}
        <div className="bg-white rounded-lg shadow-lg flex flex-col">

          {/* Tab Bar */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('income')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'income'
                  ? 'border-green-500 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              💰 Income
              {!incomeLoading && !loanIncomeLoading && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ₹{(totalIncome + totalLoanIncome).toLocaleString()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'expenses'
                  ? 'border-red-500 text-red-700 bg-red-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              📉 Expenses
              {!expensesLoading && !loanInterestLoading && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ₹{(totalExpenses + totalProcurements + totalLoanInterest + totalSalary).toLocaleString()}
                </span>
              )}
            </button>
          </div>

          {/* ══════════ INCOME TAB ══════════ */}
          {activeTab === 'income' && (
            <div className="flex flex-col">

              {/* ── Income summary (same as MetricsScreen) ── */}
              <div className="px-6 pt-5 pb-4 space-y-3 border-b border-gray-100">
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <Wallet className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">Orders</p>
                        <p className="text-xs text-gray-500">Customer sales income</p>
                      </div>
                    </div>
                    <p className="text-green-600 font-semibold">₹{totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">Loan Disbursements</p>
                        <p className="text-xs text-gray-500">Loans issued to employees</p>
                      </div>
                    </div>
                    <p className="text-purple-600 font-semibold">₹{totalLoanIncome.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-5 py-4 bg-green-600 rounded-xl">
                  <p className="text-white font-semibold">Total Income</p>
                  <p className="text-white font-bold text-lg">₹{(totalIncome + totalLoanIncome).toLocaleString()}</p>
                </div>
              </div>

              {/* Income filters */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by customer name..."
                      value={incomeSearch}
                      onChange={(e) => { setIncomeSearch(e.target.value); setOrdersShowCount(10); }}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="flex gap-1 flex-wrap items-center">
                    {(['All', 'FULLY_PAID', 'PARTIALLY_PAID', 'NOT_PAID'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => { setIncomePaymentFilter(status); setOrdersShowCount(10); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          incomePaymentFilter === status
                            ? 'bg-green-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {status === 'All' ? 'All' : status === 'FULLY_PAID' ? '✅ Paid' : status === 'PARTIALLY_PAID' ? '🔶 Partial' : '❌ Unpaid'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Income content */}
              <div className="p-4 space-y-3 max-h-[680px] overflow-y-auto">
                {incomeLoading && loanIncomeLoading ? (
                  <p className="text-center text-gray-500 py-8">Loading income...</p>
                ) : orders.length === 0 && loanDisbursements.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No income found for this period</p>
                ) : (
                  <>
                    {/* ── Orders collapsible ── */}
                    {orders.length > 0 && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection('orders')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">🧾 Orders</span>
                            <span className="bg-green-200 text-green-800 text-xs px-2 py-0.5 rounded-full">{filteredOrders.length}</span>
                            <span className="text-sm font-semibold text-green-700">₹{totalIncome.toLocaleString()}</span>
                          </div>
                          {collapsedSections.has('orders') ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                        </button>
                        {!collapsedSections.has('orders') && (
                          <div className="divide-y divide-gray-100">
                            {/* Column headers */}
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                              <div className="col-span-4">Customer</div>
                              <div className="col-span-2 text-right">Bricks</div>
                              <div className="col-span-3 text-right">Revenue</div>
                              <div className="col-span-3 text-right">Status</div>
                            </div>
                            {filteredOrders.length === 0 && (
                              <p className="text-sm text-gray-500 text-center py-4">No orders match the current filter.</p>
                            )}
                            {filteredOrders.slice(0, ordersShowCount).map((order) => (
                              <div
                                key={order.id}
                                onClick={() => goTo(`/admin/orders/${order.id}`)}
                                className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors items-center text-sm"
                              >
                                <div className="col-span-4 font-medium text-gray-900 truncate">{order.customers?.name || 'N/A'}</div>
                                <div className="col-span-2 text-right text-gray-600">{order.brick_quantity.toLocaleString()}</div>
                                <div className="col-span-3 text-right font-semibold text-green-700">₹{(order.final_price || 0).toLocaleString()}</div>
                                <div className="col-span-3 text-right">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                                    order.payment_status === 'FULLY_PAID' ? 'bg-green-100 text-green-800'
                                    : order.payment_status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                  }`}>
                                    {order.payment_status === 'FULLY_PAID' ? 'Paid' : order.payment_status === 'PARTIALLY_PAID' ? 'Partial' : 'Unpaid'}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {filteredOrders.length > ordersShowCount && (
                              <div className="px-4 py-2">
                                <button
                                  onClick={() => setOrdersShowCount((c) => c + 10)}
                                  className="w-full text-center text-sm text-green-600 hover:text-green-800 py-2 border border-dashed border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                                >
                                  Show more ({filteredOrders.length - ordersShowCount} remaining)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Loan Disbursements collapsible ── */}
                    {loanDisbursements.length > 0 && (
                      <div className="border border-purple-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection('loanDisb')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">🏦 Loan Disbursements</span>
                            <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full">{loanDisbursements.length}</span>
                            <span className="text-sm font-semibold text-purple-700">₹{totalLoanIncome.toLocaleString()}</span>
                          </div>
                          {collapsedSections.has('loanDisb') ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                        </button>
                        {!collapsedSections.has('loanDisb') && (
                          <div className="divide-y divide-purple-100">
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                              <div className="col-span-4">Lender</div>
                              <div className="col-span-2">Type</div>
                              <div className="col-span-3 text-right">Amount</div>
                              <div className="col-span-3 text-right">Date</div>
                            </div>
                            {loanDisbursements.slice(0, loanDisbShowCount).map((d) => (
                              <div key={d.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-purple-50 transition-colors items-center text-sm">
                                <div className="col-span-4 font-medium text-gray-900 truncate">{d.loans?.lender_name || 'N/A'}</div>
                                <div className="col-span-2">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${d.loans?.loan_type === 'GIVEN' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                                    {d.loans?.loan_type === 'GIVEN' ? 'Given' : 'Taken'}
                                  </span>
                                </div>
                                <div className="col-span-3 text-right font-semibold text-purple-700">₹{(d.amount || 0).toLocaleString()}</div>
                                <div className="col-span-3 text-right text-gray-500">{new Date(d.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                              </div>
                            ))}
                            {loanDisbursements.length > loanDisbShowCount && (
                              <div className="px-4 py-2">
                                <button
                                  onClick={() => setLoanDisbShowCount((c) => c + 10)}
                                  className="w-full text-center text-sm text-purple-600 hover:text-purple-800 py-2 border border-dashed border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
                                >
                                  Show more ({loanDisbursements.length - loanDisbShowCount} remaining)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══════════ EXPENSES TAB ══════════ */}
          {activeTab === 'expenses' && (
            <div className="flex flex-col">
              {/* Expense filters */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <select
                  value={selectedExpenseTypeId}
                  onChange={(e) => setSelectedExpenseTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none"
                >
                  <option value="Overall">All Types</option>
                  <option value="Procurement">📦 Procurement</option>
                  <option value="LoanInterest">💰 Loan Interest</option>
                  <option value="Salary">👷 Salary</option>
                  {expenseTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>

                {/* Chart — below the dropdown */}
                {adaptedChartData.length > 0 && !expensesLoading && !loanInterestLoading && (
                  <div className="mt-4">
                    {useBarChart ? (
                      <ResponsiveContainer width="100%" height={adaptedChartData.length * 32 + 24}>
                        <BarChart data={adaptedChartData} layout="vertical" margin={{ left: 4, right: 16, top: 2, bottom: 2 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => `₹${(v as number).toLocaleString()}`} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value) => `₹${(value as number).toLocaleString()}`} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {adaptedChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={adaptedChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value">
                            {adaptedChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `₹${(value as number).toLocaleString()}`} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                    <p className="text-center text-xs text-gray-500 mt-1">
                      Total: <span className="font-semibold text-red-600">₹{(totalExpenses + totalProcurements + totalLoanInterest + totalSalary).toLocaleString()}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Expense content */}
              <div className="p-4 space-y-3 max-h-[680px] overflow-y-auto">
                {expensesLoading || loanInterestLoading ? (
                  <p className="text-center text-gray-500 py-8">Loading expenses...</p>
                ) : expenses.length === 0 && procurements.length === 0 && loanInterestEntries.length === 0 && salaryEntries.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No expenses found for this period</p>
                ) : (
                  <>
                    {/* ── Manual Expenses ── */}
                    {expenses.length > 0 && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection('manual')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">🏢 Manual Expenses</span>
                            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">{expenses.length}</span>
                            <span className="text-sm font-semibold text-red-600">₹{totalExpenses.toLocaleString()}</span>
                          </div>
                          {collapsedSections.has('manual') ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                        </button>
                        {!collapsedSections.has('manual') && (
                          <div className="divide-y divide-gray-100">
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                              <div className="col-span-2">Date</div>
                              <div className="col-span-3">Type › Sub</div>
                              <div className="col-span-3">Comments</div>
                              <div className="col-span-2 text-right">Amount</div>
                              <div className="col-span-1 text-center">Mode</div>
                              <div className="col-span-1"></div>
                            </div>
                            {expenses.slice(0, manualExpShowCount).map((expense: any) => (
                              <div key={expense.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors items-center text-sm">
                                <div className="col-span-2 text-gray-500 text-xs">{expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</div>
                                <div className="col-span-3 truncate">
                                  <span className="text-gray-900">{expense.expense_types?.name || '-'}</span>
                                  {expense.expense_subtypes?.name && <span className="text-gray-400"> › {expense.expense_subtypes.name}</span>}
                                </div>
                                <div className="col-span-3 text-gray-500 truncate text-xs">{expense.comments || '—'}</div>
                                <div className="col-span-2 text-right font-semibold text-red-700">₹{(expense.amount || 0).toLocaleString()}</div>
                                <div className="col-span-1 text-center">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                                    expense.payment_mode === 'CASH' ? 'bg-gray-100 text-gray-700'
                                    : expense.payment_mode === 'UPI' ? 'bg-blue-100 text-blue-700'
                                    : expense.payment_mode === 'BANK' ? 'bg-green-100 text-green-700'
                                    : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {expense.payment_mode === 'CASH' ? 'Cash' : expense.payment_mode === 'UPI' ? 'UPI' : expense.payment_mode === 'BANK' ? 'Bank' : 'Cheq'}
                                  </span>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <button onClick={() => handleOpenDeleteConfirm(expense.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" aria-label="Delete">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {expenses.length > manualExpShowCount && (
                              <div className="px-4 py-2">
                                <button onClick={() => setManualExpShowCount((c) => c + 10)} className="w-full text-center text-sm text-gray-600 py-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                  Show more ({expenses.length - manualExpShowCount} remaining)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Procurements ── */}
                    {procurements.length > 0 && (
                      <div className="border border-blue-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection('proc')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">📦 Procurements</span>
                            <span className="bg-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded-full">{procurements.length}</span>
                            <span className="text-sm font-semibold text-blue-700">₹{totalProcurements.toLocaleString()}</span>
                          </div>
                          {collapsedSections.has('proc') ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                        </button>
                        {!collapsedSections.has('proc') && (
                          <div className="divide-y divide-blue-100">
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                              <div className="col-span-2">Date</div>
                              <div className="col-span-4">Material</div>
                              <div className="col-span-3">Vendor</div>
                              <div className="col-span-3 text-right">Amount</div>
                            </div>
                            {procurements.slice(0, procShowCount).map((p: any) => (
                              <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-blue-50 transition-colors items-center text-sm">
                                <div className="col-span-2 text-gray-500 text-xs">{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                                <div className="col-span-4 text-gray-900 truncate">{p.materials?.[0]?.name || '-'}</div>
                                <div className="col-span-3 text-gray-500 truncate">{p.vendors?.[0]?.name || '-'}</div>
                                <div className="col-span-3 text-right font-semibold text-blue-700">₹{(p.total_price || 0).toLocaleString()}</div>
                              </div>
                            ))}
                            {procurements.length > procShowCount && (
                              <div className="px-4 py-2">
                                <button onClick={() => setProcShowCount((c) => c + 10)} className="w-full text-center text-sm text-blue-600 py-2 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
                                  Show more ({procurements.length - procShowCount} remaining)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Loan Interest ── */}
                    {loanInterestEntries.length > 0 && (
                      <div className="border border-amber-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection('loanInt')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">💰 Loan Interest</span>
                            <span className="bg-amber-200 text-amber-700 text-xs px-2 py-0.5 rounded-full">{loanInterestEntries.length}</span>
                            <span className="text-sm font-semibold text-amber-700">₹{totalLoanInterest.toLocaleString()}</span>
                          </div>
                          {collapsedSections.has('loanInt') ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                        </button>
                        {!collapsedSections.has('loanInt') && (
                          <div className="divide-y divide-amber-100">
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                              <div className="col-span-5">Lender</div>
                              <div className="col-span-2">Type</div>
                              <div className="col-span-3 text-right">Amount</div>
                              <div className="col-span-2 text-right">Date</div>
                            </div>
                            {loanInterestEntries.slice(0, loanIntShowCount).map((entry) => (
                              <div key={entry.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-amber-50 transition-colors items-center text-sm">
                                <div className="col-span-5 text-gray-900 truncate">{entry.loans?.lender_name || 'N/A'}</div>
                                <div className="col-span-2">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${entry.loans?.loan_type === 'GIVEN' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                                    {entry.loans?.loan_type === 'GIVEN' ? 'Given' : 'Taken'}
                                  </span>
                                </div>
                                <div className="col-span-3 text-right font-semibold text-amber-700">₹{(entry.amount || 0).toLocaleString()}</div>
                                <div className="col-span-2 text-right text-gray-500 text-xs">{new Date(entry.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                              </div>
                            ))}
                            {loanInterestEntries.length > loanIntShowCount && (
                              <div className="px-4 py-2">
                                <button onClick={() => setLoanIntShowCount((c) => c + 10)} className="w-full text-center text-sm text-amber-600 py-2 border border-dashed border-amber-300 rounded-lg hover:bg-amber-50 transition-colors">
                                  Show more ({loanInterestEntries.length - loanIntShowCount} remaining)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Salary ── */}
                    {salaryEntries.length > 0 && (
                      <div className="border border-teal-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection('salary')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-teal-50 hover:bg-teal-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">👷 Salary</span>
                            <span className="bg-teal-200 text-teal-700 text-xs px-2 py-0.5 rounded-full">{salaryEntries.length}</span>
                            <span className="text-sm font-semibold text-teal-700">₹{totalSalary.toLocaleString()}</span>
                          </div>
                          {collapsedSections.has('salary') ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                        </button>
                        {!collapsedSections.has('salary') && (
                          <div className="divide-y divide-teal-100">
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                              <div className="col-span-6">Employee</div>
                              <div className="col-span-3 text-right">Amount</div>
                              <div className="col-span-3 text-right">Date</div>
                            </div>
                            {salaryEntries.slice(0, salaryShowCount).map((entry: any) => (
                              <div key={entry.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-teal-50 transition-colors items-center text-sm">
                                <div className="col-span-6 text-gray-900 truncate">{entry.employees?.name || 'Unknown'}</div>
                                <div className="col-span-3 text-right font-semibold text-teal-700">₹{(entry.amount || 0).toLocaleString()}</div>
                                <div className="col-span-3 text-right text-gray-500 text-xs">{new Date(entry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                              </div>
                            ))}
                            {salaryEntries.length > salaryShowCount && (
                              <div className="px-4 py-2">
                                <button onClick={() => setSalaryShowCount((c) => c + 10)} className="w-full text-center text-sm text-teal-600 py-2 border border-dashed border-teal-300 rounded-lg hover:bg-teal-50 transition-colors">
                                  Show more ({salaryEntries.length - salaryShowCount} remaining)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
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

      {/* Delete Expense Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={handleCloseDeleteConfirm}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-4">Delete Expense</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this expense? The amount will be
              added back to the account from which it was paid. This action
              cannot be undone.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseDeleteConfirm}
                disabled={deletingExpense}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteExpense}
                disabled={deletingExpense}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  deletingExpense
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {deletingExpense ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Success"
          message={successMessage}
          onClose={() => setShowSuccessPopup(false)}
          type="success"
        />
      )}

      {/* Error Popup */}
      {showErrorPopup && (
        <Popup
          title="Error"
          message={errorPopupMessage}
          onClose={() => setShowErrorPopup(false)}
          type="error"
        />
      )}
    </div>
  );
}