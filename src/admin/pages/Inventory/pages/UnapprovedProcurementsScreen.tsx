import React, { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';

import { Popup } from '../../../../components/Popup';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useAllUnapprovedProcurements } from '../../../hooks/useProcurementsWithFilters';
import { approveProcurement, deleteProcurement } from '../../../../services/middleware.service';
import { ProcurementWithDetails } from '../../../../services/middleware.service';

export function UnapprovedProcurementsScreen() {
  const {goBack} = useAdminNavigation();
  const [selectedProcurement, setSelectedProcurement] = useState<ProcurementWithDetails | null>(null);
  const [rate, setRate] = useState('');
  const [showApprovalPopup, setShowApprovalPopup] = useState(false);
  const [showRejectionPopup, setShowRejectionPopup] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch ALL unapproved procurements (no date filter)
  const { 
    procurements, 
    loading, 
    error, 
    showError, 
    closeError, 
    refetch 
  } = useAllUnapprovedProcurements();

  const handleToggleClick = (procurement: ProcurementWithDetails) => {
    setSelectedProcurement(procurement);
    setRate('');
  };

  const handleCloseModal = () => {
    setSelectedProcurement(null);
    setRate('');
  };

  const handleApprove = async () => {
    if (selectedProcurement && rate && !isSubmitting) {
      setIsSubmitting(true);
      try {
        const totalPrice = calculateTotalPrice();
        await approveProcurement(selectedProcurement.id, parseFloat(rate), parseFloat(totalPrice));
        
        setApprovalMessage(`Procurement has been approved successfully.`);
        setShowApprovalPopup(true);
        setSelectedProcurement(null);
        setRate('');
        
        // Refetch the procurements list to remove the approved item
        if (refetch) {
          await refetch();
        }
      } catch (err) {
        console.error('Failed to approve procurement', err);
        setApprovalMessage('Failed to approve procurement. Please try again.');
        setShowApprovalPopup(true);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleReject = async () => {
    if (selectedProcurement && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await deleteProcurement(selectedProcurement.id);
        
        setApprovalMessage(`Procurement has been rejected and deleted.`);
        setShowRejectionPopup(true);
        setSelectedProcurement(null);
        setRate('');
        
        // Refetch the procurements list to remove the rejected item
        if (refetch) {
          await refetch();
        }
      } catch (err) {
        console.error('Failed to reject procurement', err);
        setApprovalMessage('Failed to reject procurement. Please try again.');
        setShowRejectionPopup(true);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const calculateTotalPrice = () => {
    if (!selectedProcurement || !rate) return '0.00';
    
    const rateValue = parseFloat(rate);
    
    if (isNaN(rateValue)) return '0.00';
    
    return (selectedProcurement.quantity * rateValue).toFixed(2);
  };

  const getDisplayUnit = () => {
    const materialName = getMaterialName().toLowerCase();
    
    if (materialName.includes('cement')) {
      return 'Bags';
    } else if (materialName.includes('crusher')) {
      return 'Units';
    }
    // Wet Ash, Marble Powder, Fly Ash
    return 'Tons';
  };

  const getPriceLabel = () => {
    const materialName = getMaterialName().toLowerCase();
    
    if (materialName.includes('cement')) {
      return 'Price per Bag';
    } else if (materialName.includes('crusher')) {
      return 'Price per Unit';
    }
    // Wet Ash, Marble Powder, Fly Ash
    return 'Price per Ton';
  };

  const getMaterialName = () => {
    if (selectedProcurement?.materials) {
      // Handle both object and array cases
      const material = Array.isArray(selectedProcurement.materials) 
        ? selectedProcurement.materials[0] 
        : selectedProcurement.materials;
      return material.name || 'N/A';
    }
    return 'N/A';
  };

  const getMaterialUnit = () => {
    if (selectedProcurement?.materials) {
      // Handle both object and array cases
      const material = Array.isArray(selectedProcurement.materials) 
        ? selectedProcurement.materials[0] 
        : selectedProcurement.materials;
      return material?.unit || '';
    }
    return '';
  };

  const getVendorName = () => {
    if (selectedProcurement?.vendors) {
      // Handle both object and array cases
      const vendor = Array.isArray(selectedProcurement.vendors) 
        ? selectedProcurement.vendors[0] 
        : selectedProcurement.vendors;
      return vendor?.name || 'N/A';
    }
    return 'N/A';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('inventory')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Inventory Management
          </button>

          <div>
            <h1 className="text-gray-900">Unapproved Procurements</h1>
            <p className="text-gray-600 mt-1">Review and approve pending procurement requests</p>
          </div>
        </div>

        {/* Procurement List */}
        <div className="bg-white rounded-lg shadow-lg">
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading procurements...</p>
              </div>
            ) : procurements.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No unapproved procurements for this period</p>
              </div>
            ) : (
              <div className="space-y-4">
                {procurements.map((procurement) => (
                  <div
                    key={procurement.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                        <div>
                          <p className="text-gray-500 text-sm">Material</p>
                          <p className="text-gray-900">{procurement.materials?.name ? procurement.materials.name : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Date</p>
                          <p className="text-gray-900">{new Date(procurement.date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Vendor</p>
                          <p className="text-gray-900">{procurement.vendors?.name ? procurement.vendors.name : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Quantity</p>
                          <p className="text-gray-900">{procurement.quantity} {procurement.materials?.unit || ''}</p>
                        </div>
                      </div>

                      {/* Toggle Button */}
                      <button
                        onClick={() => handleToggleClick(procurement)}
                        className="relative inline-flex items-center h-6 w-11 rounded-full bg-gray-300 transition-colors hover:bg-gray-400"
                        aria-label="Approve procurement"
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      {selectedProcurement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Close Icon */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-6">Approve Procurement</h2>

            <div className="space-y-4">
              {/* Material - Pre-populated */}
              <div>
                <label className="block text-gray-700 mb-2">Material</label>
                <input
                  type="text"
                  value={getMaterialName()}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Date - Pre-populated */}
              <div>
                <label className="block text-gray-700 mb-2">Date</label>
                <input
                  type="text"
                  value={selectedProcurement ? new Date(selectedProcurement.date).toLocaleDateString() : ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Vendor - Pre-populated */}
              <div>
                <label className="block text-gray-700 mb-2">Vendor</label>
                <input
                  type="text"
                  value={getVendorName()}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Quantity - Pre-populated */}
              <div>
                <label className="block text-gray-700 mb-2">Quantity</label>
                <input
                  type="text"
                  value={selectedProcurement ? `${selectedProcurement.quantity} ${getDisplayUnit()}` : ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Rate - Input field */}
              <div>
                <label htmlFor="rate" className="block text-gray-700 mb-2">
                  {getPriceLabel()} <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 py-3 bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg text-gray-700">
                    ₹
                  </span>
                  <input
                    id="rate"
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder={`Enter price per ${getDisplayUnit().toLowerCase()}`}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    step="0.01"
                    min="0.01"
                  />
                </div>
              </div>

              {/* Total Price - Calculated */}
              <div>
                <label className="block text-gray-700 mb-2">Total Price</label>
                <input
                  type="text"
                  value={`₹${parseFloat(calculateTotalPrice()).toLocaleString()}`}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!rate || isSubmitting}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    rate && !isSubmitting
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Success Popup */}
      {showApprovalPopup && (
        <Popup
          title="Procurement Approved"
          message={approvalMessage}
          onClose={() => setShowApprovalPopup(false)}
          type="success"
        />
      )}

      {/* Rejection Success Popup */}
      {showRejectionPopup && (
        <Popup
          title="Procurement Rejected"
          message={approvalMessage}
          onClose={() => setShowRejectionPopup(false)}
          type="error"
        />
      )}

      {/* Error Popup */}
      {showError && error && (
        <Popup
          title="Error"
          message={error}
          onClose={closeError}
          type="error"
        />
      )}
    </div>
  );
}