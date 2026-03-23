import React, { useState, useEffect } from 'react';
import { ArrowLeft, CalendarIcon } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { Calendar } from '../../../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../components/ui/popover';
import { format } from 'date-fns';
import { cn } from '../../../../components/ui/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { getOrderWithLoadmen, getLoadmen, updateOrderWithLoadmen } from '../../../../services/middleware.service';
import { OrderWithLoadmen, EmployeeWithCategory, Order, PaymentStatus } from '../../../../services/types';
import { validateOrderDetails } from '../../../validators/orderDetails.validator';

interface OrderDetailsInput {
  brickQuantity: number;
  deliveryDate: string;
  pricePerBrick: number;
  location: string;
  finalPrice: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  gstNumber: string | null;
  deliveryChallanNumber: string;
  loadMen: string[];
}

export type { OrderDetailsInput };

const LOAD_MEN = ['Raju Kumar', 'Suresh Yadav', 'Mohan Singh', 'Ramesh Patel', 'Gopal Reddy'];

export function OrderDetailsScreen() {
  const { goBack } = useAdminNavigation();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderWithLoadmen | null>(null);
  const [loadmen, setLoadmen] = useState<EmployeeWithCategory[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);

  const [orderDetailsInput, setOrderDetailsInput] = useState<OrderDetailsInput>({
    brickQuantity: 0,
    deliveryDate: '',
    pricePerBrick: 0,
    location: '',
    finalPrice: 0,
    paymentStatus: 'NOT_PAID',
    amountPaid: 0,
    gstNumber: null,
    deliveryChallanNumber: '',
    loadMen: [],
  });

  const [selectedLoadmen, setSelectedLoadmen] = useState<EmployeeWithCategory[]>([]);

  useEffect(() => {
    if (!orderId) {
      setError('Order ID not found');
      return;
    }
    getOrderData();
    getLoadmenData();
  }, [orderId]);

  async function getOrderData() {
    try {
      setLoading(true);
      const orderData = await getOrderWithLoadmen(orderId!);
      setOrder(orderData);

      setOrderDetailsInput({
        brickQuantity: orderData.brick_quantity,
        deliveryDate: orderData.delivery_date,
        pricePerBrick: orderData.price_per_brick || 0,
        location: orderData.location,
        finalPrice: orderData.final_price,
        paymentStatus: orderData.payment_status,
        amountPaid: orderData.amount_paid || 0,
        gstNumber: orderData.gst_number || null,
        deliveryChallanNumber: orderData.dc_number || '',
        loadMen: orderData.loadmen?.map(l => l.id) || [],
      });
    } catch (err) {
      setError('Failed to load order details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function getLoadmenData() {
    try {
      const loadmenData = await getLoadmen();
      setLoadmen(loadmenData);

      // Set selected loadmen after both order and loadmen are loaded
      if (order?.loadmen) {
        const selected = loadmenData.filter(l => order.loadmen!.some(ol => ol.id === l.id));
        setSelectedLoadmen(selected);
      }
    } catch (err) {
      setError('Failed to load loadmen details');
      console.error(err);
    }
  }

  useEffect(() => {
    if (order && loadmen.length > 0 && order.loadmen) {
      const selected = loadmen.filter(l => order.loadmen!.some(ol => ol.id === l.id));
      setSelectedLoadmen(selected);
      setOrderDetailsInput(prev => ({
        ...prev,
        loadMen: selected.map(l => l.id)
      }));
    }
  }, [order, loadmen]);

  function updateOrderDetailsInput(field: keyof OrderDetailsInput, value: any) {
    setOrderDetailsInput(prev => ({ ...prev, [field]: value }));
  }

  function handleLoadManToggle(loadMan: EmployeeWithCategory) {
    if (selectedLoadmen.some(l => l.id === loadMan.id)) {
      setSelectedLoadmen(prev => prev.filter(l => l.id !== loadMan.id));
      setOrderDetailsInput(prev => ({
        ...prev,
        loadMen: prev.loadMen.filter(id => id !== loadMan.id)
      }));
    } else {
      setSelectedLoadmen(prev => [...prev, loadMan]);
      setOrderDetailsInput(prev => ({
        ...prev,
        loadMen: [...prev.loadMen, loadMan.id]
      }));
    }
  }

  const validateForm = () => {
    const newErrors = validateOrderDetails(orderDetailsInput);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = async () => {
    if (!validateForm() || !order) return;

    try {
      setLoading(true);
      setError(null);

      let amountPaid = 0;
      if (orderDetailsInput.paymentStatus === 'PARTIALLY_PAID') {
        amountPaid = orderDetailsInput.amountPaid;
      } else if (orderDetailsInput.paymentStatus === 'FULLY_PAID') {
        amountPaid = orderDetailsInput.finalPrice;
      }

      const orderUpdate: Partial<Order> = {
        brick_quantity: orderDetailsInput.brickQuantity,
        delivery_date: orderDetailsInput.deliveryDate,
        price_per_brick: orderDetailsInput.pricePerBrick,
        location: orderDetailsInput.location,
        final_price: orderDetailsInput.finalPrice,
        payment_status: orderDetailsInput.paymentStatus,
        amount_paid: amountPaid,
        gst_number: orderDetailsInput.gstNumber || null,
        dc_number: orderDetailsInput.deliveryChallanNumber,
      };

      await updateOrderWithLoadmen(orderId!, orderUpdate, orderDetailsInput.loadMen);
      setShowSuccessPopup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
      setShowFailurePopup(true);
      console.error('Failed to update order:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePopupClose = () => {
    setShowSuccessPopup(false);
    goBack('/admin/orders');
  };

  const paperPrice = orderDetailsInput.brickQuantity && orderDetailsInput.pricePerBrick
    ? (orderDetailsInput.brickQuantity * orderDetailsInput.pricePerBrick).toFixed(2)
    : '';

  const isDelivered = order?.delivered === true;

  if (!orderId) {
    return <div className="text-center py-12">Order not found</div>;
  }

  if (loading && !order) {
    return <div className="text-center py-12">Loading order details...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <Popup title="Error" message={error} onClose={() => setError(null)} type="error" />
      )}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/orders')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back 
          </button>
          <h1 className="text-gray-900">Order Details</h1>
          <p className="text-gray-600 mt-1">{isDelivered ? 'View order information' : 'Edit order information'} - {order?.id}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Customer Info - Read Only */}
            {order && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-700 mb-1">Customer: {order.customers?.name}</p>
                <p className="text-gray-600 text-sm">Phone: {order.customers?.phone}</p>
                <p className="text-gray-600 text-sm">Order Date: {new Date(order.order_date).toLocaleDateString()}</p>
                {order.delivered && (
                  <p className="text-gray-600 text-sm mt-2">
                    <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      Delivered
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Read-only notice for delivered orders */}
            {isDelivered && (
              <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                This order has been delivered and cannot be edited.
              </div>
            )}

            {/* Brick Quantity */}
            <div>
              <label htmlFor="brickQuantity" className="block text-gray-700 mb-2">
                Brick Quantity <span className="text-red-600">*</span>
              </label>
              <input
                id="brickQuantity"
                type="number"
                value={orderDetailsInput.brickQuantity || ''}
                onChange={(e) => updateOrderDetailsInput('brickQuantity', parseInt(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                disabled={isDelivered}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                min="1"
              />
              {errors.brickQuantity && <p className="text-red-600 text-sm mt-1">{errors.brickQuantity}</p>}
            </div>

            {/* Delivery Date - Editable with Date Picker */}
            <div>
              <label htmlFor="deliveryDate" className="block text-gray-700 mb-2">
                Delivery Date <span className="text-red-600">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={isDelivered}
                    className={cn(
                      "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-left",
                      !orderDetailsInput.deliveryDate && "text-gray-400",
                      isDelivered && "bg-gray-100 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {orderDetailsInput.deliveryDate ? format(new Date(orderDetailsInput.deliveryDate), 'PPP') : 'Select delivery date'}
                      </span>
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={orderDetailsInput.deliveryDate ? new Date(orderDetailsInput.deliveryDate) : undefined}
                    onSelect={(date: Date | undefined) => {
                      if (date) {
                        updateOrderDetailsInput('deliveryDate', format(date, 'yyyy-MM-dd'));
                      }
                    }}
                    disabled={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.deliveryDate && <p className="text-red-600 text-sm mt-1">{errors.deliveryDate}</p>}
            </div>

            {/* Price Per Brick */}
            <div>
              <label htmlFor="pricePerBrick" className="block text-gray-700 mb-2">
                Price Per Brick <span className="text-red-600">*</span>
              </label>
              <input
                id="pricePerBrick"
                type="number"
                value={orderDetailsInput.pricePerBrick || ''}
                onChange={(e) => updateOrderDetailsInput('pricePerBrick', parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                disabled={isDelivered}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                step="0.01"
                min="0.01"
              />
              {errors.pricePerBrick && <p className="text-red-600 text-sm mt-1">{errors.pricePerBrick}</p>}
            </div>

            {/* Paper Price - Auto-calculated and disabled */}
            <div>
              <label htmlFor="paperPrice" className="block text-gray-700 mb-2">
                Paper Price
              </label>
              <input
                id="paperPrice"
                type="text"
                value={paperPrice ? `₹${parseFloat(paperPrice).toLocaleString()}` : ''}
                disabled
                placeholder="Calculated automatically"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
              <p className="text-gray-500 text-sm mt-1">
                Auto-calculated: Brick Quantity × Price Per Brick
              </p>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-gray-700 mb-2">
                Location <span className="text-red-600">*</span>
              </label>
              <input
                id="location"
                type="text"
                value={orderDetailsInput.location}
                onChange={(e) => updateOrderDetailsInput('location', e.target.value)}
                disabled={isDelivered}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              {errors.location && <p className="text-red-600 text-sm mt-1">{errors.location}</p>}
            </div>

            {/* Final Price */}
            <div>
              <label htmlFor="finalPrice" className="block text-gray-700 mb-2">
                Final Price <span className="text-red-600">*</span>
              </label>
              <input
                id="finalPrice"
                type="number"
                value={orderDetailsInput.finalPrice || ''}
                onChange={(e) => updateOrderDetailsInput('finalPrice', parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                disabled={isDelivered}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                min="0.01"
                step="0.01"
              />
              {orderDetailsInput.finalPrice && orderDetailsInput.brickQuantity && (
                <p className="text-gray-600 text-sm mt-1">
                  Price per brick: ₹{(orderDetailsInput.finalPrice / orderDetailsInput.brickQuantity).toFixed(2)}
                </p>
              )}
              {errors.finalPrice && <p className="text-red-600 text-sm mt-1">{errors.finalPrice}</p>}
            </div>

            {/* Payment Status - view only mode */}
            {isDelivered && (
              <div>
                <label htmlFor="paymentStatus" className="block text-gray-700 mb-2">
                  Payment Status
                </label>
                <select
                  id="paymentStatus"
                  value={orderDetailsInput.paymentStatus}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none bg-gray-100 cursor-not-allowed"
                >
                  <option value="NOT_PAID">Not Paid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="FULLY_PAID">Fully Paid</option>
                </select>
              </div>
            )}

            {/* Amount Paid - view only mode, shown only if PARTIALLY_PAID */}
            {isDelivered && orderDetailsInput.paymentStatus === 'PARTIALLY_PAID' && (
              <div>
                <label htmlFor="amountPaid" className="block text-gray-700 mb-2">
                  Amount Paid
                </label>
                <input
                  id="amountPaid"
                  type="number"
                  value={orderDetailsInput.amountPaid || ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none bg-gray-100 cursor-not-allowed"
                />
              </div>
            )}

            {/* GST Number */}
            <div>
              <label htmlFor="gstNumber" className="block text-gray-700 mb-2">
                GST Number
              </label>
              <input
                id="gstNumber"
                type="text"
                value={orderDetailsInput.gstNumber || ''}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  if (value.length <= 15) {
                    updateOrderDetailsInput('gstNumber', value || null);
                  }
                }}
                placeholder="Enter GST Number (15 characters)"
                maxLength={15}
                disabled={isDelivered}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.gstNumber ? 'border-red-600' : 'border-gray-300'
                } ${
                  isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              {errors.gstNumber && <p className="text-red-600 text-sm mt-1">{errors.gstNumber}</p>}
            </div>

            {/* Delivery Challan Number */}
            <div>
              <label htmlFor="deliveryChallanNumber" className="block text-gray-700 mb-2">
                Delivery Challan Number
              </label>
              <input
                id="deliveryChallanNumber"
                type="text"
                value={orderDetailsInput.deliveryChallanNumber}
                onChange={(e) => updateOrderDetailsInput('deliveryChallanNumber', e.target.value)}
                placeholder="Enter Delivery Challan Number"
                disabled={isDelivered}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.deliveryChallanNumber ? 'border-red-600' : 'border-gray-300'
                } ${
                  isDelivered ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              {errors.deliveryChallanNumber && <p className="text-red-600 text-sm mt-1">{errors.deliveryChallanNumber}</p>}
            </div>

            {/* Load Men */}
            <div>
              <label className="block text-gray-700 mb-2">
                Load Men <span className="text-red-600">*</span>
              </label>
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="space-y-2">
                  {loadmen.map((loadman) => (
                    <label
                      key={loadman.id}
                      className={`flex items-center gap-3 p-2 rounded ${
                        isDelivered ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLoadmen.some(l => l.id === loadman.id)}
                        onChange={() => !isDelivered && handleLoadManToggle(loadman)}
                        disabled={isDelivered}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-900">{loadman.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {selectedLoadmen.length > 0 && (
                <p className="text-gray-600 text-sm mt-2">
                  Selected: {selectedLoadmen.map(l => l.name).join(', ')}
                </p>
              )}
              {errors.loadMen && <p className="text-red-600 text-sm mt-1">{errors.loadMen}</p>}
            </div>

            {/* Confirm Button - hidden for delivered orders */}
            {!isDelivered && (
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Confirm'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Order Edited Successfully"
          message="The order has been updated successfully."
          onClose={handlePopupClose}
          type="success"
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && (
        <Popup
          title="Update Failed"
          message={error || 'Failed to update order. Please try again.'}
          onClose={() => setShowFailurePopup(false)}
          type="error"
        />
      )}
    </div>
  );
}