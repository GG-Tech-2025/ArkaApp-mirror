import React, { useState, useEffect } from 'react';
import { AdminScreen } from '../../../../AdminApp';
import { ArrowLeft, Save } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { CreateExpenseTypePopup } from './CreateExpenseTypePopup';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import {
  getExpenseTypes,
  getExpenseSubtypes,
  getAccounts,
  createExpense,
} from '../../../../services/middleware.service';

interface ExpenseType {
  id: string;
  name: string;
}

interface ExpenseSubtype {
  id: string;
  name: string;
  type_id: string;
}

interface Account {
  id: string;
  account_number: string;
  is_cash: boolean;
}

export function CreateExpenseScreen() {
  const { goBack, exitTo, goTo } = useAdminNavigation();

  // Form data
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: '',
    typeId: '',
    subtype: '',
    subtypeId: '',
    amount: '',
    comments: '',
    modeOfPayment: 'UPI' as 'UPI' | 'Bank Transfer' | 'Cheque' | 'Cash',
    sai: '',
    saiId: '',
  });

  // UI states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPopup, setShowPopup] = useState(false);
  const [popupStatus, setPopupStatus] = useState<'success' | 'error'>('success');
  const [popupMessage, setPopupMessage] = useState('');
  const [showCreateTypePopup, setShowCreateTypePopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noTypesWarning, setNoTypesWarning] = useState(false);
  const [noSubtypesWarning, setNoSubtypesWarning] = useState(false);

  // DB data
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [expenseSubtypes, setExpenseSubtypesData] = useState<ExpenseSubtype[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Filter accounts to exclude CASH for non-cash payment modes
  const nonCashAccounts = accounts.filter((a) => !a.is_cash);

  // Load expense types and accounts on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [typesData, accountsData] = await Promise.all([
          getExpenseTypes(),
          getAccounts(),
        ]);
        setExpenseTypes(typesData);
        setAccounts(accountsData);

        // Check if there are no types
        if (typesData.length === 0) {
          setNoTypesWarning(true);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setPopupMessage('Failed to load form data');
        setPopupStatus('error');
        setShowPopup(true);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Load subtypes when type changes
  useEffect(() => {
    const loadSubtypes = async () => {
      if (!formData.typeId) {
        setExpenseSubtypesData([]);
        setNoSubtypesWarning(false);
        return;
      }
      try {
        const subtypesData = await getExpenseSubtypes(formData.typeId);
        setExpenseSubtypesData(subtypesData);

        // Check if there are no subtypes for this type
        if (subtypesData.length === 0) {
          setNoSubtypesWarning(true);
        } else {
          setNoSubtypesWarning(false);
        }
      } catch (err) {
        console.error('Failed to load subtypes:', err);
      }
    };

    loadSubtypes();
  }, [formData.typeId]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.typeId) newErrors.type = 'Type is required';
    if (!formData.subtypeId) newErrors.subtype = 'Subtype is required';
    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }
    if (!formData.comments.trim()) newErrors.comments = 'Comments are required';
    if (formData.comments.length > 100) {
      newErrors.comments = 'Comments cannot exceed 100 characters';
    }
    if (!formData.modeOfPayment) newErrors.modeOfPayment = 'Mode of Payment is required';

    // SAI is only required when mode is not Cash
    if (formData.modeOfPayment !== 'Cash') {
      if (!formData.saiId) newErrors.sai = 'Account is required for non-cash payment';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      try {
        setSaving(true);

        // Map payment mode to DB format
        const paymentModeMap: Record<
          string,
          'CASH' | 'UPI' | 'BANK' | 'CHEQUE'
        > = {
          Cash: 'CASH',
          UPI: 'UPI',
          'Bank Transfer': 'BANK',
          Cheque: 'CHEQUE',
        };

        const payload = {
          expense_date: formData.date,
          type_id: formData.typeId,
          subtype_id: formData.subtypeId,
          amount: Number(formData.amount),
          payment_mode: paymentModeMap[formData.modeOfPayment],
          sender_account_id:
            formData.modeOfPayment === 'Cash' ? undefined : formData.saiId,
          comments: formData.comments,
        };

        await createExpense(payload);

        setPopupMessage('Expense successfully added!');
        setPopupStatus('success');
        setShowPopup(true);
      } catch (err) {
        console.error('Error creating expense:', err);
        setPopupMessage('Failed to add expense. Please try again.');
        setPopupStatus('error');
        setShowPopup(true);
      } finally {
        setSaving(false);
      }
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    if (popupStatus === 'success') {
      exitTo('/admin/accounts');
    }
  };

  const handleTypeChange = (typeId: string) => {
    const selectedType = expenseTypes.find((t) => t.id === typeId);
    setFormData({
      ...formData,
      typeId: typeId,
      type: selectedType?.name || '',
      subtypeId: '',
      subtype: '',
    });
    setErrors({ ...errors, type: '' });
  };

  const handleSubtypeChange = (subtypeId: string) => {
    const selectedSubtype = expenseSubtypes.find((s) => s.id === subtypeId);
    setFormData({
      ...formData,
      subtypeId: subtypeId,
      subtype: selectedSubtype?.name || '',
    });
    setErrors({ ...errors, subtype: '' });
  };

  const handleTypeCreatedFromPopup = (typeName: string) => {
    // Reload types after new one is created
    const loadTypes = async () => {
      try {
        const typesData = await getExpenseTypes();
        setExpenseTypes(typesData);
        setNoTypesWarning(false);
        const newType = typesData.find((t) => t.name === typeName);
        if (newType) {
          handleTypeChange(newType.id);
        }
      } catch (err) {
        console.error('Failed to reload types:', err);
      }
    };
    loadTypes();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-8 w-8 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
          <span className="text-lg text-gray-700 font-medium">
            Loading form...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/accounts')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Accounts
          </button>
          <h1 className="text-gray-900">Add New Expense</h1>
          <p className="text-gray-600 mt-1">Record a business expense</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Warning: No Types */}
          {noTypesWarning && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 font-medium mb-3">
                ⚠️ No Expense Types Found
              </p>
              <p className="text-yellow-700 text-sm mb-3">
                You need to create at least one expense type before you can add an expense.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateTypePopup(true)}
                className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
              >
                Create First Type
              </button>
            </div>
          )}

          {/* Warning: No Subtypes for Selected Type */}
          {noSubtypesWarning && formData.typeId && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 font-medium mb-3">
                ⚠️ No Subtypes for "{formData.type}"
              </p>
              <p className="text-yellow-700 text-sm mb-3">
                You need to create at least one subtype before you can add an expense for this type.
              </p>
              <button
                type="button"
                onClick={() => goTo('/admin/accounts/expense-subtype')}
                className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
              >
                Create First Subtype
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date */}
            <div>
              <label className="block text-gray-700 mb-2">
                Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
                style={{ colorScheme: 'light' }}
              />
              {errors.date && (
                <p className="text-red-600 text-sm mt-1">{errors.date}</p>
              )}
            </div>

            {/* Type */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700">
                  Expense Type <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCreateTypePopup(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm underline"
                >
                  Create Type
                </button>
              </div>
              <select
                value={formData.typeId}
                onChange={(e) => handleTypeChange(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.type ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select Type</option>
                {expenseTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {errors.type && (
                <p className="text-red-600 text-sm mt-1">{errors.type}</p>
              )}
            </div>

            {/* Subtype */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700">
                  Subtype <span className="text-red-600">*</span>
                </label>
                {formData.typeId && expenseSubtypes.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => goTo('/admin/accounts/expense-subtype')}
                    className="text-green-600 hover:text-green-700 text-sm font-medium underline"
                  >
                    + Create Subtype
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goTo('/admin/accounts/expense-subtype')}
                    className="text-blue-600 hover:text-blue-700 text-sm underline"
                  >
                    Create Subtype
                  </button>
                )}
              </div>
              <select
                value={formData.subtypeId}
                onChange={(e) => handleSubtypeChange(e.target.value)}
                disabled={!formData.typeId || expenseSubtypes.length === 0}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.subtype ? 'border-red-500' : 'border-gray-300'
                } ${
                  !formData.typeId || expenseSubtypes.length === 0
                    ? 'bg-gray-100 cursor-not-allowed'
                    : ''
                }`}
              >
                <option value="">
                  {!formData.typeId
                    ? 'Select a type first'
                    : expenseSubtypes.length === 0
                    ? 'No subtypes available - Create one first'
                    : 'Select Subtype'}
                </option>
                {expenseSubtypes.map((subtype) => (
                  <option key={subtype.id} value={subtype.id}>
                    {subtype.name}
                  </option>
                ))}
              </select>
              {errors.subtype && (
                <p className="text-red-600 text-sm mt-1">{errors.subtype}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-gray-700 mb-2">
                Amount (₹) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
              {errors.amount && (
                <p className="text-red-600 text-sm mt-1">{errors.amount}</p>
              )}
            </div>

            {/* Comments */}
            <div>
              <label className="block text-gray-700 mb-2">
                Comments <span className="text-red-600">*</span>
              </label>
              <textarea
                value={formData.comments}
                onChange={(e) =>
                  setFormData({ ...formData, comments: e.target.value })
                }
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.comments ? 'border-red-500' : 'border-gray-300'
                }`}
                rows={3}
                placeholder="Enter comments (max 100 characters)"
                maxLength={100}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.comments && (
                  <p className="text-red-600 text-sm">{errors.comments}</p>
                )}
                <p className="text-gray-500 text-sm ml-auto">
                  {formData.comments.length}/100
                </p>
              </div>
            </div>

            {/* Mode of Payment */}
            <div>
              <label className="block text-gray-700 mb-2">
                Mode of Payment <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.modeOfPayment}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    modeOfPayment: e.target.value as any,
                    sai: '',
                    saiId: '',
                  })
                }
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.modeOfPayment ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
              {errors.modeOfPayment && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.modeOfPayment}
                </p>
              )}
            </div>

            {/* SAI - Only show if mode is not Cash */}
            {formData.modeOfPayment !== 'Cash' && (
              <div>
                <label className="block text-gray-700 mb-2">
                  Sender Account (SAI) <span className="text-red-600">*</span>
                </label>
                {nonCashAccounts.length === 0 ? (
                  <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded mb-2">
                    <strong>Account Required:</strong> Please create a non-cash account before proceeding with {formData.modeOfPayment} payment.
                  </div>
                ) : (
                  <select
                    value={formData.saiId}
                    onChange={(e) => {
                      const selectedAccount = nonCashAccounts.find(
                        (a) => a.id === e.target.value
                      );
                      setFormData({
                        ...formData,
                        saiId: e.target.value,
                        sai: selectedAccount?.account_number || '',
                      });
                      setErrors({ ...errors, sai: '' });
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.sai ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Account</option>
                    {nonCashAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_number}
                      </option>
                    ))}
                  </select>
                )}
                {errors.sai && (
                  <p className="text-red-600 text-sm mt-1">{errors.sai}</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => exitTo('/admin/accounts')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || noTypesWarning || noSubtypesWarning}
                title={
                  noTypesWarning
                    ? 'Create an expense type first'
                    : noSubtypesWarning
                    ? 'Create a subtype first'
                    : ''
                }
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Create Type Popup */}
      {showCreateTypePopup && (
        <CreateExpenseTypePopup
          onClose={() => setShowCreateTypePopup(false)}
          onTypeCreated={handleTypeCreatedFromPopup}
          existingTypes={expenseTypes.map((t) => t.name)}
        />
      )}

      {/* Success/Error Popup */}
      {showPopup && (
        <Popup
          title={popupStatus === 'success' ? 'Success' : 'Error'}
          message={popupMessage}
          onClose={handlePopupClose}
          type={popupStatus}
        />
      )}
    </div>
  );
}
