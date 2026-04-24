import React from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useAttendance } from '../../../hooks/useAttendance';
import type { EmployeeCategory } from '../../../../services/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function getCategoryLabel(category: EmployeeCategory): string {
  switch (category) {
    case 'DAILY':
      return 'Daily Wages';
    case 'FIXED':
      return 'Fixed Salary';
    case 'LOADMEN':
      return 'Loadmen';
    default:
      return category;
  }
}

function getCategoryBadgeClass(category: EmployeeCategory): string {
  switch (category) {
    case 'DAILY':
      return 'bg-purple-100 text-purple-800';
    case 'FIXED':
      return 'bg-orange-100 text-orange-800';
    case 'LOADMEN':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

const ATTENDANCE_OPTIONS = ['Present', 'Absent', 'Half Day', 'Leave'] as const;

type AttendanceOption = (typeof ATTENDANCE_OPTIONS)[number];

function getOptionActiveClass(status: AttendanceOption): string {
  switch (status) {
    case 'Present':
      return 'bg-green-600 text-white border-green-600';
    case 'Absent':
      return 'bg-red-600 text-white border-red-600';
    case 'Half Day':
      return 'bg-yellow-600 text-white border-yellow-600';
    case 'Leave':
      return 'bg-orange-600 text-white border-orange-600';
  }
}

// ─── component ──────────────────────────────────────────────────────────────

export function AttendanceScreen() {
  const {
    selectedDate,
    activeTab,
    entries,
    loading,
    saving,
    hasValidationError,
    showSaveSuccess,
    showBulkConfirmation,
    pendingBulkAction,
    errorMessage,
    isPastDate,
    isEditable,
    isAlreadySaved,
    handleDateChange,
    handleTabChange,
    handleAttendanceChange,
    handleMarkAllClick,
    handleBulkConfirm,
    handleBulkCancel,
    handleSave,
    handleSuccessClose,
    goBack,
  } = useAttendance();

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/employees')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Employee Management
          </button>
          <h1 className="text-gray-900">Employee Attendance</h1>
          <p className="text-gray-600 mt-1">Mark daily attendance for employees</p>
        </div>

        {/* Date Selector and Bulk Actions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={today}
                className="w-full sm:w-auto px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ colorScheme: 'light' }}
              />
            </div>

            {isPastDate && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                <p className="text-yellow-800 text-sm">
                  {isAlreadySaved
                   ? 'Attendance for this past date has already been recorded and cannot be modified.'
                   : 'You are marking attendance for a past date.'}
                </p>
              </div>
            )}

            {!isPastDate && isAlreadySaved && (
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  Attendance for this date has already been recorded and cannot be modified.
                </p>
              </div>
            )}

            {isEditable && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleMarkAllClick('Present')}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Mark All Present
                </button>
                <button
                  onClick={() => handleMarkAllClick('Leave')}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Mark All Leave
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active / Inactive Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => handleTabChange('Active')}
                className={`flex-1 px-6 py-4 text-center transition-colors ${
                  activeTab === 'Active'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active Employees
              </button>
              <button
                onClick={() => handleTabChange('Inactive')}
                className={`flex-1 px-6 py-4 text-center transition-colors ${
                  activeTab === 'Inactive'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Inactive Employees
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-600">{errorMessage}</p>
          </div>
        )}

        {/* Validation Error Banner */}
        {hasValidationError && (
          <div className="bg-red-50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-600">
              Attendance is required for all employees. Please mark attendance for everyone.
            </p>
          </div>
        )}

        {/* Attendance Records */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {loading ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">Loading attendance...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">
                {activeTab === 'Active'
                  ? 'No active employees found. Please add employees from Employee Management.'
                  : 'No inactive employees found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {entries.map((entry) => {
                const hasError = hasValidationError && !entry.status;

                return (
                  <div
                    key={entry.employee.id}
                    className={`border rounded-lg p-4 ${
                      hasError ? 'border-red-500 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    {/* Employee Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-gray-600 text-sm">Employee Name</p>
                        <p className="text-gray-900">{entry.employee.name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Phone Number</p>
                        <p className="text-gray-900">{entry.employee.phone}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Role</p>
                        <p className="text-gray-900">{entry.employee.roles.name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Category</p>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-sm ${getCategoryBadgeClass(
                            entry.employee.roles.category
                          )}`}
                        >
                          {getCategoryLabel(entry.employee.roles.category)}
                        </span>
                      </div>
                    </div>

                    {/* Attendance Selector */}
                    <div>
                      <label className="block text-gray-700 mb-2">
                        Attendance {isEditable && <span className="text-red-600">*</span>}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ATTENDANCE_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            disabled={!isEditable}
                            onClick={() =>
                              handleAttendanceChange(entry.employee.id, option)
                            }
                            className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                              entry.status === option
                                ? getOptionActiveClass(option)
                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            } ${!isEditable ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save Button */}
        {isEditable && entries.length > 0 && !loading && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        )}
      </div>

      {/* Bulk Action Confirmation Popup */}
      {showBulkConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-gray-900 mb-4">Confirm Bulk Action</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to mark all employees as{' '}
              <span className="font-semibold">{pendingBulkAction}</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleBulkCancel}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkConfirm}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSaveSuccess && (
        <Popup
          title="Success"
          message="Attendance saved successfully!"
          onClose={handleSuccessClose}
          type="success"
        />
      )}
    </div>
  );
}

