import { useEffect, useState } from "react";
import { createDelivery } from "../services/delivery.service";
import { DeliveryInput } from "../types";
import { getAllEmployees, getOrderWithLoadmen, updateOrderWithLoadmen, createSalaryLedgerEntry, getAppSettings } from "../../services/middleware.service";
import { EmployeeWithCategory, OrderWithLoadmen, Order } from "../../services/types";

export function useDelivery(orderId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderWithLoadmen | null>(null);
  const [loadmen, setLoadmen] = useState<EmployeeWithCategory[]>([]);
  const [deliveryInput, setDeliveryInput] = useState<DeliveryInput>({
    time: '',
    quantity: 0,
    location: '',
    paymentStatus: 'NOT_PAID',
    paidAmount: 0,
    deliveryChallanNumber: '',
    gstNumber: '',
    loadingType: 'LOADING_UNLOADING',
    loadMen: []
  });
  const [selectedLoadmen, setSelectedLoadmen] = useState<EmployeeWithCategory[]>([]);
  const [loadingAndUnloadingCostPerBrick, setLoadingAndUnloadingCostPerBrick] = useState<number>();

  useEffect(() => {
    getOrderData();
    getLoadmenData();
    getSettingsData();
  }, []);

  async function getSettingsData() {
    try {
      const settings = await getAppSettings();
      const found = settings.find(s => s.key === 'LOADING_AND_UNLOADING_PRICE_PER_BRICK');
      if (found) {
        const parsed = parseFloat(found.value);
        if (!isNaN(parsed) && parsed > 0) {
          setLoadingAndUnloadingCostPerBrick(parsed);
        } else {
          // App setting exists but invalid (non-numeric or non-positive)
          setError('Invalid LOADING_AND_UNLOADING_PRICE_PER_BRICK value in app settings. It must be a number greater than 0.');
        }
      } else {
        // App setting missing — this setting is required for salary calculation
        setError('LOADING_AND_UNLOADING_PRICE_PER_BRICK is not configured. Please set it in App Settings.');
      }
    } catch (err) {
      console.error('Failed to load app settings for loading price per brick', err);
    }
  }
  
  useEffect(() => {
    if (order && loadmen.length > 0 && order.loadmen) {
      const selected = loadmen.filter(l => order.loadmen!.some(ol => ol.id === l.id));
      setSelectedLoadmen(selected);
      setDeliveryInput(prev => ({
        ...prev,
        loadMen: selected.map(l => l.id)
      }));
    }
  }, [order, loadmen]);

  const handleLoadManToggle = (loadManId: string) => {
    const loadman = loadmen.find(l => l.id === loadManId);
    if (!loadman) return;
    if (selectedLoadmen.some(l => l.id === loadManId)) {
      deselectLoadman(loadManId);
    } else {
      selectLoadman(loadman);
    }
  };

  async function getOrderData() {
    try {
      const orderData = await getOrderWithLoadmen(orderId);
      console.log("Fetched order data:", orderData);
      setOrder(orderData);
      // Initialize delivery input with order data
      setDeliveryInput(prev => ({
        ...prev,
        quantity: orderData.brick_quantity,
        location: orderData.location || '',
        paymentStatus: orderData.payment_status,
        gstNumber: orderData.gst_number ?? '',
        paidAmount: orderData.amount_paid ?? 0,
        deliveryChallanNumber: orderData.dc_number || '',
        time: orderData.time || '',
        loadingType: orderData.loading_type || '',
      }));
    }
    catch (error) {
      setError("Failed to load order details");
    } 
  }

  async function getLoadmenData() {
    try {
  const loadmenData = await getAllEmployees(true);
      console.log("Fetched loadmen data:", loadmenData);
      setLoadmen(loadmenData);
    }
    catch (error) {
      setError("Failed to load loadmen details");
    }
  }

  function updateDeliveryInput(field: keyof DeliveryInput, value: any) {
    setDeliveryInput(prev => ({ ...prev, [field]: value }));
  }

  function selectLoadman(loadman: EmployeeWithCategory) {
    if (!selectedLoadmen.find(l => l.id === loadman.id)) {
      setSelectedLoadmen(prev => [...prev, loadman]);
      setDeliveryInput(prev => ({ ...prev, loadMen: [...prev.loadMen, loadman.id] }));
    }
  }

  function deselectLoadman(loadmanId: string) {
    setSelectedLoadmen(prev => prev.filter(l => l.id !== loadmanId));
    setDeliveryInput(prev => ({ ...prev, loadMen: prev.loadMen.filter(id => id !== loadmanId) }));
  }

  // async function submitDelivery(input: DeliveryInput) {
  //   try {
  //     setLoading(true);
  //     setError(null);

  //     const result = await createDelivery(input);

  //     if (!result.success) {
  //       throw new Error(result.message);
  //     }

  //     return result;
  //   } catch (err) {
  //     setError("Failed to submit delivery");
  //     throw err;
  //   } finally {
  //     setLoading(false);
  //   }
  // }

  async function updateDelivery() {
    try {
      setLoading(true);
      setError(null);

      if (!order) throw new Error("Order not loaded");

      let amountPaid = 0;
      if (deliveryInput.paymentStatus === 'PARTIALLY_PAID') {
        amountPaid = deliveryInput.paidAmount || 0;
      } else if (deliveryInput.paymentStatus === 'FULLY_PAID') {
        amountPaid = order.final_price;
      }
      // else NOT_PAID, amountPaid = 0

      const orderUpdate: Partial<Order> = {
        time: deliveryInput.time,
        brick_quantity: deliveryInput.quantity,
        location: deliveryInput.location,
        payment_status: deliveryInput.paymentStatus,
        amount_paid: amountPaid,
        gst_number: deliveryInput.gstNumber || null,
        dc_number: deliveryInput.deliveryChallanNumber,
        loading_type: deliveryInput.loadingType,
        delivered: true
      };

      await updateOrderWithLoadmen(orderId, orderUpdate, deliveryInput.loadMen);

      const costPerBrick = loadingAndUnloadingCostPerBrick;

      // The loading/unloading price per brick is required for salary calculations.
      if (!costPerBrick || costPerBrick <= 0) {
        // Surface a clear error so callers / UI can prevent the operation.
        const msg = 'LOADING_AND_UNLOADING_PRICE_PER_BRICK is not configured or invalid. Salary calculation cannot proceed.';
        setError(msg);
        throw new Error(msg);
      }
      
      let multiplier = 1;
      if (deliveryInput.loadingType === 'LOADING_ONLY') {
        multiplier = 0.5;
      }

      // Only calculate and create salary entries when at least one loadman is selected
      if (selectedLoadmen.length > 0) {
        const salaryPerEmployee = (deliveryInput.quantity * costPerBrick * multiplier) / selectedLoadmen.length;

        // Create auto salary ledger entries for each selected loadman
        const salaryEntryDate = new Date().toISOString();
        await Promise.all(
          selectedLoadmen.map((loadman) =>
            createSalaryLedgerEntry({
              employee_id: loadman.id,
              entry_type: "SALARY_AUTO_ENTRY",
              amount: salaryPerEmployee,
              payment_mode: null,
              sender_account_id: null,
              receiver_account: null,
              notes: `Auto salary entry for delivery of order #${orderId}`,
              payment_at: salaryEntryDate
            })
          )
        );
      }

      return { success: true };
    } catch (err) {
      setError("Failed to update delivery");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    order,
    loadmen,
    deliveryInput,
    selectedLoadmen,
    updateDeliveryInput,
    selectLoadman,
    deselectLoadman,
    handleLoadManToggle,
    updateDelivery
  };
}
