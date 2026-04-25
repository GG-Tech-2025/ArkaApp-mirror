import React from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAttendanceView } from '../../../hooks/useAttendanceView';
import type { DisplayStatus } from '../../../hooks/useAttendanceView';

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Cell rendering helpers ─────────────────────────────────────────────────

function getStatusLabel(status: DisplayStatus): string {
  switch (status) {
    case 'Present':  return 'P';
    case 'Absent':   return 'A';
    case 'Half Day': return 'H';
    case 'Leave':    return 'L';
  }
}

function getStatusCellClass(status: DisplayStatus): string {
  switch (status) {
    case 'Present':  return 'bg-green-100 text-green-800 font-semibold';
    case 'Absent':   return 'bg-red-100 text-red-800 font-semibold';
    case 'Half Day': return 'bg-yellow-100 text-yellow-800 font-semibold';
    case 'Leave':    return 'bg-orange-100 text-orange-800 font-semibold';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AttendanceViewScreen() {
  const {
    selectedMonth,
    selectedYear,
    rows,
    dates,
    missedDates,
    loading,
    errorMessage,
    yearOptions,
    monthOptions,
    handleMonthChange,
    handleYearChange,
    goBack,
  } = useAttendanceView();

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Header ── */}
        <div className="mb-6">
          <button
            onClick={() => goBack('/admin/employees/attendance')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Attendance
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Attendance Overview</h1>
              <p className="text-gray-600 mt-1">Monthly attendance matrix for all employees</p>
            </div>

            {/* Dropdowns */}
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{MONTHS[m - 1]}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { label: 'Present (P)',  cls: 'bg-green-100 text-green-800' },
            { label: 'Absent (A)',   cls: 'bg-red-100 text-red-800' },
            { label: 'Half Day (H)', cls: 'bg-yellow-100 text-yellow-800' },
            { label: 'Leave (L)',    cls: 'bg-orange-100 text-orange-800' },
            { label: 'No Entry (—)', cls: 'bg-white text-gray-400 border border-gray-200' },
            { label: 'Missed Date ⚠', cls: 'bg-amber-100 text-amber-700' },
            { label: 'Inactive period', cls: 'bg-gray-100 text-gray-400' },
          ].map(({ label, cls }) => (
            <span key={label} className={`px-3 py-1 rounded-full text-xs font-medium ${cls}`}>
              {label}
            </span>
          ))}
        </div>

        {/* ── Error ── */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-600">{errorMessage}</p>
          </div>
        )}

        {/* ── Table ── */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">Loading attendance data...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">No employee data found for this period.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-max w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    {/* Sticky name header */}
                    <th className="sticky left-0 z-20 bg-gray-100 px-4 py-3 text-left text-gray-700 font-semibold whitespace-nowrap min-w-40 border-r border-gray-200">
                      Employee
                    </th>

                    {/* Date columns */}
                    {dates.map((date) => {
                      const day = new Date(date + 'T00:00:00').getDate();
                      const isMissed = missedDates.has(date);
                      return (
                        <th
                          key={date}
                          className={`px-2 py-3 text-center font-semibold w-10 ${
                            isMissed
                              ? 'bg-amber-100 text-amber-700'
                              : 'text-gray-700'
                          }`}
                          title={isMissed ? 'No attendance recorded for this date' : date}
                        >
                          {day}
                          {isMissed && (
                            <span className="block text-xs leading-none mt-0.5">⚠</span>
                          )}
                        </th>
                      );
                    })}

                    {/* Summary columns */}
                    <th className="px-3 py-3 text-center font-semibold text-green-700 bg-green-50 whitespace-nowrap border-l border-gray-200">P</th>
                    <th className="px-3 py-3 text-center font-semibold text-red-700 bg-red-50 whitespace-nowrap">A</th>
                    <th className="px-3 py-3 text-center font-semibold text-yellow-700 bg-yellow-50 whitespace-nowrap">H</th>
                    <th className="px-3 py-3 text-center font-semibold text-orange-700 bg-orange-50 whitespace-nowrap">L</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.employee.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      {/* Sticky employee name */}
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 text-gray-900 font-medium whitespace-nowrap border-r border-gray-200 hover:bg-gray-50">
                        <div className="flex flex-col">
                          <span>{row.employee.name}</span>
                          {row.isInactive && (
                            <span className="text-xs text-gray-400 font-normal">Inactive</span>
                          )}
                        </div>
                      </td>

                      {/* Date cells */}
                      {dates.map((date) => {
                        const status = row.statusMap[date];
                        const isMissedCol = missedDates.has(date);

                        // Inactive employee: grey out dates after their last record
                        const isInactivePeriod =
                          row.isInactive &&
                          row.lastRecordDate !== null &&
                          date > row.lastRecordDate;

                        if (isInactivePeriod) {
                          return (
                            <td
                              key={date}
                              className="px-2 py-2 text-center bg-gray-100 text-gray-300 w-10"
                              title="Employee was inactive"
                            >
                              —
                            </td>
                          );
                        }

                        if (status) {
                          return (
                            <td
                              key={date}
                              className={`px-2 py-2 text-center w-10 ${getStatusCellClass(status)}`}
                              title={`${row.employee.name} - ${date}: ${status}`}
                            >
                              {getStatusLabel(status)}
                            </td>
                          );
                        }

                        // No record for this date
                        if (isMissedCol) {
                          return (
                            <td
                              key={date}
                              className="px-2 py-2 text-center w-10 bg-amber-50 text-amber-400"
                              title="No attendance recorded for this date"
                            >
                              ⚠
                            </td>
                          );
                        }

                        // Future date or just missing
                        const isFuture = date > today;
                        return (
                          <td
                            key={date}
                            className={`px-2 py-2 text-center w-10 ${
                              isFuture ? 'text-gray-200' : 'text-gray-300'
                            }`}
                          >
                            —
                          </td>
                        );
                      })}

                      {/* Summary cells */}
                      <td className="px-3 py-2 text-center text-green-700 font-semibold bg-green-50 border-l border-gray-200">
                        {row.totals.present}
                      </td>
                      <td className="px-3 py-2 text-center text-red-700 font-semibold bg-red-50">
                        {row.totals.absent}
                      </td>
                      <td className="px-3 py-2 text-center text-yellow-700 font-semibold bg-yellow-50">
                        {row.totals.halfDay}
                      </td>
                      <td className="px-3 py-2 text-center text-orange-700 font-semibold bg-orange-50">
                        {row.totals.leave}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Missed dates notice */}
            {missedDates.size > 0 && (
              <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-amber-700 text-sm">
                  <span className="font-semibold">{missedDates.size} date{missedDates.size > 1 ? 's' : ''}</span>{' '}
                  {missedDates.size > 1 ? 'have' : 'has'} no attendance recorded (⚠ columns).
                  Please mark attendance for those dates.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
