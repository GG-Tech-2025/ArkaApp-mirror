import React, { useState } from 'react';
import { ArrowLeft, Plus, Search, Users, Edit2, ToggleLeft, ToggleRight, UserCog, Calendar } from 'lucide-react';
import { useEmployeeManagement } from '../../../hooks/useEmployeeManagement';

export function EmployeeManagementScreen() {
  const {
    activeTab,
    activeEmployees,
    inactiveEmployees,
    loading,
    hasMoreActive,
    hasMoreInactive,
    searchQuery,
    totalActiveEmployees,
    totalInactiveEmployees,
    handleSearchChange,
    handleTabChange,
    handleLoadMoreActive,
    handleLoadMoreInactive,
    handleToggleEmployeeStatus,
    goBack,
    goTo,
  } = useEmployeeManagement();

  const [showTogglePopup, setShowTogglePopup] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  const handleToggleClick = (employee: any) => {
    setSelectedEmployee(employee);
    setShowTogglePopup(true);
  };

  const handleToggleConfirm = async () => {
    if (selectedEmployee) {
      // Determine the new status based on current tab
      // If in Active tab, we're making the employee inactive (false)
      // If in Inactive tab, we're making the employee active (true)
      const newStatus = activeTab === 'Active' ? false : true;
      await handleToggleEmployeeStatus(selectedEmployee.id, newStatus);
      setShowTogglePopup(false);
      setSelectedEmployee(null);
    }
  };

  const handleToggleCancel = () => {
    setShowTogglePopup(false);
    setSelectedEmployee(null);
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
              <h1 className="text-gray-900">Employee Management</h1>
              <p className="text-gray-600 mt-1">Manage employee records and information</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => goTo('/admin/employees/role-setup')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
              >
                <UserCog className="w-5 h-5" />
                Role & Salary Setup
              </button>
              <button
                onClick={() => goTo('/admin/employees/attendance')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                <Calendar className="w-5 h-5" />
                Attendance
              </button>
              <button
                onClick={() => goTo('/admin/employees/create')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Create Employee
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Employees</p>
                <p className="text-gray-900 mt-1">{totalActiveEmployees}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Inactive Employees</p>
                <p className="text-gray-900 mt-1">{totalInactiveEmployees}</p>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
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
            {loading && displayedEmployees.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-600">Loading employees...</p>
              </div>
            ) : displayedEmployees.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-600">No {activeTab.toLowerCase()} employees found.</p>
              </div>
            ) : (
              <>
                {/* Desktop View - Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700">Name</th>
                        <th className="px-4 py-3 text-left text-gray-700">ID</th>
                        <th className="px-4 py-3 text-left text-gray-700">Phone Number</th>
                        <th className="px-4 py-3 text-left text-gray-700">Role</th>
                        <th className="px-4 py-3 text-left text-gray-700">Category</th>
                        <th className="px-4 py-3 text-left text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {displayedEmployees.map((employee) => (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-gray-900">{employee.name}</td>
                          <td className="px-4 py-4 text-gray-600">{employee.id}</td>
                          <td className="px-4 py-4 text-gray-600">{employee.phone || '-'}</td>
                          <td className="px-4 py-4 text-gray-600">{employee.roles?.name || '-'}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-sm ${
                              employee.roles?.category === 'DAILY' ? 'bg-purple-100 text-purple-800' :
                              employee.roles?.category === 'FIXED' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {employee.roles?.category === 'DAILY' ? 'Daily Wages' :
                               employee.roles?.category === 'FIXED' ? 'Fixed Salary' :
                               'Loadmen'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => goTo(`/admin/employees/${employee.id}/edit`)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleClick(employee)}
                                className={`p-1 ${
                                  activeTab === 'Active'
                                    ? 'text-red-600 hover:text-red-800'
                                    : 'text-green-600 hover:text-green-800'
                                }`}
                                title={activeTab === 'Active' ? 'Set Inactive' : 'Set Active'}
                              >
                                {activeTab === 'Active' ? (
                                  <ToggleRight className="w-5 h-5" />
                                ) : (
                                  <ToggleLeft className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View - Cards */}
                <div className="lg:hidden space-y-4">
                  {displayedEmployees.map((employee) => (
                    <div key={employee.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-gray-900 font-medium">{employee.name}</p>
                          <p className="text-gray-600 text-sm">{employee.id}</p>
                          <p className="text-gray-600 text-sm">{employee.phone || '-'}</p>
                        </div>
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => goTo(`/admin/employees/${employee.id}/edit`)}
                            className="text-blue-600 hover:text-blue-800 p-2"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleClick(employee)}
                            className={`p-2 ${
                              activeTab === 'Active'
                                ? 'text-red-600 hover:text-red-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {activeTab === 'Active' ? (
                              <ToggleRight className="w-5 h-5" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm border-t border-gray-200 pt-3">
                        <p className="text-gray-600">Role: {employee.roles?.name || '-'}</p>
                        <span className={`inline-block px-2 py-1 rounded-full text-sm ${
                          employee.roles?.category === 'DAILY' ? 'bg-purple-100 text-purple-800' :
                          employee.roles?.category === 'FIXED' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {employee.roles?.category === 'DAILY' ? 'Daily Wages' :
                           employee.roles?.category === 'FIXED' ? 'Fixed Salary' :
                           'Loadmen'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center pt-6">
                    <button
                      onClick={activeTab === 'Active' ? handleLoadMoreActive : handleLoadMoreInactive}
                      disabled={loading}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toggle Confirmation Popup */}
      {showTogglePopup && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
            <h2 className="text-gray-900 mb-4 text-2xl font-semibold">
              {activeTab === 'Active' ? 'Set Employee Inactive' : 'Activate Employee'}
            </h2>
            <p className="text-gray-600 mb-6 text-lg">
              {activeTab === 'Active' 
                ? 'Are you sure you want to set this employee as inactive?' 
                : 'Are you sure you want to activate this employee?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleToggleCancel}
                className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-lg"
              >
                No
              </button>
              <button
                onClick={handleToggleConfirm}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
