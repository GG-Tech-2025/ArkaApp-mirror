import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CalendarIcon } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { CustomerCreationModal } from '../../../../components/admin/CustomerCreationModal';
import { Calendar } from '../../../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../components/ui/popover';
import { format } from 'date-fns';
import { cn } from '../../../../components/ui/utils';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useNavigate } from 'react-router-dom';
import { validateCreateOrder } from '../../../validators/createOrder.validator';
import { searchCustomers, getLoadmen, createOrder, validateSession, getUserProfile } from '../../../../services/middleware.service';
import { Customer, EmployeeWithCategory } from '../../../../services/types';

export interface CreateOrderInput {
  customerId: string;
  customerName: string;
  customerPhone: string;
  brickQuantity: number;
  deliveryDate: string;
  pricePerBrick: number;
  location: string;
  finalPrice: number;
  paymentStatus: 'NOT_PAID' | 'PARTIALLY_PAID' | 'FULLY_PAID';
  amountPaid: number;
  gstNumber: string | null;
  deliveryChallanNumber: string;
  loadMen: string[];
}

export function CreateOrderScreen() {
  const { goBack } = useAdminNavigation();
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [showSessionInvalidPopup, setShowSessionInvalidPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadmen, setLoadmen] = useState<EmployeeWithCategory[]>([]);

  const [createOrderInput, setCreateOrderInput] = useState<CreateOrderInput>({
    customerId: '',
    customerName: '',
    customerPhone: '',
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

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced customer search with proper timeout clearing
  useEffect(() => {
    // Clear previous timeout if it exists
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (customerSearch.trim().length > 0) {
      // Set new timeout
      debounceTimerRef.current = setTimeout(async () => {
        try {
          setSearchLoading(true);
          const customers = await searchCustomers(customerSearch);
          setFilteredCustomers(customers);
        } catch (err) {
          console.error('Failed to search customers:', err);
          setFilteredCustomers([]);
        } finally {
          setSearchLoading(false);
        }
      }, 1500);
    } else {
      setFilteredCustomers([]);
    }

    // Cleanup: clear timeout when component unmounts or dependency changes
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [customerSearch]);

  // Fetch loadmen once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getLoadmen();
        if (mounted) setLoadmen(res);
      } catch (err) {
        console.error('Failed to load loadmen:', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function updateCreateOrderInput(field: keyof CreateOrderInput, value: any) {
    setCreateOrderInput(prev => ({ ...prev, [field]: value }));
  }

  function handleSelectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    // Update customer info in a single state update
    setCreateOrderInput(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone.toString(),
      gstNumber: customer.gst_number || prev.gstNumber,
    }));
  }

  function handleLoadManToggle(loadMan: string) {
    setCreateOrderInput(prev => ({
      ...prev,
      loadMen: prev.loadMen.includes(loadMan)
        ? prev.loadMen.filter(m => m !== loadMan)
        : [...prev.loadMen, loadMan]
    }));
  }

  const validateForm = () => {
    const newErrors = validateCreateOrder(createOrderInput);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // determine amount_paid based on payment status
      let amountPaid = 0;
      if (createOrderInput.paymentStatus === 'PARTIALLY_PAID') {
        amountPaid = createOrderInput.amountPaid;
      } else if (createOrderInput.paymentStatus === 'FULLY_PAID') {
        amountPaid = createOrderInput.finalPrice;
      }

      // build payload matching service CreateOrderInput
      const payload = {
        customer_id: createOrderInput.customerId,
        order_date: orderDate,
        delivery_date: createOrderInput.deliveryDate,
        brick_quantity: createOrderInput.brickQuantity,
        price_per_brick: createOrderInput.pricePerBrick || undefined,
        paper_price: createOrderInput.brickQuantity && createOrderInput.pricePerBrick ? Number((createOrderInput.brickQuantity * createOrderInput.pricePerBrick).toFixed(2)) : undefined,
        final_price: createOrderInput.finalPrice,
        location: createOrderInput.location,
        payment_status: createOrderInput.paymentStatus,
        amount_paid: amountPaid,
        gst_number: createOrderInput.gstNumber || null,
        dc_number: createOrderInput.deliveryChallanNumber || null,
      };

      // validate session and role
      const user = await validateSession();
      if (!user) {
        setShowSessionInvalidPopup(true);
        return;
      }

      const profile = await getUserProfile(user.id);
      if (profile.role !== 'ADMIN') {
        setShowSessionInvalidPopup(true);
        return;
      }

      const createdBy = user.id;

      await createOrder(payload as any, createOrderInput.loadMen, createdBy);
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Failed to create order:', err);
      setErrors(prev => ({ ...prev, form: (err as Error).message || 'Failed to create order' }));
      setShowFailurePopup(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePopupClose = () => {
    setShowSuccessPopup(false);
    goBack('/admin/orders');
  };

  // Calculate paper price automatically
  const paperPrice = createOrderInput.brickQuantity && createOrderInput.pricePerBrick
    ? (createOrderInput.brickQuantity * createOrderInput.pricePerBrick).toFixed(2)
    : '';

  const orderDate = new Date().toISOString().split('T')[0];

  

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/orders')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Orders
          </button>
          <h1 className="text-gray-900">Create Order</h1>
          <p className="text-gray-600 mt-1">Create a new customer order</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* Customer Search */}
            <div>
              <label htmlFor="customer" className="block text-gray-700 mb-2">
                Customer <span className="text-red-600">*</span>
              </label>
              <input
                id="customer"
                type="text"
                value={selectedCustomer ? `${selectedCustomer.phone}, ${selectedCustomer.name}` : customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setSelectedCustomer(null);
                  updateCreateOrderInput('customerId', '');
                  updateCreateOrderInput('customerName', '');
                  updateCreateOrderInput('customerPhone', '');
                }}
                placeholder="Search by phone number or name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {customerSearch && !selectedCustomer && (filteredCustomers.length > 0 || searchLoading) && (
                <div className="mt-2 border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {searchLoading ? (
                    <div className="px-4 py-2 text-gray-500 text-sm">Searching customers...</div>
                  ) : filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        {customer.phone}, {customer.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-500 text-sm">No customers found</div>
                  )}
                </div>
              )}
              <p className="text-gray-600 text-sm mt-2">
                Need to add customer?{' '}
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="text-blue-600 hover:underline"
                >
                  Go to create customer
                </button>
              </p>
              {errors.customer && <p className="text-red-600 text-sm mt-1">{errors.customer}</p>}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-gray-700 mb-2">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={orderDate}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed outline-none"
              />
            </div>

            {/* Brick Quantity */}
            <div>
              <label htmlFor="brickQuantity" className="block text-gray-700 mb-2">
                Brick Quantity <span className="text-red-600">*</span>
              </label>
              <input
                id="brickQuantity"
                type="number"
                value={createOrderInput.brickQuantity || ''}
                onChange={(e) => updateCreateOrderInput('brickQuantity', parseInt(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter quantity"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="1"
              />
              {errors.brickQuantity && <p className="text-red-600 text-sm mt-1">{errors.brickQuantity}</p>}
            </div>

            {/* Delivery Date */}
            <div>
              <label htmlFor="deliveryDate" className="block text-gray-700 mb-2">
                Delivery Date <span className="text-red-600">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-left",
                      !createOrderInput.deliveryDate && "text-gray-400"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {createOrderInput.deliveryDate ? format(new Date(createOrderInput.deliveryDate), 'PPP') : 'Select delivery date'}
                      </span>
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={createOrderInput.deliveryDate ? new Date(createOrderInput.deliveryDate) : undefined}
                    onSelect={(date: Date | undefined) => {
                      if (date) {
                        updateCreateOrderInput('deliveryDate', format(date, 'yyyy-MM-dd'));
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
                value={createOrderInput.pricePerBrick || ''}
                onChange={(e) => updateCreateOrderInput('pricePerBrick', parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter price per brick"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                value={createOrderInput.location}
                onChange={(e) => updateCreateOrderInput('location', e.target.value)}
                placeholder="Enter delivery location"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                value={createOrderInput.finalPrice || ''}
                onChange={(e) => updateCreateOrderInput('finalPrice', parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter final price"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="0.01"
                step="0.01"
              />
              {createOrderInput.finalPrice > 0 && createOrderInput.brickQuantity > 0 && (
                <p className="text-gray-600 text-sm mt-1">
                  Price per brick: ₹{(createOrderInput.finalPrice / createOrderInput.brickQuantity).toFixed(2)}
                </p>
              )}
              {errors.finalPrice && <p className="text-red-600 text-sm mt-1">{errors.finalPrice}</p>}
            </div>

            {/* GST Number */}
            <div>
              <label htmlFor="gstNumber" className="block text-gray-700 mb-2">
                GST Number
              </label>
              <input
                id="gstNumber"
                type="text"
                value={createOrderInput.gstNumber || ''}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  if (value.length <= 15) {
                    updateCreateOrderInput('gstNumber', value || null);
                  }
                }}
                placeholder="Enter GST Number"
                maxLength={15}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.gstNumber ? 'border-red-600' : 'border-gray-300'
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
                value={createOrderInput.deliveryChallanNumber}
                onChange={(e) => updateCreateOrderInput('deliveryChallanNumber', e.target.value)}
                placeholder="Enter Delivery Challan Number"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.deliveryChallanNumber ? 'border-red-600' : 'border-gray-300'
                }`}
              />
              {errors.deliveryChallanNumber && <p className="text-red-600 text-sm mt-1">{errors.deliveryChallanNumber}</p>}
            </div>

            {/* Load Men - Multi-select */}
            <div>
              <label className="block text-gray-700 mb-2">Load Men (Optional)</label>
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="space-y-2">
                  {loadmen.length > 0 ? loadmen.map((lm) => (
                    <label
                      key={lm.id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={createOrderInput.loadMen.includes(lm.id)}
                        onChange={() => handleLoadManToggle(lm.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-900">{lm.name}</span>
                    </label>
                  )) : (
                    <div className="text-gray-500 text-sm">No loadmen available</div>
                  )}
                </div>
              </div>
              {createOrderInput.loadMen.length > 0 && (
                <p className="text-gray-600 text-sm mt-2">
                  Selected: {createOrderInput.loadMen.join(', ')}
                </p>
              )}
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Order Placed Successfully"
          message="The order has been created successfully."
          onClose={handlePopupClose}
          type="success"
        />
      )}

      {/* Failure Popup */}
      {showFailurePopup && Object.keys(errors).every(k => k === 'form') && (
        <Popup
          title="Creation Failed"
          message={errors.form || 'Failed to create order. Please try again.'}
          onClose={() => setShowFailurePopup(false)}
          type="error"
        />
      )}

      {/* Session Invalid Popup */}
      {showSessionInvalidPopup && (
        <Popup
          title="Session Invalid"
          message="Your session is invalid or you do not have permission. Please log in as an admin."
          onClose={() => { setShowSessionInvalidPopup(false); navigate('/admin/login'); }}
          type="error"
        />
      )}

      {/* Customer Creation Modal */}
      {showCustomerModal && (
        <CustomerCreationModal onClose={() => setShowCustomerModal(false)} />
      )}
    </div>
  );
}