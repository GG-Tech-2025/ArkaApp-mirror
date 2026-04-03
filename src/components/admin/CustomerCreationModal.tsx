import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { createCustomer } from '../../services/middleware.service';
import { Customer } from '../../services/types';

interface CustomerCreationModalProps {
  onClose: () => void;
  onCustomerCreated?: (customer: Customer) => void;
}

export function CustomerCreationModal({ onClose, onCustomerCreated }: CustomerCreationModalProps) {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name) newErrors.name = 'Name is required';
    if (!phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (phoneNumber.length !== 10) {
      newErrors.phoneNumber = 'Phone number must be 10 digits';
    }
    if (!address) newErrors.address = 'Address is required';
    if (address.length > 200) newErrors.address = 'Address cannot exceed 200 characters';
    
    // Validate GST Number - if entered, must be exactly 15 characters
    if (gstNumber && gstNumber.length !== 15) {
      newErrors.gstNumber = 'Enter valid GST Number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const customer = await createCustomer({
        name: name.trim(),
        phone: phoneNumber.trim(),
        address: address.trim(),
        gst_number: gstNumber || undefined,
      });
      onCustomerCreated?.(customer);
      setShowSuccess(true);
    } catch (err: any) {
      console.error('Failed to create customer:', err);
      setErrors({ form: err?.message || 'Failed to create customer' });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(value);
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="flex flex-col items-center text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
            <h2 className="text-gray-900 mb-3">Customer Created Successfully</h2>
            <p className="text-gray-600 mb-6">
              The customer has been added to the system.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-gray-900">Customer Creation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Customer Name */}
          <div>
            <label htmlFor="customerName" className="block text-gray-700 mb-2">
              Customer Name <span className="text-red-600">*</span>
            </label>
            <input
              id="customerName"
              type="text"
              value={name}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow letters and spaces
                if (/^[a-zA-Z\s]*$/.test(value)) {
                  setName(value);
                }
              }}
              placeholder="Enter customer name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phoneNumber" className="block text-gray-700 mb-2">
              Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow digits and limit to 10
                if (/^\d*$/.test(value) && value.length <= 10) {
                  setPhoneNumber(value);
                }
              }}
              placeholder="Enter 10-digit phone number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              maxLength={10}
            />
            {errors.phoneNumber && <p className="text-red-600 text-sm mt-1">{errors.phoneNumber}</p>}
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="block text-gray-700 mb-2">
              Address <span className="text-red-600">*</span>
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter customer address (max 200 characters)"
              rows={3}
              maxLength={200}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
            <p className="text-gray-500 text-sm mt-1">{address.length}/200 characters</p>
            {errors.address && <p className="text-red-600 text-sm mt-1">{errors.address}</p>}
          </div>

          {/* GST Number */}
          <div>
            <label htmlFor="gstNumber" className="block text-gray-700 mb-2">
              GST Number
            </label>
            <input
              id="gstNumber"
              type="text"
              value={gstNumber}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                if (value.length <= 15) {
                  setGstNumber(value);
                }
              }}
              placeholder="Enter 15-character GST Number"
              maxLength={15}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                errors.gstNumber ? 'border-red-600' : 'border-gray-300'
              }`}
            />
            {errors.gstNumber && <p className="text-red-600 text-sm mt-1">{errors.gstNumber}</p>}
          </div>

          {/* Form-level error */}
          {errors.form && <p className="text-red-600 text-sm">{errors.form}</p>}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}