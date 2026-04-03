import React from 'react';
import { ArrowLeft, Calculator, Info } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useCalculateSalary } from '../../../hooks/useCalculateSalary';

export function CalculateSalaryScreen() {
  const {
    employees,
    finalSalaries,
    loading,
    generating,
    errorMessage,
    alreadyGenerated,
    showSuccess,
    lastMonthLabel,
    updateFinalSalary,
    handleGenerate,
    handleSuccessClose,
    goBack,
  } = useCalculateSalary();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/employees/salary-ledger')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Salary Ledger
          </button>
          <h1 className="text-gray-900">Calculate Salary</h1>
          <p className="text-gray-600 mt-1">
            Generate fixed salary for <span className="font-semibold">{lastMonthLabel}</span>
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-600">{errorMessage}</p>
          </div>
        )}

        {/* Already Generated Banner */}
        {alreadyGenerated && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-blue-900 font-semibold">Salary Already Generated</h3>
                <p className="text-blue-800 mt-1">
                  The salary has been calculated for <span className="font-semibold">{lastMonthLabel}</span>.
                  Please wait till next month to do the calculation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">Loading employees...</p>
          </div>
        )}

        {/* Content */}
        {!loading && !alreadyGenerated && (
          <>
            {/* Info Note */}
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-700 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-800 text-sm">
                  Deduction for absent and half day has already been made.
                </p>
              </div>
            </div>

            {employees.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No active fixed salary employees found.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden mb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-700 text-sm">Emp ID</th>
                          <th className="px-4 py-3 text-left text-gray-700 text-sm">Name</th>
                          <th className="px-4 py-3 text-left text-gray-700 text-sm">Phone</th>
                          <th className="px-4 py-3 text-center text-gray-700 text-sm">Present</th>
                          <th className="px-4 py-3 text-center text-gray-700 text-sm">Absent</th>
                          <th className="px-4 py-3 text-center text-gray-700 text-sm">Leave</th>
                          <th className="px-4 py-3 text-center text-gray-700 text-sm">Half Day</th>
                          <th className="px-4 py-3 text-right text-gray-700 text-sm">Salary (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {employees.map((emp) => (
                          <tr key={emp.employee_id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-gray-600 text-sm font-mono">
                              {emp.employee_id.slice(0, 8)}…
                            </td>
                            <td className="px-4 py-4 text-gray-900">{emp.name}</td>
                            <td className="px-4 py-4 text-gray-600">{emp.phone}</td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-block px-2 py-1 rounded-full text-sm bg-green-100 text-green-800">
                                {emp.present_days}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-block px-2 py-1 rounded-full text-sm bg-red-100 text-red-800">
                                {emp.absent_days}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-block px-2 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                                {emp.leave_days}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-block px-2 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                                {emp.half_days}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <input
                                type="number"
                                value={finalSalaries[emp.employee_id] ?? emp.base_salary}
                                onChange={(e) =>
                                  updateFinalSalary(
                                    emp.employee_id,
                                    e.target.value ? Number(e.target.value) : null
                                  )
                                }
                                onWheel={(e) => e.currentTarget.blur()}
                                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                min="0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-4 mb-6">
                  {employees.map((emp) => (
                    <div
                      key={emp.employee_id}
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                    >
                      {/* Employee Info */}
                      <div className="mb-3">
                        <p className="text-gray-900 font-medium">{emp.name}</p>
                        <p className="text-gray-600 text-sm">{emp.phone}</p>
                        <p className="text-gray-400 text-xs font-mono mt-1">
                          ID: {emp.employee_id.slice(0, 8)}…
                        </p>
                      </div>

                      {/* Attendance Badges */}
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="text-center">
                          <p className="text-gray-500 text-xs mb-1">Present</p>
                          <span className="inline-block px-2 py-1 rounded-full text-sm bg-green-100 text-green-800">
                            {emp.present_days}
                          </span>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-xs mb-1">Absent</p>
                          <span className="inline-block px-2 py-1 rounded-full text-sm bg-red-100 text-red-800">
                            {emp.absent_days}
                          </span>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-xs mb-1">Leave</p>
                          <span className="inline-block px-2 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                            {emp.leave_days}
                          </span>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-xs mb-1">Half Day</p>
                          <span className="inline-block px-2 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                            {emp.half_days}
                          </span>
                        </div>
                      </div>

                      {/* Salary Input */}
                      <div>
                        <label className="block text-gray-700 text-sm mb-1">Salary (₹)</label>
                        <input
                          type="number"
                          value={finalSalaries[emp.employee_id] ?? emp.base_salary}
                          onChange={(e) =>
                            updateFinalSalary(
                              emp.employee_id,
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          min="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Generate Salary Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Calculator className="w-5 h-5" />
                    {generating ? 'Generating...' : 'Generate Salary'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Success Popup */}
      {showSuccess && (
        <Popup
          title="Success"
          message={`Salary for ${lastMonthLabel} has been generated successfully!`}
          onClose={handleSuccessClose}
          type="success"
        />
      )}
    </div>
  );
}
