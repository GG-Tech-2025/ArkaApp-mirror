import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popup } from '../../../../components/Popup';
import { useEditEmployee, CATEGORY_LABELS } from '../../../hooks/useEditEmployee';

export function EditEmployeeScreen() {
  const {
    editEmployeeInput,
    updateEditEmployeeInput,
    selectedRole,
    roles,
    rolesLoading,
    employeeLoading,
    employeeId,
    errors,
    showSuccessPopup,
    showFailurePopup,
    loading,
    handleUpdate,
    handleSuccessClose,
    handleFailureClose,
    goBack,
  } = useEditEmployee();

  const navigate = useNavigate();

  if (employeeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading employee details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/employees')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Employees
          </button>
          <h1 className="text-gray-900">Edit Employee</h1>
          <p className="text-gray-600 mt-1">
            Update employee details{employeeId ? ` — ${employeeId}` : ''}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Employee Name */}
            <div>
              <label htmlFor="employeeName" className="block text-gray-700 mb-2">
                Employee Name <span className="text-red-600">*</span>
              </label>
              <input
                id="employeeName"
                type="text"
                value={editEmployeeInput.name}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[a-zA-Z\s]*$/.test(value)) {
                    updateEditEmployeeInput('name', value);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter employee name"
              />
              {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Phone Numbers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="phoneNumber" className="block text-gray-700 mb-2">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  value={editEmployeeInput.phone}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*$/.test(value) && value.length <= 10) {
                      updateEditEmployeeInput('phone', value);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  maxLength={10}
                  placeholder="Enter 10-digit phone number"
                />
                {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label htmlFor="alternatePhone" className="block text-gray-700 mb-2">
                  Alternate Phone <span className="text-gray-500 text-sm">(Optional)</span>
                </label>
                <input
                  id="alternatePhone"
                  type="tel"
                  value={editEmployeeInput.alternate_phone || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*$/.test(value) && value.length <= 10) {
                      updateEditEmployeeInput('alternate_phone', value || null);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  maxLength={10}
                  placeholder="Enter 10-digit phone number"
                />
                {errors.alternate_phone && (
                  <p className="text-red-600 text-sm mt-1">{errors.alternate_phone}</p>
                )}
              </div>
            </div>

            {/* Blood Group */}
            <div>
              <label htmlFor="bloodGroup" className="block text-gray-700 mb-2">
                Blood Group <span className="text-red-600">*</span>
              </label>
              <select
                id="bloodGroup"
                value={editEmployeeInput.blood_group}
                onChange={(e) => updateEditEmployeeInput('blood_group', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select blood group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
              {errors.blood_group && <p className="text-red-600 text-sm mt-1">{errors.blood_group}</p>}
            </div>

            {/* Aadhar Number */}
            <div>
              <label htmlFor="aadharNumber" className="block text-gray-700 mb-2">
                Aadhar Number <span className="text-red-600">*</span>
              </label>
              <input
                id="aadharNumber"
                type="text"
                value={editEmployeeInput.aadhar_number}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value) && value.length <= 12) {
                    updateEditEmployeeInput('aadhar_number', value);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                maxLength={12}
                placeholder="Enter 12-digit Aadhar number"
              />
              {errors.aadhar_number && (
                <p className="text-red-600 text-sm mt-1">{errors.aadhar_number}</p>
              )}
            </div>

            {/* Permanent Address */}
            <div>
              <label htmlFor="permanentAddress" className="block text-gray-700 mb-2">
                Permanent Address <span className="text-red-600">*</span>
              </label>
              <textarea
                id="permanentAddress"
                value={editEmployeeInput.permanent_address}
                onChange={(e) => updateEditEmployeeInput('permanent_address', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                rows={3}
                placeholder="Enter permanent address"
              />
              {errors.permanent_address && (
                <p className="text-red-600 text-sm mt-1">{errors.permanent_address}</p>
              )}
            </div>

            {/* Local Address */}
            <div>
              <label htmlFor="localAddress" className="block text-gray-700 mb-2">
                Local Address <span className="text-gray-500 text-sm">(Optional)</span>
              </label>
              <textarea
                id="localAddress"
                value={editEmployeeInput.local_address || ''}
                onChange={(e) =>
                  updateEditEmployeeInput('local_address', e.target.value || null)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                rows={3}
                placeholder="Enter local address"
              />
            </div>

            {/* Employee Role */}
            <div>
              <label htmlFor="employeeRole" className="block text-gray-700 mb-2">
                Employee Role <span className="text-red-600">*</span>
              </label>
              {rolesLoading ? (
                <p className="text-gray-500 text-sm">Loading roles...</p>
              ) : (
                <div className="flex items-center gap-3">
                  <select
                    id="employeeRole"
                    value={editEmployeeInput.role_id}
                    onChange={(e) => updateEditEmployeeInput('role_id', e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/employees/role-setup/create', {
                      state: { from: `/admin/employees/${employeeId}/edit` },
                    })}
                    className="text-blue-600 hover:text-blue-700 text-sm whitespace-nowrap underline"
                  >
                    Create New Role
                  </button>
                </div>
              )}
              {errors.role_id && <p className="text-red-600 text-sm mt-1">{errors.role_id}</p>}
            </div>

            {/* Category (Auto-filled) */}
            <div>
              <label htmlFor="category" className="block text-gray-700 mb-2">
                Category
              </label>
              <input
                id="category"
                type="text"
                value={selectedRole ? CATEGORY_LABELS[selectedRole.category] ?? selectedRole.category : ''}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed outline-none"
                disabled
                placeholder="Auto-filled based on selected role"
              />
            </div>

            {/* Emergency Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="emergencyContactName" className="block text-gray-700 mb-2">
                  Emergency Contact Name <span className="text-gray-500 text-sm">(Optional)</span>
                </label>
                <input
                  id="emergencyContactName"
                  type="text"
                  value={editEmployeeInput.emergency_contact_name || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[a-zA-Z\s]*$/.test(value)) {
                      updateEditEmployeeInput('emergency_contact_name', value || null);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter emergency contact name"
                />
              </div>

              <div>
                <label htmlFor="emergencyContactPhone" className="block text-gray-700 mb-2">
                  Emergency Contact Number <span className="text-gray-500 text-sm">(Optional)</span>
                </label>
                <input
                  id="emergencyContactPhone"
                  type="tel"
                  value={editEmployeeInput.emergency_contact_phone || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*$/.test(value) && value.length <= 10) {
                      updateEditEmployeeInput('emergency_contact_phone', value || null);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  maxLength={10}
                  placeholder="Enter 10-digit phone number"
                />
                {errors.emergency_contact_phone && (
                  <p className="text-red-600 text-sm mt-1">{errors.emergency_contact_phone}</p>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => goBack('/admin/employees')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Employee Updated Successfully"
          message="The employee details have been updated successfully."
          onClose={handleSuccessClose}
          type="success"
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Update Failed"
          message={errors.form || 'Failed to update employee. Please try again.'}
          onClose={handleFailureClose}
          type="error"
        />
      )}
    </div>
  );
}
