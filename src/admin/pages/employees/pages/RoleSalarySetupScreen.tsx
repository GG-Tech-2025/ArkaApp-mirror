import React, { useState } from 'react';
import { ArrowLeft, Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useRoleManagement } from '../../../hooks/useRoleManagement';
import type { Role, EmployeeCategory } from '../../../../services/types';

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

function getSalaryTypeLabel(category: EmployeeCategory): string {
  switch (category) {
    case 'DAILY':
      return 'Per Day Wage';
    case 'FIXED':
      return 'Monthly Salary';
    case 'LOADMEN':
      return 'Rate Per Load';
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

// ─── component ──────────────────────────────────────────────────────────────

export function RoleSalarySetupScreen() {
  const {
    activeTab,
    activeRoles,
    inactiveRoles,
    loading,
    hasMoreActive,
    hasMoreInactive,
    totalActiveRoles,
    totalInactiveRoles,
    handleTabChange,
    handleLoadMoreActive,
    handleLoadMoreInactive,
    handleToggleRoleStatus,
    goBack,
    goTo,
  } = useRoleManagement();

  const [showTogglePopup, setShowTogglePopup] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleToggleClick = (role: Role) => {
    setSelectedRole(role);
    setShowTogglePopup(true);
  };

  const handleToggleConfirm = async () => {
    if (selectedRole) {
      // If in Active tab → make inactive (false); if in Inactive tab → make active (true)
      const newStatus = activeTab === 'Active' ? false : true;
      await handleToggleRoleStatus(selectedRole.id, newStatus);
      setShowTogglePopup(false);
      setSelectedRole(null);
    }
  };

  const handleToggleCancel = () => {
    setShowTogglePopup(false);
    setSelectedRole(null);
  };

  const displayedRoles = activeTab === 'Active' ? activeRoles : inactiveRoles;
  const hasMore = activeTab === 'Active' ? hasMoreActive : hasMoreInactive;

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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Role & Salary Setup</h1>
              <p className="text-gray-600 mt-1">Configure employee roles and salary structure</p>
            </div>
            <button
              onClick={() => goTo('/admin/employees/role-setup/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Create Role
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Roles</p>
                <p className="text-gray-900 mt-1">{totalActiveRoles}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <ToggleRight className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Inactive Roles</p>
                <p className="text-gray-900 mt-1">{totalInactiveRoles}</p>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg">
                <ToggleLeft className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs + Table */}
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
            {loading && displayedRoles.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-600">Loading roles...</p>
              </div>
            ) : displayedRoles.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">No {activeTab.toLowerCase()} roles found.</p>
              </div>
            ) : (
              <>
                {/* Desktop View – Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700">Role Name</th>
                        <th className="px-4 py-3 text-left text-gray-700">Employee Category</th>
                        <th className="px-4 py-3 text-left text-gray-700">Salary Type</th>
                        <th className="px-4 py-3 text-left text-gray-700">Current Salary Value</th>
                        <th className="px-4 py-3 text-left text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {displayedRoles.map((role) => (
                        <tr
                          key={role.id}
                          className={
                            activeTab === 'Inactive'
                              ? 'opacity-50'
                              : 'hover:bg-gray-50'
                          }
                        >
                          <td className="px-4 py-4 text-gray-900">{role.name}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`px-2 py-1 rounded-full text-sm ${getCategoryBadgeClass(
                                role.category
                              )}`}
                            >
                              {getCategoryLabel(role.category)}
                            </span>
                            {role.no_loading_salary && (
                              <span className="ml-2 px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800">
                                No Loading Wages
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {getSalaryTypeLabel(role.category)}
                          </td>
                          <td className="px-4 py-4 text-gray-900">
                            ₹{role.salary_value.toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {activeTab === 'Active' ? (
                                <>
                                  <button
                                    onClick={() =>
                                      goTo(
                                        `/admin/employees/role-setup/${role.id}/edit`
                                      )
                                    }
                                    className="text-blue-600 hover:text-blue-800 p-1"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleClick(role)}
                                    className="text-red-600 hover:text-red-800 p-1"
                                    title="Set Inactive"
                                  >
                                    <ToggleRight className="w-5 h-5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleToggleClick(role)}
                                  className="text-green-600 hover:text-green-800 p-1"
                                  title="Set Active"
                                >
                                  <ToggleLeft className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View – Cards */}
                <div className="lg:hidden space-y-4">
                  {displayedRoles.map((role) => (
                    <div
                      key={role.id}
                      className={`bg-white border border-gray-200 rounded-lg p-4 ${
                        activeTab === 'Inactive' ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-gray-900">{role.name}</p>
                          <span
                            className={`inline-block mt-2 px-2 py-1 rounded-full text-sm ${getCategoryBadgeClass(
                              role.category
                            )}`}
                          >
                            {getCategoryLabel(role.category)}
                          </span>
                          {role.no_loading_salary && (
                            <span className="inline-block mt-1 ml-1 px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800">
                              No Loading Wages
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          {activeTab === 'Active' ? (
                            <>
                              <button
                                onClick={() =>
                                  goTo(
                                    `/admin/employees/role-setup/${role.id}/edit`
                                  )
                                }
                                className="text-blue-600 hover:text-blue-800 p-2"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleClick(role)}
                                className="text-red-600 hover:text-red-800 p-2"
                              >
                                <ToggleRight className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleToggleClick(role)}
                              className="text-green-600 hover:text-green-800 p-2"
                            >
                              <ToggleLeft className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm border-t border-gray-200 pt-3">
                        <p className="text-gray-600">
                          Salary Type: {getSalaryTypeLabel(role.category)}
                        </p>
                        <p className="text-gray-900">
                          ₹{role.salary_value.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center pt-6">
                    <button
                      onClick={
                        activeTab === 'Active'
                          ? handleLoadMoreActive
                          : handleLoadMoreInactive
                      }
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
      {showTogglePopup && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-gray-900 mb-4">
              {activeTab === 'Active' ? 'Set Role Inactive' : 'Activate Role'}
            </h2>
            <p className="text-gray-600 mb-6">
              {activeTab === 'Active'
                ? 'Are you sure you want to set this role as inactive?'
                : 'Are you sure you want to activate this role?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleToggleCancel}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                No
              </button>
              <button
                onClick={handleToggleConfirm}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
