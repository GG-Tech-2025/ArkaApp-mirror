import { useEffect, useState } from "react";
import { createDelivery } from "../services/delivery.service";
import { DeliveryInput } from "../types";
import { getLoadmen, getOrderWithLoadmen, updateOrderWithLoadmen, createSalaryLedgerEntry } from "../../services/middleware.service";
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
    loadMen: []
  });
  const [selectedLoadmen, setSelectedLoadmen] = useState<EmployeeWithCategory[]>([]);

  useEffect(() => {
    getOrderData();
    getLoadmenData()
  }, []);

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
        gstNumber: orderData.gst_number || undefined,
        paidAmount: orderData.amount_paid ?? 0,
        deliveryChallanNumber: orderData.dc_number || '',
        time: orderData.time || ''
      }));
    }
    catch (error) {
      setError("Failed to load order details");
    } 
  }

  async function getLoadmenData() {
    try {
      const loadmenData = await getLoadmen();
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
        delivered: true
      };

      await updateOrderWithLoadmen(orderId, orderUpdate, deliveryInput.loadMen);

      // Create auto salary ledger entries for each selected loadman
      const salaryEntryDate = new Date().toISOString();
      await Promise.all(
        selectedLoadmen.map((loadman) =>
          createSalaryLedgerEntry({
            employee_id: loadman.id,
            entry_type: "SALARY_AUTO_ENTRY",
            amount: loadman.roles.salary_value,
            payment_mode: null,
            sender_account_id: null,
            receiver_account: null,
            notes: `Auto salary entry for delivery of order #${orderId}`,
            created_at: salaryEntryDate,
          })
        )
      );

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
