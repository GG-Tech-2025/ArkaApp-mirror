import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Order } from "../types";
import { Popup } from "../../components/Popup";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDelivery } from "../hooks/useDelivery";
import { validateDelivery } from "../validators/delivery.validator";
import { DeliveryInput, PaymentStatus } from "../types";
import { TIME_SLOTS } from "../constants/timeSlots";

export function DeliveryEntry() {
  const navigate = useNavigate();
  const { orderId } = useParams(); // used later for API fetching

  if (!orderId) {
    return <div>Order not found</div>;
  }

  const { 
    updateDelivery, 
    loading, 
    error, 
    loadmen, 
    order,
    deliveryInput,
    selectedLoadmen,
    updateDeliveryInput,
    selectLoadman,
    deselectLoadman,
    handleLoadManToggle
  } = useDelivery(orderId);

  const isDelivered = order?.delivered === true;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);

  // Get today's date in YYYY-MM-DD format for max attribute
  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async () => {
    console.log("Submitting delivery:", deliveryInput);
    const validationErrors = validateDelivery(deliveryInput);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    try {
      await updateDelivery();
      setShowSuccessPopup(true);
    } catch {
      setShowFailurePopup(true);
    }
  };

  const handlePopupClose = () => {
    setShowSuccessPopup(false);
    navigate("/employee/home");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/employee/orders")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Orders
          </button>
          <h1 className="text-gray-900">Delivery Entry</h1>
          <p className="text-gray-600 mt-1">{isDelivered ? 'View delivery information' : 'Enter the delivery details'}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Delivered badge */}
            {isDelivered && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-700 mb-1">Customer: {order?.customers?.name}</p>
                <p className="text-gray-600 text-sm">Phone: {order?.customers?.phone}</p>
                <p className="text-gray-600 text-sm mt-2">
                  <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                    Delivered
                  </span>
                </p>
              </div>
            )}

            {/* Read-only notice for delivered orders */}
            {isDelivered && (
              <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                This order has been delivered and cannot be edited.
              </div>
            )}

            {/* Order ID */}
            <div>
              <label htmlFor="orderId" className="block text-gray-700 mb-2">
                Order ID
              </label>
              <input
                id="orderId"
                type="text"
                value={order?.id}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Customer Number */}
            <div>
              <label
                htmlFor="customerNumber"
                className="block text-gray-700 mb-2"
              >
                Customer Number
              </label>
              <input
                id="customerNumber"
                type="text"
                value={order?.customers?.phone || ""}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Customer Name */}
            <div>
              <label
                htmlFor="customerName"
                className="block text-gray-700 mb-2"
              >
                Customer Name
              </label>
              <input
                id="customerName"
                type="text"
                value={order?.customers?.name || ""}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-gray-700 mb-2">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={order?.delivery_date || ""}
                disabled
                max={today}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Time */}
            <div>
              <label htmlFor="time" className="block text-gray-700 mb-2">
                Time <span className="text-red-600">*</span>
              </label>
              <select
                id="time"
                value={deliveryInput?.time || ""}
                onChange={(e) => updateDeliveryInput("time", e.target.value)}
                disabled={isDelivered}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              >
                <option value="">Select Time</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              {errors.time && (
                <p className="text-red-600 text-sm mt-1">{errors.time}</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className="block text-gray-700 mb-2">
                Quantity (bricks) <span className="text-red-600">*</span>
              </label>
              <input
                id="quantity"
                type="number"
                value={deliveryInput?.quantity || ""}
                onChange={(e) => updateDeliveryInput("quantity", parseInt(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                disabled={isDelivered}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                min="0"
              />
              {errors.quantity && (
                <p className="text-red-600 text-sm mt-1">{errors.quantity}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-gray-700 mb-2">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={order?.location}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Actual Amount */}
            <div>
              <label
                htmlFor="actualAmount"
                className="block text-gray-700 mb-2"
              >
                Actual Amount
              </label>
              <input
                id="actualAmount"
                type="text"
                value={`₹${order?.final_price}`}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* GST Number */}
            <div>
              <label htmlFor="gstNumber" className="block text-gray-700 mb-2">
                GST Number
              </label>
              <input
                id="gstNumber"
                type="text"
                value={deliveryInput?.gstNumber || ""}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Delivery Challan Number */}
            <div>
              <label
                htmlFor="deliveryChallanNumber"
                className="block text-gray-700 mb-2"
              >
                Delivery Challan Number <span className="text-red-600">*</span>
              </label>
              <input
                id="deliveryChallanNumber"
                type="text"
                value={deliveryInput?.deliveryChallanNumber || ""}
                onChange={(e) => updateDeliveryInput("deliveryChallanNumber", e.target.value)}
                placeholder="Enter delivery challan number"
                disabled={isDelivered}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.deliveryChallanNumber
                    ? "border-red-500"
                    : "border-gray-300"
                } ${isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
              {errors.deliveryChallanNumber && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.deliveryChallanNumber}
                </p>
              )}
            </div>

            {/* Load Man - Multi-select */}
            <div>
              <label className="block text-gray-700 mb-2">
                Load Man <span className="text-red-600">*</span>
              </label>
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="space-y-2">
                  {loadmen.map((loadMan) => (
                    <label
                      key={loadMan.id}
                      className={`flex items-center gap-3 p-2 rounded ${isDelivered ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLoadmen.some(loadman => loadman.id === loadMan.id)}
                        onChange={() => !isDelivered && handleLoadManToggle(loadMan.id)}
                        disabled={isDelivered}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-900">{loadMan.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {errors.loadMen && (
                <p className="text-red-600 text-sm mt-1">{errors.loadMen}</p>
              )}
              {selectedLoadmen.length > 0 && (
                <p className="text-gray-600 text-sm mt-2">
                  Selected: {selectedLoadmen.map(l => l.name).join(", ")}
                </p>
              )}
            </div>

            {/* Submit Button - hidden for delivered orders */}
            {!isDelivered && (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg transition-colors
               hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400
               disabled:cursor-not-allowed"
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Delivery Entry Successful"
          message="Delivery details have been recorded successfully."
          onClose={handlePopupClose}
          type="success"
        />
      )}

      {showFailurePopup && (
        <Popup
          title="Delivery Entry Failed"
          message={error ?? ""}
          onClose={() => setShowFailurePopup(false)}
          type="error"
        />
      )}
    </div>
  );
}
