import { useState } from 'react';
import { ArrowLeft, Settings, Save, X, AlertCircle } from 'lucide-react';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useAppSettings } from '../../../hooks/useAppSettings';
import { validateUpdateSetting } from '../../../validators/updateSetting.validator';
import { Popup } from '../../../../components/Popup';

export function SettingsManagementScreen() {
  const { goBack } = useAdminNavigation();
  const { settings, loading, error, showError, closeError, updateSetting } = useAppSettings();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleEditClick = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
    setValidationError(null);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
    setValidationError(null);
  };

  const handleSave = async (key: string) => {
    // Validate
    const validation = validateUpdateSetting({ value: editValue });
    if (!validation.isValid) {
      setValidationError(validation.errors.value || 'Invalid value');
      return;
    }

    try {
      setSaving(true);
      await updateSetting(key, editValue);
      setEditingKey(null);
      setEditValue('');
      setValidationError(null);
      setShowSuccessPopup(true);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to update setting';
      setErrorMessage(errMsg);
      setShowErrorPopup(true);
    } finally {
      setSaving(false);
    }
  };

  const formatKey = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/home')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
          
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-gray-500 to-gray-600 p-3 rounded-lg">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-gray-900">App Settings</h1>
              <p className="text-gray-600 mt-1">Configure application parameters</p>
            </div>
          </div>
        </div>

        {/* Settings List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6">
            {loading && settings.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-600">Loading settings...</p>
              </div>
            ) : settings.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-600">No settings available.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {settings.map((setting) => {
                  const isEditing = editingKey === setting.key;
                  
                  return (
                    <div
                      key={setting.id}
                      className="border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {formatKey(setting.key)}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            {setting.description}
                          </p>
                          
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => {
                                    setEditValue(e.target.value);
                                    setValidationError(null);
                                  }}
                                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                    validationError ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  placeholder="Enter value"
                                  autoFocus
                                />
                              </div>
                              {validationError && (
                                <div className="flex items-center gap-2 text-red-600 text-sm">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>{validationError}</span>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSave(setting.key)}
                                  disabled={saving}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                  <Save className="w-4 h-4" />
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={saving}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500">Current Value:</span>
                                <span className="text-lg font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded">
                                  {setting.value}
                                </span>
                              </div>
                              <button
                                onClick={() => handleEditClick(setting.key, setting.value)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                          Last updated: {new Date(setting.updated_at).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Popup from fetch */}
      {showError && error && (
        <Popup
          title="Error Loading Settings"
          message={error}
          onClose={closeError}
          type="error"
        />
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Setting Updated"
          message="The setting has been updated successfully."
          onClose={() => setShowSuccessPopup(false)}
          type="success"
        />
      )}

      {/* Error Popup from update */}
      {showErrorPopup && (
        <Popup
          title="Update Failed"
          message={errorMessage}
          onClose={() => {
            setShowErrorPopup(false);
            setErrorMessage('');
          }}
          type="error"
        />
      )}
    </div>
  );
}
