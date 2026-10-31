import React, { useState } from 'react';
import { AdminScreen, Role } from '../../AdminApp';
import { ArrowLeft, Save } from 'lucide-react';
import { Popup } from '../Popup';

interface EditRoleScreenProps {
  role: Role;
  onNavigate: (screen: AdminScreen) => void;
}

export function EditRoleScreen({ role, onNavigate }: EditRoleScreenProps) {
  const [formData, setFormData] = useState({
    roleName: role.name,
    category: role.category,
    perDayWage: role.category === 'Daily Wages' ? role.salaryValue.toString() : '',
    monthlySalary: role.category === 'Fixed Salary' ? role.salaryValue.toString() : '',
    ratePerLoad: role.category === 'Loadmen' ? role.salaryValue.toString() : '',
    minimumLoadRequirement: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPopup, setShowPopup] = useState(false);
  const [popupStatus, setPopupStatus] = useState<'success' | 'error' | 'warning'>('success');
  const [popupMessage, setPopupMessage] = useState('');
  const [showCategoryChangeConfirm, setShowCategoryChangeConfirm] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<'Daily Wages' | 'Fixed Salary' | 'Loadmen' | ''>('');

  const handleCategoryChangeRequest = (category: 'Daily Wages' | 'Fixed Salary' | 'Loadmen') => {
    if (category !== formData.category) {
      setPendingCategory(category);
      setShowCategoryChangeConfirm(true);
    }
  };

  const confirmCategoryChange = () => {
    setFormData({
      ...formData,
      category: pendingCategory as any,
      perDayWage: '',
      monthlySalary: '',
      ratePerLoad: '',
      minimumLoadRequirement: '',
    });
    setShowCategoryChangeConfirm(false);
    setPendingCategory('');
    // Clear salary-related errors when category changes
    const newErrors = { ...errors };
    delete newErrors.perDayWage;
    delete newErrors.monthlySalary;
    delete newErrors.ratePerLoad;
    setErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.roleName.trim()) newErrors.roleName = 'Role name is required';
    if (!formData.category) newErrors.category = 'Category is required';

    if (formData.category === 'Daily Wages') {
      if (!formData.perDayWage.trim()) {
        newErrors.perDayWage = 'Per day wage is required';
      } else if (isNaN(Number(formData.perDayWage)) || Number(formData.perDayWage) <= 0) {
        newErrors.perDayWage = 'Please enter a valid wage amount';
      } else if (formData.perDayWage.includes('.')) {
        newErrors.perDayWage = 'Only integers allowed';
      } else if (formData.perDayWage.length > 5) {
        newErrors.perDayWage = 'Maximum 5 digits allowed';
      }
    }

    if (formData.category === 'Fixed Salary') {
      if (!formData.monthlySalary.trim()) {
        newErrors.monthlySalary = 'Monthly salary is required';
      } else if (isNaN(Number(formData.monthlySalary)) || Number(formData.monthlySalary) <= 0) {
        newErrors.monthlySalary = 'Please enter a valid salary amount';
      } else if (formData.monthlySalary.replace('.', '').length > 6) {
        newErrors.monthlySalary = 'Maximum 6 digits allowed';
      }
    }

    if (formData.category === 'Loadmen') {
      if (!formData.ratePerLoad.trim()) {
        newErrors.ratePerLoad = 'Rate per load is required';
      } else if (isNaN(Number(formData.ratePerLoad)) || Number(formData.ratePerLoad) <= 0) {
        newErrors.ratePerLoad = 'Please enter a valid rate';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      const success = Math.random() > 0.1;
      setPopupStatus(success ? 'success' : 'error');
      setPopupMessage(success ? 'Role details updated successfully!' : 'Failed to update role. Please try again.');
      setShowPopup(true);
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    if (popupStatus === 'success') {
      onNavigate('role-setup');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate('role-setup')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Role & Salary Setup
          </button>
          <h1 className="text-gray-900">Edit Role</h1>
          <p className="text-gray-600 mt-1">Update role details - {role.id}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role Name */}
            <div>
              <label className="block text-gray-700 mb-2">
                Role Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.roleName}
                onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.roleName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Machine Operator, Supervisor, Driver"
              />
              {errors.roleName && <p className="text-red-600 text-sm mt-1">{errors.roleName}</p>}
            </div>

            {/* Employee Category */}
            <div>
              <label className="block text-gray-700 mb-2">
                Employee Category <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChangeRequest(e.target.value as any)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.category ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select category</option>
                <option value="Daily Wages">Daily Wages</option>
                <option value="Fixed Salary">Fixed Salary</option>
                <option value="Loadmen">Loadmen (Order-Based Salary)</option>
              </select>
              {errors.category && <p className="text-red-600 text-sm mt-1">{errors.category}</p>}
            </div>

            {/* Dynamic Salary Fields - Daily Wages */}
            {formData.category === 'Daily Wages' && (
              <div>
                <label className="block text-gray-700 mb-2">
                  Per Day Wage (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={formData.perDayWage}
                  onChange={(e) => setFormData({ ...formData, perDayWage: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.perDayWage ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter daily wage (integers only, max 5 digits)"
                  min="1"
                  step="1"
                />
                {errors.perDayWage && <p className="text-red-600 text-sm mt-1">{errors.perDayWage}</p>}
              </div>
            )}

            {/* Dynamic Salary Fields - Fixed Salary */}
            {formData.category === 'Fixed Salary' && (
              <div>
                <label className="block text-gray-700 mb-2">
                  Monthly Salary (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={formData.monthlySalary}
                  onChange={(e) => setFormData({ ...formData, monthlySalary: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.monthlySalary ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter monthly salary (max 6 digits)"
                  min="1"
                  step="0.01"
                />
                {errors.monthlySalary && <p className="text-red-600 text-sm mt-1">{errors.monthlySalary}</p>}
                <p className="text-gray-600 text-sm mt-2">
                  Deductions for absent/half days can be configured per employee basis
                </p>
              </div>
            )}

            {/* Dynamic Salary Fields - Loadmen */}
            {formData.category === 'Loadmen' && (
              <>
                <div>
                  <label className="block text-gray-700 mb-2">
                    Rate Per Load (₹) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.ratePerLoad}
                    onChange={(e) => setFormData({ ...formData, ratePerLoad: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.ratePerLoad ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter rate per load/delivery"
                    min="1"
                    step="0.01"
                  />
                  {errors.ratePerLoad && <p className="text-red-600 text-sm mt-1">{errors.ratePerLoad}</p>}
                  <p className="text-gray-600 text-sm mt-2">
                    This rate will be applied when orders are delivered
                  </p>
                </div>
                
                <div>
                  <label className="block text-gray-700 mb-2">
                    Minimum Load Requirement (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.minimumLoadRequirement}
                    onChange={(e) => setFormData({ ...formData, minimumLoadRequirement: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter minimum loads per month"
                    min="0"
                  />
                  <p className="text-gray-600 text-sm mt-2">
                    For business rules and performance tracking (optional)
                  </p>
                </div>
              </>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                Update Role
              </button>
              <button
                type="button"
                onClick={() => onNavigate('role-setup')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Category Change Confirmation */}
      {showCategoryChangeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-gray-900 mb-3 text-2xl font-semibold">Confirm Category Change</h2>
              <p className="text-gray-600 mb-6 text-lg">
                Changing this role will affect salary calculations for assigned employees. Do you want to continue?
              </p>
              <div className="flex gap-4 w-full">
                <button
                  onClick={confirmCategoryChange}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg"
                >
                  Yes, Continue
                </button>
                <button
                  onClick={() => {
                    setShowCategoryChangeConfirm(false);
                    setPendingCategory('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors text-lg"
                >
                  No, Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Popup */}
      {showPopup && (
        <Popup
          title={popupStatus === 'success' ? 'Success' : 'Error'}
          message={popupMessage}
          onClose={handlePopupClose}
          type={popupStatus === 'warning' ? 'warning' : popupStatus}
        />
      )}
    </div>
  );
}