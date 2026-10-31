import React, { useState } from 'react';
import { AdminScreen, Employee } from '../../AdminApp';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, User, Calendar, Package, DollarSign, Clock } from 'lucide-react';
import { Popup } from '../Popup';

interface ProcurementRequestDetailScreenProps {
  onNavigate: (screen: AdminScreen) => void;
  requestId: string;
}

interface ProcurementRequestDetail {
  id: string;
  material: string;
  quantity: number;
  unit: string;
  requestDate: string;
  requestedBy: Employee;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvalDate?: string;
  rejectionReason?: string;
  vendorName: string;
  vendorId: string;
  estimatedCost?: number;
  urgency: 'Low' | 'Medium' | 'High';
  requiredByDate: string;
  notes?: string;
  currentStock: number;
  minThreshold: number;
}

// Mock data
const MOCK_REQUEST: ProcurementRequestDetail = {
  id: 'PR-001',
  material: 'Fly Ash',
  quantity: 5000,
  unit: 'Kg',
  requestDate: '2025-12-08T10:30:00',
  requestedBy: {
    id: 'EMP-001',
    name: 'Ramesh Kumar',
    phoneNumber: '9876543210',
    bloodGroup: 'O+',
    aadharNumber: '123456789012',
    permanentAddress: 'Mumbai, Maharashtra',
    role: 'Procurement Manager',
    category: 'Fixed Salary',
    isActive: true
  },
  status: 'Pending',
  vendorName: 'ABC Suppliers',
  vendorId: 'V001',
  estimatedCost: 50000,
  urgency: 'High',
  requiredByDate: '2025-12-15',
  notes: 'Urgent requirement for upcoming production batch. Current stock critically low.',
  currentStock: 3000,
  minThreshold: 5000
};

