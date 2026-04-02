import { useState } from 'react';
import { ArrowLeft, Wallet, X, Droplets, Mountain, Sparkles, Hammer, Wind, Square } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAdminNavigation } from '../hooks/useAdminNavigation';
import { useAccountsIncome } from '../hooks/useAccountsIncome';
import { useAccountsExpenses } from '../hooks/useAccountsExpenses';
import { useAccountsLoanInterest } from '../hooks/useAccountsLoanInterest';
import { useAllInventoryStock } from '../hooks/useInventoryStock';
import { useProductInventory } from '../hooks/useProductInventory';
import { useProductionByDateRange } from '../hooks/useProductionByDateRange';


type FilterType = 'Current Month' | 'Last month' | 'Last year' | 'Custom range';

export function MetricsScreen() {
  const { goBack } = useAdminNavigation();
  const [filterType, setFilterType] = useState<FilterType>('Current Month');
  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('Overall');

  // Fetch income data based on filter
  const {
    loading: incomeLoading,
    totalIncome,
  } = useAccountsIncome(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined
  );

  // Fetch loan interest expenses based on filter
  const {
    loading: loanInterestLoading,
    totalLoanInterest,
  } = useAccountsLoanInterest(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined
  );

  // Fetch expenses data based on filter and selected expense type
  const {
    expenseTypes,
    loading: expensesLoading,
    totalExpenses,
    totalProcurements,
    totalSalary,
    pieChartData,
  } = useAccountsExpenses(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined,
    selectedExpenseTypeId,
    totalLoanInterest
  );

  // Calculate profit (includes procurements, loan interest, and salary)
  const profit = totalIncome - totalExpenses - totalProcurements - totalLoanInterest - totalSalary;

  // Fetch production data based on filter
  const {
    loading: productionLoading,
    totals: productionTotals,
    graphData: productionGraphData,
  } = useProductionByDateRange(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined
  );

  // Fetch inventory stock data (not filter-dependent — always current snapshot)
  const { stock: inventoryStock, loading: stockLoading } = useAllInventoryStock();
  const { inventory: productInventory, loading: bricksLoading } = useProductInventory();

  const inventoryLoading = stockLoading || bricksLoading;

  // Build inventory metrics from database (same logic as InventoryManagementScreen)
  const buildInventoryMetrics = () => {
    const metrics = {
      bricksReady: productInventory?.quantity ?? 0,
      wetAshKg: 0,
      marblePowderKg: 0,
      crusherPowderKg: 0,
      flyAshKg: 0,
      cementKg: 0,
    };

    inventoryStock.forEach((item) => {
      const materialName = (item.materials as any)?.name?.toLowerCase() || '';

      if (materialName.includes('wet ash')) {
        metrics.wetAshKg = item.quantity;
      } else if (materialName.includes('marble')) {
        metrics.marblePowderKg = item.quantity;
      } else if (materialName.includes('crusher')) {
        metrics.crusherPowderKg = item.quantity;
      } else if (materialName.includes('fly ash')) {
        metrics.flyAshKg = item.quantity;
      } else if (materialName.includes('cement')) {
        metrics.cementKg = item.quantity;
      }
    });

    return metrics;
  };

  const INVENTORY_METRICS = buildInventoryMetrics();

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  // Calculate number of days in the selected range
  const getDaysInRange = (): number => {
    let start: Date;
    let end: Date;

    switch (filterType) {
      case 'Current Month': {
        const today = new Date();
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      }
      case 'Last month': {
        const today = new Date();
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      }
      case 'Last year': {
        const year = new Date().getFullYear() - 1;
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31);
        break;
      }
      case 'Custom range': {
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          end = new Date(customEndDate);
        } else {
          return 1;
        }
        break;
      }
      default:
        return 1;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
    return Math.max(diffDays, 1);
  };

  const DAILY_MAX_BRICKS = 15000;
  const MAX_BRICKS = DAILY_MAX_BRICKS * getDaysInRange();
  const CIRCLE_CIRCUMFERENCE = 440;
  const bricksProgress = productionTotals.totalBricks > 0
    ? Math.min(productionTotals.totalBricks, MAX_BRICKS) / MAX_BRICKS
    : 0;
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - bricksProgress);

  const handleFilterChange = (value: FilterType) => {
    if (value === 'Custom range') {
      setShowCustomRangeModal(true);
    } else {
      setFilterType(value);
      // Reset expense type filter to "Overall" when date filter changes
      setSelectedExpenseTypeId('Overall');
    }
  };

  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      setFilterType('Custom range');
      setShowCustomRangeModal(false);
      // Reset expense type filter to "Overall" when custom range is applied
      setSelectedExpenseTypeId('Overall');
    }
  };

  const handleCloseCustomRangeModal = () => {
    setShowCustomRangeModal(false);
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
              <h1 className="text-gray-900">Business Metrics</h1>
              <p className="text-gray-600 mt-1">Comprehensive performance overview</p>
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
            </div>
          </div>
        </div>

        {/* Section 1: Income-Expense */}
        <div className="mb-8">
          <h2 className="text-gray-900 mb-4">Income & Expenses</h2>
          
          {/* Profit Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Section */}
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-gray-900">Income</h3>
              </div>
              
              {/* Income - Total Income with Icon */}
              <div className="p-6 bg-green-50">
                <div className="flex flex-col items-center justify-center">
                  <div className="bg-green-100 p-4 rounded-full mb-4">
                    <Wallet className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-gray-700 mb-2">Total Income</p>
                  {incomeLoading ? (
                    <p className="text-green-600 text-lg">Loading...</p>
                  ) : (
                    <p className="text-green-600 text-lg">₹{totalIncome.toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-gray-900">Expenses</h3>
              </div>

              {/* Expense Type Filter */}
              <div className="px-6 pt-4 pb-2 bg-red-50 border-b border-gray-200">
                <label className="block text-gray-700 text-sm mb-2">Filter by Expense Type</label>
                <select
                  value={selectedExpenseTypeId}
                  onChange={(e) => setSelectedExpenseTypeId(e.target.value)}
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

              {/* Expenses - Pie Chart */}
              <div className="p-6 bg-red-50">
                <div className="flex flex-col items-center">
                  {(expensesLoading || loanInterestLoading) ? (
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
                            {pieChartData.map((_entry, index) => (
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
            </div>
          </div>
        </div>

        {/* Section 2: Production Performance */}
        <div className="mb-8">
          <h2 className="text-gray-900 mb-4">Production Performance</h2>
          
          {productionLoading ? (
            <div className="bg-white rounded-lg shadow-md p-6 flex justify-center">
              <p className="text-gray-500">Loading production data...</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Production Graph */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-gray-900 mb-4">Production Trend</h2>
              {productionGraphData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-gray-500">No production data for this period</p>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={productionGraphData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="bricks" 
                    stroke="#3B82F6" 
                    strokeWidth={2} 
                    name="Bricks Produced"
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>

            {/* Total Production with Progress Circle */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-gray-900 mb-6">Total Production</h2>
              <div className="flex flex-col lg:flex-row items-center gap-6">
                {/* Static Progress Circle */}
                <div className="flex-shrink-0">
                  <div className="relative w-40 h-40">
                    {/* Static progress ring */}
                    <svg className="w-40 h-40 transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#E5E7EB"
                        strokeWidth="12"
                        fill="none"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#10B981"
                        strokeWidth="12"
                        fill="none"
                      strokeDasharray={CIRCLE_CIRCUMFERENCE}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center content */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-gray-900 text-2xl">{productionTotals.totalBricks.toLocaleString()}</p>
                      <p className="text-gray-600 text-xs">/ {MAX_BRICKS.toLocaleString()}</p>
                        <p className="text-gray-600 text-sm">Bricks</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raw Materials List */}
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="flex justify-between w-full">
                      <span className="text-gray-700">Round:</span>
                      <span className="text-gray-900">{productionTotals.totalRound}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="flex justify-between w-full">
                      <span className="text-gray-700">Wet Ash:</span>
                      <span className="text-gray-900">
                        {(productionTotals.totalWetAshKg / 1000).toFixed(2)} Tons
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="flex justify-between w-full">
                      <span className="text-gray-700">Marble Powder:</span>
                      <span className="text-gray-900">
                        {(productionTotals.totalMarblePowderKg / 1000).toFixed(2)} Tons
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="flex justify-between w-full">
                      <span className="text-gray-700">Crusher Powder:</span>
                      <span className="text-gray-900">
                        {(productionTotals.totalCrusherPowderKg / 1000).toFixed(2)} Tons
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="flex justify-between w-full">
                      <span className="text-gray-700">Fly Ash:</span>
                      <span className="text-gray-900">
                        {(productionTotals.totalFlyAshKg / 1000).toFixed(2)} Tons
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="flex justify-between w-full">
                      <span className="text-gray-700">Cement:</span>
                      <span className="text-gray-900">
                        {productionTotals.totalCementBags.toFixed(0)} Bags
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Section 3: Inventory Health */}
        <div className="mb-8">
          <h2 className="text-gray-900 mb-4">Inventory Health</h2>
          
          {inventoryLoading ? (
            <div className="bg-white rounded-lg shadow-md p-6 flex justify-center">
              <p className="text-gray-500">Loading inventory data...</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bricks Ready */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col items-center justify-center">
                <Square className="w-16 h-16 text-blue-600 mb-4" />
                <h3 className="text-gray-700 mb-2">Bricks Ready</h3>
                <p className="text-gray-900">{INVENTORY_METRICS.bricksReady.toLocaleString()}</p>
              </div>
            </div>

            {/* Raw Materials */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-gray-900 mb-4">Raw Material Stock</h3>
              <div className="space-y-4">
                {/* Wet Ash */}
                <div className="flex items-center gap-3">
                  <Droplets className="w-8 h-8 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm">Wet Ash</p>
                    <p className="text-gray-900">
                      {INVENTORY_METRICS.wetAshKg.toLocaleString()} Kg ({(INVENTORY_METRICS.wetAshKg / 1000).toFixed(2)} Tons)
                    </p>
                  </div>
                </div>

                {/* Marble Powder */}
                <div className="flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-pink-600" />
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm">Marble Powder</p>
                    <p className="text-gray-900">
                      {INVENTORY_METRICS.marblePowderKg.toLocaleString()} Kg ({(INVENTORY_METRICS.marblePowderKg / 1000).toFixed(2)} Tons)
                    </p>
                  </div>
                </div>

                {/* Crusher Powder */}
                <div className="flex items-center gap-3">
                  <Hammer className="w-8 h-8 text-orange-600" />
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm">Crusher Powder</p>
                    <p className="text-gray-900">
                      {INVENTORY_METRICS.crusherPowderKg.toLocaleString()} Kg ({(INVENTORY_METRICS.crusherPowderKg / 1000).toFixed(2)} Tons)
                    </p>
                  </div>
                </div>

                {/* Fly Ash */}
                <div className="flex items-center gap-3">
                  <Wind className="w-8 h-8 text-gray-600" />
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm">Fly Ash</p>
                    <p className="text-gray-900">
                      {INVENTORY_METRICS.flyAshKg.toLocaleString()} Kg ({(INVENTORY_METRICS.flyAshKg / 1000).toFixed(2)} Tons)
                    </p>
                  </div>
                </div>

                {/* Cement */}
                <div className="flex items-center gap-3">
                  <Mountain className="w-8 h-8 text-green-600" />
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm">Cement</p>
                    <p className="text-gray-900">
                      {INVENTORY_METRICS.cementKg.toLocaleString()} Kg ({(INVENTORY_METRICS.cementKg / 50).toFixed(0)} Bags)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

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