export function ProcurementRequestDetailScreen({ onNavigate, requestId }: ProcurementRequestDetailScreenProps) {
  const [request] = useState<ProcurementRequestDetail>(MOCK_REQUEST);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState<'success' | 'error'>('success');
  const [popupMessage, setPopupMessage] = useState('');

  const handleApprove = () => {
    // Simulate API call
    const success = Math.random() > 0.1;
    
    if (success) {
      setPopupType('success');
      setPopupMessage(`Procurement request ${request.id} has been approved successfully. Vendor will be notified.`);
      setShowPopup(true);
      setShowApproveDialog(false);
      
      setTimeout(() => {
        setShowPopup(false);
        onNavigate('inventory');
      }, 2500);
    } else {
      setPopupType('error');
      setPopupMessage('Failed to approve request. Please try again.');
      setShowPopup(true);
      setShowApproveDialog(false);
    }
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      setPopupType('error');
      setPopupMessage('Please provide a reason for rejection.');
      setShowPopup(true);
      return;
    }

    // Simulate API call
    const success = Math.random() > 0.1;
    
    if (success) {
      setPopupType('success');
      setPopupMessage(`Procurement request ${request.id} has been rejected. Requester will be notified.`);
      setShowPopup(true);
      setShowRejectDialog(false);
      
      setTimeout(() => {
        setShowPopup(false);
        onNavigate('inventory');
      }, 2500);
    } else {
      setPopupType('error');
      setPopupMessage('Failed to reject request. Please try again.');
      setShowPopup(true);
      setShowRejectDialog(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stockPercentage = (request.currentStock / request.minThreshold) * 100;
  const isStockCritical = stockPercentage < 50;
  const isStockLow = stockPercentage >= 50 && stockPercentage < 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate('inventory')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Inventory Management
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Procurement Request Details</h1>
              <p className="text-gray-600 mt-1">Request ID: {request.id}</p>
            </div>
            <span className={`px-4 py-2 rounded-lg text-sm self-start sm:self-center ${getStatusColor(request.status)}`}>
              {request.status}
            </span>
          </div>
        </div>

        {/* Stock Status Alert */}
        {(isStockCritical || isStockLow) && (
          <div className={`mb-6 border rounded-lg p-4 flex gap-3 ${
            isStockCritical ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
          }`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              isStockCritical ? 'text-red-600' : 'text-yellow-600'
            }`} />
            <div>
              <p className={`text-sm ${isStockCritical ? 'text-red-900' : 'text-yellow-900'}`}>
                {isStockCritical 
                  ? `Critical Stock Level: Current stock (${request.currentStock} ${request.unit}) is below 50% of minimum threshold (${request.minThreshold} ${request.unit})`
                  : `Low Stock Level: Current stock (${request.currentStock} ${request.unit}) is below minimum threshold (${request.minThreshold} ${request.unit})`
                }
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Material Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Material Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Material</p>
                  <p className="text-gray-900 mt-1">{request.material}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Requested Quantity</p>
                  <p className="text-gray-900 mt-1">{request.quantity.toLocaleString()} {request.unit}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Current Stock</p>
                  <p className={`mt-1 ${
                    isStockCritical ? 'text-red-600' : isStockLow ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {request.currentStock.toLocaleString()} {request.unit}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Minimum Threshold</p>
                  <p className="text-gray-900 mt-1">{request.minThreshold.toLocaleString()} {request.unit}</p>
                </div>
              </div>
            </div>

            {/* Vendor & Cost Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Vendor & Cost Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Preferred Vendor</p>
                  <p className="text-gray-900 mt-1">{request.vendorName}</p>
                  <p className="text-gray-500 text-sm">ID: {request.vendorId}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Estimated Cost</p>
                  <p className="text-gray-900 mt-1">
                    {request.estimatedCost ? `₹${request.estimatedCost.toLocaleString()}` : 'Not specified'}
                  </p>
                  {request.estimatedCost && (
                    <p className="text-gray-500 text-sm">
                      ₹{(request.estimatedCost / request.quantity).toFixed(2)}/{request.unit}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-gray-900 mb-4">Additional Information</h2>
              <div className="space-y-3">
                {request.notes && (
                  <div>
                    <p className="text-gray-600 text-sm">Notes</p>
                    <p className="text-gray-900 mt-1">{request.notes}</p>
                  </div>
                )}
                {request.status === 'Rejected' && request.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-900 text-sm">Rejection Reason</p>
                    <p className="text-red-800 mt-1">{request.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Request Details Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-gray-900 mb-4">Request Details</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-600 text-sm">Requested By</p>
                    <p className="text-gray-900">{request.requestedBy.name}</p>
                    <p className="text-gray-500 text-sm">{request.requestedBy.role}</p>
                    <p className="text-gray-500 text-sm">{request.requestedBy.phoneNumber}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-600 text-sm">Request Date</p>
                    <p className="text-gray-900">
                      {new Date(request.requestDate).toLocaleDateString()}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {new Date(request.requestDate).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-600 text-sm">Required By Date</p>
                    <p className="text-gray-900">
                      {new Date(request.requiredByDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-600 text-sm mb-2">Urgency Level</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm ${getUrgencyColor(request.urgency)}`}>
                    {request.urgency}
                  </span>
                </div>

                {request.status === 'Approved' && request.approvedBy && (
                  <>
                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-gray-600 text-sm">Approved By</p>
                      <p className="text-gray-900">{request.approvedBy}</p>
                      {request.approvalDate && (
                        <p className="text-gray-500 text-sm">
                          {new Date(request.approvalDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons (only if pending) */}
            {request.status === 'Pending' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-gray-900 mb-4">Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => setShowApproveDialog(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve Request
                  </button>
                  <button
                    onClick={() => setShowRejectDialog(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      {showApproveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-green-100 p-2 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-gray-900 mb-2 text-2xl font-semibold">Approve Procurement Request</h3>
                <p className="text-gray-600 text-sm">
                  Are you sure you want to approve this procurement request for {request.quantity.toLocaleString()} {request.unit} of {request.material}?
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  The vendor will be notified and procurement will proceed.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveDialog(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-gray-900 mb-2 text-2xl font-semibold">Reject Procurement Request</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Please provide a reason for rejecting this procurement request.
                </p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-lg"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup */}
      {showPopup && (
        <Popup
          title={popupType === 'success' ? 'Success' : 'Error'}
          message={popupMessage}
          onClose={() => setShowPopup(false)}
          type={popupType}
        />
      )}
    </div>
  );
}
