import { useState, useEffect, useRef } from "react";
import { CustomerLedgerExport } from "./CustomerLedgerExport";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Customer } from "../../../../AdminApp";
import { ArrowLeft, Plus, Edit2, Trash2, X } from "lucide-react";
import { Popup } from "../../../../components/Popup";
import { useParams } from "react-router-dom";
import {
  getCustomerFinancialById,
  getCustomerOrdersWithSettlement,
  updateCustomer,
  getCustomerPayments,
  getAccountsForPayments,
  createCustomerPayment,
  deleteCustomerPayment,
  getCustomerOrdersForExport,
  getCustomerPaymentsForExport,
} from "../../../../services/middleware.service";
import { useAdminNavigation } from "../../../hooks/useAdminNavigation";
import { validateCustomer } from "../../../validators/customer.validator";

interface Payment {
  id: string;
  date: string;
  amount: number;
  modeOfPayment: "Cash" | "UPI" | "Bank Transfer" | "Cheque";
  senderAccountInfo: string;
  receiverAccountInfo: string;
}

export function CustomerDetailsScreen() {
  const { customerId } = useParams<{ customerId: string }>();
  const { goBack, goTo } = useAdminNavigation();
  const [customer, setCustomer] = useState<Customer | null>(null);
  type CustomerOrder = {
    id: string;
    date: string;
    deliveryDate: string;
    customerName: string;
    customerNumber: string;
    customerId: string;
    quantity: number;
    finalPrice: number;
    amountPaid: number;
    unpaidAmount: number;
    gstNumber?: string;
    deliveryChallanNumber?: string;
    paymentStatus: string;
  };
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [page, setPage] = useState(1);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"Orders" | "Payments">("Orders");
  const [displayCount, setDisplayCount] = useState(10);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Edit Customer Modal states
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerGst, setEditCustomerGst] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [customerNameError, setCustomerNameError] = useState("");
  const [customerPhoneError, setCustomerPhoneError] = useState("");
  const [customerGstError, setCustomerGstError] = useState("");
  const [customerAddressError, setCustomerAddressError] = useState("");

  // Export Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");
  const [exportFormat, setExportFormat] = useState<"PDF" | "Image">("PDF");
  const [dateRangeError, setDateRangeError] = useState("");
  const [showNoTransactionsPopup, setShowNoTransactionsPopup] = useState(false);
  const [showExportErrorPopup, setShowExportErrorPopup] = useState(false);

  // Payment form states
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<
    "Cash" | "UPI" | "Bank Transfer" | "Cheque"
  >("Cash");
  const [senderAccount, setSenderAccount] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [hasMorePayments, setHasMorePayments] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentAmountError, setPaymentAmountError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const [exportOrders, setExportOrders] = useState<any[]>([]);
  const [exportPayments, setExportPayments] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  const [receiverAccounts, setReceiverAccounts] = useState<
    { id: string; label: string; value: string }[]
  >([]);

  const cashAccountId = receiverAccounts.find((a) =>
    a.label.toUpperCase().includes("CASH"),
  )?.value;

  useEffect(() => {
    if (paymentMode === "Cash") {
      const cashAccount = receiverAccounts.find((a) =>
        a.label.toUpperCase().includes("CASH"),
      );
      if (cashAccount) {
        setReceiverAccount(cashAccount.value);
      }
    } else {
      setReceiverAccount("");
    }
  }, [paymentMode, receiverAccounts]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await getAccountsForPayments();

        const mapped = data.map((a: any) => ({
          id: a.id,
          label: a.account_number,
          value: a.id, // IMPORTANT → use account ID
        }));

        setReceiverAccounts(mapped);

        // Auto-select Cash account if mode is Cash
        const cashAccount = mapped.find((a) =>
          a.label.toLowerCase().includes("cash"),
        );
        if (cashAccount) setReceiverAccount(cashAccount.value);
      } catch (e) {
        console.error("Failed to load accounts", e);
      }
    };

    loadAccounts();
  }, []);

  useEffect(() => {
    if (!customerId) return;

    const loadPayments = async () => {
      try {
        const res = await getCustomerPayments(customerId, 1);

        setPayments(
          res.data.map((p: any) => ({
            id: p.id,
            date: p.payment_date,
            amount: p.amount,
            modeOfPayment: p.mode,
            senderAccountInfo: p.sender_account ?? "-",
            receiverAccountInfo: p.receiver_account ?? "-",
          })),
        );

        setPaymentsPage(1);
        setHasMorePayments(res.hasMore);
      } catch (e) {
        console.error("Failed to load payments", e);
      }
    };

    loadPayments();
  }, [activeTab, customerId]);

  useEffect(() => {
    if (paymentMode === "Cash") {
      const cash = receiverAccounts.find((a) =>
        a.label.toLowerCase().includes("cash"),
      );
      if (cash) setReceiverAccount(cash.value);
    } else {
      setReceiverAccount("");
    }
  }, [paymentMode, receiverAccounts]);

  useEffect(() => {
    if (!customerId) return;

    const loadCustomerDetails = async () => {
      try {
        setLoading(true);

        const customerData = await getCustomerFinancialById(customerId);
        const ordersRes = await getCustomerOrdersWithSettlement(customerId, 1);
        console.log("Fetched customer data:", customerData);
        console.log("Fetched orders data:", ordersRes);
        setCustomer({
          id: customerData.customer_id,
          name: customerData.name,
          phoneNumber: customerData.phone,
          address: customerData.address,
          totalSales: customerData.total_sales,
          unpaidAmount: customerData.outstanding_amount,
          gstNumber: customerData.gst_number ?? undefined,
        });

        const mappedOrders = ordersRes.data.map((o: any) => ({
          id: o.order_id,
          date: o.order_date,
          deliveryDate: o.delivery_date,

          customerName: customerData.name,
          customerNumber: customerData.phone,
          customerId: o.customer_id,

          quantity: o.brick_quantity,
          finalPrice: o.final_price,

          amountPaid: o.total_paid,
          unpaidAmount: o.remaining_balance,

          gstNumber: o.gst_number,
          deliveryChallanNumber: o.dc_number,

          paymentStatus:
            o.payment_status === "FULLY_PAID"
              ? "Fully Paid"
              : o.payment_status === "PARTIALLY_PAID"
                ? "Partially Paid"
                : "Not Paid",
        }));

        setOrders(mappedOrders);
        setHasMoreOrders(ordersRes.hasMore);
        setPage(1);
      } catch (err) {
        console.error("Failed to load customer details", err);
      } finally {
        setLoading(false);
      }
    };

    loadCustomerDetails();
  }, [customerId]);

  const handleAddPayment = () => {
    // Reset form
    setPaymentDate("");
    setPaymentAmount("");
    setPaymentMode("Cash");
    setSenderAccount("");
    setReceiverAccount("");
    setEditingPayment(null);
    setPaymentAmountError("");
    setShowPaymentModal(true);
  };

  const handleEditPayment = (payment: Payment) => {
    setPaymentDate(payment.date);
    setPaymentAmount(payment.amount.toString());
    setPaymentMode(payment.modeOfPayment);
    setSenderAccount(payment.senderAccountInfo);
    setReceiverAccount(payment.receiverAccountInfo);
    setEditingPayment(payment);
    setShowPaymentModal(true);
  };

  const handleCancelPaymentModal = () => {
    setShowPaymentModal(false);
    setEditingPayment(null);
    setPaymentDate("");
    setPaymentAmount("");
    setPaymentMode("Cash");
    setSenderAccount("");
    setReceiverAccount("");
    setPaymentAmountError("");
  };

  const handleConfirmPayment = async () => {
    if (!customer) return;

    // Validate amount against delivered orders outstanding balance
    const amount = parseFloat(paymentAmount);
    const outstanding = deliveredOutstanding;

    if (!paymentAmount || isNaN(amount) || amount <= 0) {
      setPaymentAmountError("Please enter a valid amount.");
      return;
    } else if (amount > outstanding) {
      setPaymentAmountError(
        `Amount cannot exceed outstanding balance of delivered orders (₹${outstanding.toLocaleString()}).`
      );
      return;
    } else {
      setPaymentAmountError("");
    }

    try {
      setSavingPayment(true);
      await createCustomerPayment({
        customer_id: customer.id,
        payment_date: paymentDate,
        amount: Number(paymentAmount),
        mode: paymentMode,
        receiver_account_id:
          paymentMode === "Cash" ? cashAccountId : receiverAccount,
        sender_account_no: paymentMode === "Cash" ? undefined : senderAccount,
      });

      setShowPaymentModal(false);
      setSuccessMessage("Payment added successfully");
      setShowSuccessPopup(true);

      // 🔄 Refresh everything
      const customerData = await getCustomerFinancialById(customer.id);
      const ordersRes = await getCustomerOrdersWithSettlement(customer.id, 1);
      const paymentsRes = await getCustomerPayments(customer.id, 1);

      setCustomer({
        id: customerData.customer_id,
        name: customerData.name,
        phoneNumber: customerData.phone,
        address: customerData.address,
        totalSales: customerData.total_sales,
        unpaidAmount: customerData.outstanding_amount,
      });

      setOrders(
        ordersRes.data.map((o: any) => ({
          id: o.order_id,
          date: o.order_date,
          deliveryDate: o.delivery_date,
          customerName: customerData.name,
          customerNumber: customerData.phone,
          customerId: o.customer_id,
          quantity: o.brick_quantity,
          finalPrice: o.final_price,
          amountPaid: o.total_paid,
          unpaidAmount: o.remaining_balance,
          gstNumber: o.gst_number,
          deliveryChallanNumber: o.dc_number,
          paymentStatus:
            o.payment_status === "FULLY_PAID"
              ? "Fully Paid"
              : o.payment_status === "PARTIALLY_PAID"
                ? "Partially Paid"
                : "Not Paid",
        })),
      );

      setPayments(
        paymentsRes.data.map((p: any) => ({
          id: p.id,
          date: p.payment_date,
          amount: p.amount,
          modeOfPayment: p.mode,
          senderAccountInfo: p.sender_account ?? "-",
          receiverAccountInfo: p.receiver_account ?? "-",
        })),
      );

      // Reset form
      setPaymentDate("");
      setPaymentAmount("");
      setSenderAccount("");
      setReceiverAccount("");
    } catch (e) {
      console.error("Payment failed", e);
      alert("Failed to add payment");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    setDeletingPaymentId(paymentId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeletePayment = async () => {
    if (!deletingPaymentId || !customer) return;

    try {
      setDeletingPayment(true);

      await deleteCustomerPayment(deletingPaymentId);

      setShowDeleteConfirm(false);
      setDeletingPaymentId(null);
      setSuccessMessage("Payment deleted successfully");
      setShowSuccessPopup(true);

      // 🔄 Refresh everything — customer financials, orders, and payments
      const customerData = await getCustomerFinancialById(customer.id);
      const ordersRes = await getCustomerOrdersWithSettlement(customer.id, 1);
      const paymentsRes = await getCustomerPayments(customer.id, 1);

      setCustomer({
        id: customerData.customer_id,
        name: customerData.name,
        phoneNumber: customerData.phone,
        address: customerData.address,
        totalSales: customerData.total_sales,
        unpaidAmount: customerData.outstanding_amount,
      });

      setOrders(
        ordersRes.data.map((o: any) => ({
          id: o.order_id,
          date: o.order_date,
          deliveryDate: o.delivery_date,
          customerName: customerData.name,
          customerNumber: customerData.phone,
          customerId: o.customer_id,
          quantity: o.brick_quantity,
          finalPrice: o.final_price,
          amountPaid: o.total_paid,
          unpaidAmount: o.remaining_balance,
          gstNumber: o.gst_number,
          deliveryChallanNumber: o.dc_number,
          paymentStatus:
            o.payment_status === "FULLY_PAID"
              ? "Fully Paid"
              : o.payment_status === "PARTIALLY_PAID"
                ? "Partially Paid"
                : "Not Paid",
        })),
      );
      setHasMoreOrders(ordersRes.hasMore);
      setPage(1);

      setPayments(
        paymentsRes.data.map((p: any) => ({
          id: p.id,
          date: p.payment_date,
          amount: p.amount,
          modeOfPayment: p.mode,
          senderAccountInfo: p.sender_account ?? "-",
          receiverAccountInfo: p.receiver_account ?? "-",
        })),
      );
      setPaymentsPage(1);
      setHasMorePayments(paymentsRes.hasMore);
    } catch (e) {
      console.error("Failed to delete payment", e);
      alert("Failed to delete payment. Please try again.");
    } finally {
      setDeletingPayment(false);
    }
  };

  const handleOpenEditCustomer = () => {
    setEditCustomerName(customer?.name ?? "");
    setEditCustomerPhone(customer?.phoneNumber ?? "");
    setEditCustomerGst(customer?.gstNumber ?? "");
    setEditCustomerAddress(customer?.address ?? "");
    setCustomerNameError("");
    setCustomerPhoneError("");
    setCustomerGstError("");
    setCustomerAddressError("");
    setShowEditCustomerModal(true);
  };

  const handleCloseEditCustomer = () => {
    setShowEditCustomerModal(false);
    setCustomerNameError("");
    setCustomerPhoneError("");
    setCustomerGstError("");
    setCustomerAddressError("");
  };

  const handleConfirmEditCustomer = async () => {
    if (!customer) return;

    // Use shared validator
    const errors = validateCustomer({
      name: editCustomerName,
      phone: editCustomerPhone,
      address: editCustomerAddress,
      gst_number: editCustomerGst,
    });

    setCustomerNameError(errors.name || "");
    setCustomerPhoneError(errors.phone || "");
    setCustomerGstError(errors.gst_number || "");
    setCustomerAddressError(errors.address || "");

    if (Object.keys(errors).length > 0) return;

    try {
      setSavingCustomer(true); // 🔵 START loading

      const updated = await updateCustomer(customer.id, {
        name: editCustomerName.trim(),
        phone: editCustomerPhone.trim(),
        address: editCustomerAddress.trim(),
        gst_number: editCustomerGst.trim() || undefined,
      });

      // 🔄 Update local state
      setCustomer({
        ...customer,
        name: updated.name,
        phoneNumber: updated.phone,
        address: updated.address,
        gstNumber: updated.gst_number ?? undefined,
      });

      setShowEditCustomerModal(false);
      setSuccessMessage("Customer details updated successfully");
      setShowSuccessPopup(true);
    } catch (err) {
      console.error("Failed to update customer", err);
    } finally {
      setSavingCustomer(false); // 🔵 END loading (always runs)
    }
  };

  const handleOpenExportModal = () => {
    setExportFromDate("");
    setExportToDate("");
    setExportFormat("PDF");
    setDateRangeError("");
    setShowExportModal(true);
  };

  const handleCloseExportModal = () => {
    setShowExportModal(false);
    setDateRangeError("");
  };

  const handleDownloadExport = async () => {
    setDateRangeError("");

    if (!exportFromDate || !exportToDate) return;

    const fromDate = new Date(exportFromDate);
    const toDate = new Date(exportToDate);

    if (fromDate > toDate) {
      setDateRangeError("From date cannot be greater than To date.");
      return;
    }

    if (!customerId) return;

    // Fetch fresh data from API for the selected date range
    setExporting(true);
    try {
      const [ordersData, paymentsData] = await Promise.all([
        getCustomerOrdersForExport(customerId, exportFromDate, exportToDate),
        getCustomerPaymentsForExport(customerId, exportFromDate, exportToDate),
      ]);

      // Map orders to the export format
      const ordersInRange = ordersData.map((o: any) => ({
        id: o.order_id,
        date: o.order_date,
        deliveryDate: o.delivery_date,
        quantity: o.brick_quantity,
        finalPrice: o.final_price,
      }));

      // Map payments to the export format
      const paymentsInRange = paymentsData.map((p: any) => ({
        id: p.id,
        date: p.payment_date,
        amount: p.amount,
        modeOfPayment: p.mode,
      }));

      if (ordersInRange.length === 0 && paymentsInRange.length === 0) {
        setExporting(false);
        setShowExportModal(false);
        setShowNoTransactionsPopup(true);
        return;
      }

      // 🔥 Store in state
      setExportOrders(ordersInRange);
      setExportPayments(paymentsInRange);

      // Wait for component render
      setTimeout(async () => {
        try {
          const element = exportRef.current;
          if (!element) return;

          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
          });

          const imgData = canvas.toDataURL("image/png");

          if (exportFormat === "Image") {
            const link = document.createElement("a");
            link.href = imgData;
            link.download = `Arka_Invoice_${customer?.name}.png`;
            link.click();
          } else {
            const pdf = new jsPDF("p", "mm", "a4");
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Arka_Invoice_${customer?.name}.pdf`);
          }

          setShowExportModal(false);
          setSuccessMessage(
            `Customer invoice exported successfully as ${exportFormat}`,
          );
          setShowSuccessPopup(true);
        } catch (err) {
          console.error(err);
          setShowExportModal(false);
          setShowExportErrorPopup(true);
        } finally {
          setExporting(false);
        }
      }, 400);
    } catch (err) {
      console.error("Failed to fetch export data:", err);
      setExporting(false);
      setShowExportModal(false);
      setShowExportErrorPopup(true);
    }
  };

  // const displayedOrders = MOCK_CUSTOMER_ORDERS.slice(0, displayCount);
  const displayedOrders: CustomerOrder[] = orders;

  const displayedPayments = payments;

  const loadMoreOrders = async () => {
    if (!customer) return;
    const nextPage = page + 1;
    const res = await getCustomerOrdersWithSettlement(customer.id, nextPage);
    const mappedOrders = res.data.map((o: any) => ({
      id: o.order_id,
      date: o.order_date,
      deliveryDate: o.delivery_date,

      customerName: customer.name,
      customerNumber: customer.phoneNumber,
      customerId: o.customer_id,

      quantity: o.brick_quantity,
      finalPrice: o.final_price,

      amountPaid: o.total_paid,
      unpaidAmount: o.remaining_balance,

      gstNumber: o.gst_number,
      deliveryChallanNumber: o.dc_number,

      paymentStatus:
        o.payment_status === "FULLY_PAID"
          ? "Fully Paid"
          : o.payment_status === "PARTIALLY_PAID"
            ? "Partially Paid"
            : "Not Paid",
    }));
    setOrders((prev) => [...prev, ...mappedOrders]);
    setHasMoreOrders(res.hasMore);
    setPage(nextPage);
  };

  const loadMorePayments = async () => {
    if (!customer) return;
    const nextPage = paymentsPage + 1;
    const res = await getCustomerPayments(customer.id, nextPage);
    setPayments((prev) => [
      ...prev,
      ...res.data.map((p: any) => ({
        id: p.id,
        date: p.payment_date,
        amount: p.amount,
        modeOfPayment: p.mode,
        senderAccountInfo: p.sender_account ?? "-",
        receiverAccountInfo: p.receiver_account ?? "-",
      })),
    ]);
    setPaymentsPage(nextPage);
    setHasMorePayments(res.hasMore);
  };

  const nonCashAccounts = receiverAccounts.filter(
    (a) => !a.label.toUpperCase().includes("CASH"),
  );

  // Total sales / outstanding for delivered orders come from the customer
  // financial summary (whole dataset), not just the currently-loaded page
  // of orders — the orders list is paginated via "Load More".
  const deliveredTotalSales = customer?.totalSales ?? 0;
  const deliveredOutstanding = customer?.unpaidAmount ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
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
            Loading customer details...
          </span>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
          <span className="text-4xl mb-4 text-red-500">😕</span>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Customer not found
          </h2>
          <p className="text-gray-500 mb-4">
            The customer you are looking for does not exist or was removed.
          </p>
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => goBack("/admin/customers")}
          >
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack("/admin/customers")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Customers
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Customer Details</h1>
              <p className="text-gray-600 mt-1">{customer.name}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleOpenExportModal}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Export
              </button>
              {activeTab === "Payments" && (
                <button
                  onClick={handleAddPayment}
                  disabled={deliveredOutstanding <= 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    deliveredOutstanding <= 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  Add payment
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Customer Details Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-gray-900">Customer Information</h3>
            <button
              onClick={handleOpenEditCustomer}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-gray-600 text-sm mb-1">Name</p>
              <p className="text-gray-900">{customer.name}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">Phone Number</p>
              <p className="text-gray-900">{customer.phoneNumber}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">GST Number</p>
              <p className="text-gray-900">{customer.gstNumber || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-600 text-sm mb-1">Address</p>
              <p className="text-gray-900">{customer.address}</p>
            </div>
          </div>
        </div>

        {/* Top Quarter - Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Total Sales Card (Delivered Orders Only) */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-gray-700 mb-2">Total Sales (Delivered)</h3>
            <p className="text-gray-900">
              ₹{deliveredTotalSales.toLocaleString()}
            </p>
          </div>

          {/* Unpaid Amount Card (Delivered Orders Only) */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-gray-700 mb-2">Outstanding Amount (Delivered)</h3>
            <p
              className={`${deliveredOutstanding > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {deliveredOutstanding > 0
                ? `₹${deliveredOutstanding.toLocaleString()}`
                : "₹0"}
            </p>
          </div>
        </div>

        {/* Tabs and Content */}
        <div className="bg-white rounded-lg shadow-lg">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab("Orders");
                  setDisplayCount(10);
                }}
                className={`px-6 py-4 whitespace-nowrap transition-colors ${
                  activeTab === "Orders"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Orders
              </button>
              <button
                onClick={() => {
                  setActiveTab("Payments");
                  setDisplayCount(10);
                }}
                className={`px-6 py-4 whitespace-nowrap transition-colors ${
                  activeTab === "Payments"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Payments
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Orders Tab */}
            {activeTab === "Orders" && (
              <div className="space-y-4">
                {/* Desktop View - Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Order ID
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Delivery Date
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Customer Name
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Customer Number
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Final Price
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          GST Number
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Delivery Challan Number
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Payment Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {displayedOrders.map((order) => (
                        <tr
                          key={order.id}
                          onClick={() => goTo(`/admin/orders/${order.id}`)}
                          className="cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-4 text-gray-900">
                            {order.id}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {order.date
                              ? new Date(order.date).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {order.deliveryDate
                              ? new Date(
                                  order.deliveryDate,
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-4 text-gray-900">
                            {customer.name}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {customer.phoneNumber}
                          </td>
                          <td className="px-4 py-4 text-gray-900">
                            {typeof order.quantity === "number"
                              ? order.quantity.toLocaleString()
                              : "-"}
                          </td>
                          <td className="px-4 py-4 text-gray-900">
                            ₹
                            {typeof order.finalPrice === "number"
                              ? order.finalPrice.toLocaleString()
                              : "0"}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {order.gstNumber || "-"}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {order.deliveryChallanNumber || "-"}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`px-2 py-1 rounded-full text-sm ${
                                order.paymentStatus === "Fully Paid"
                                  ? "bg-green-100 text-green-800"
                                  : order.paymentStatus === "Partially Paid"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View - Cards */}
                <div className="lg:hidden space-y-4">
                  {displayedOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => goTo(`/admin/orders/${order.id}`)}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-gray-900">{order.id}</p>
                          <p className="text-gray-600 text-sm">
                            {order.date
                              ? new Date(order.date).toLocaleDateString()
                              : "-"}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-sm ${
                            order.paymentStatus === "Fully Paid"
                              ? "bg-green-100 text-green-800"
                              : order.paymentStatus === "Partially Paid"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {order.paymentStatus}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Quantity</p>
                          <p className="text-gray-900">
                            {typeof order.quantity === "number"
                              ? order.quantity.toLocaleString()
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Final Price</p>
                          <p className="text-gray-900">
                            ₹
                            {typeof order.finalPrice === "number"
                              ? order.finalPrice.toLocaleString()
                              : "0"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMoreOrders && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={loadMoreOrders}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Load More
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === "Payments" && (
              <div className="space-y-4">
                {/* Desktop View - Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Mode of Payment
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          SAI
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          RAI
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {displayedPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-gray-900">
                            {new Date(payment.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4 text-gray-900">
                            ₹{payment.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {payment.modeOfPayment}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {payment.senderAccountInfo}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {payment.receiverAccountInfo}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              {/* <button
                                disabled
                                // onClick={() => handleEditPayment(payment)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                aria-label="Edit payment"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button> */}
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                aria-label="Delete payment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View - Cards */}
                <div className="lg:hidden space-y-4">
                  {displayedPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-gray-900">
                            ₹{payment.amount.toLocaleString()}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {new Date(payment.date).toLocaleDateString() ?? ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditPayment(payment)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            aria-label="Edit payment"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            aria-label="Delete payment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Mode of Payment</p>
                          <p className="text-gray-900">
                            {payment.modeOfPayment}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">SAI</p>
                          <p className="text-gray-900">
                            {payment.senderAccountInfo}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMorePayments && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={loadMorePayments}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Load More
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Close Icon */}
            <button
              onClick={handleCancelPaymentModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-6">
              {editingPayment ? "Edit Payment" : "Add Payment"}
            </h2>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label
                  htmlFor="paymentDate"
                  className="block text-gray-700 mb-2"
                >
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Amount */}
              <div>
                <label
                  htmlFor="paymentAmount"
                  className="block text-gray-700 mb-2"
                >
                  Amount (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  id="paymentAmount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPaymentAmount(val);
                    const amt = parseFloat(val);
                    const outstanding = deliveredOutstanding;
                    if (val && !isNaN(amt) && amt > outstanding) {
                      setPaymentAmountError(
                        `Amount cannot exceed outstanding balance of delivered orders (₹${outstanding.toLocaleString()}).`
                      );
                    } else {
                      setPaymentAmountError("");
                    }
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="Enter amount"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                    paymentAmountError ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {paymentAmountError && (
                  <p className="text-red-600 text-sm mt-1">{paymentAmountError}</p>
                )}
              </div>

              {/* Mode of Payment */}
              <div>
                <label
                  htmlFor="paymentMode"
                  className="block text-gray-700 mb-2"
                >
                  Mode of Payment <span className="text-red-600">*</span>
                </label>
                <select
                  id="paymentMode"
                  value={paymentMode}
                  onChange={(e) =>
                    setPaymentMode(
                      e.target.value as
                        | "Cash"
                        | "UPI"
                        | "Bank Transfer"
                        | "Cheque",
                    )
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>


              {/* Sender/Receiver Account Info or Account Missing Message */}
              {paymentMode !== "Cash" && (
                nonCashAccounts.length === 0 ? (
                  <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded mb-2">
                    <strong>Account Required:</strong> Please create a receiver account before proceeding to enter payment details. Without an account, the payment cannot be processed.
                  </div>
                ) : (
                  <>
                    {/* Sender Account Info */}
                    <div>
                      <label
                        htmlFor="senderAccount"
                        className="block text-gray-700 mb-2"
                      >
                        Sender Account Info <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="senderAccount"
                        type="text"
                        value={senderAccount}
                        onChange={(e) => setSenderAccount(e.target.value)}
                        placeholder="Enter sender account info"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    {/* Receiver Account Info */}
                    <div>
                      <label
                        htmlFor="receiverAccount"
                        className="block text-gray-700 mb-2"
                      >
                        Receiver Account Info <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="receiverAccount"
                        value={receiverAccount}
                        onChange={(e) => setReceiverAccount(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select account</option>
                        {nonCashAccounts.map((account) => (
                          <option key={account.id} value={account.value}>
                            {account.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={handleCancelPaymentModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={
                    savingPayment ||
                    !paymentDate ||
                    !paymentAmount ||
                    !!paymentAmountError ||
                    (paymentMode !== "Cash" &&
                      (nonCashAccounts.length === 0 || !senderAccount || !receiverAccount))
                  }
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    paymentDate &&
                    paymentAmount &&
                    !paymentAmountError &&
                    (paymentMode === "Cash" ||
                      (nonCashAccounts.length > 0 && senderAccount && receiverAccount))
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Close Icon */}
            <button
              onClick={handleCloseEditCustomer}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-6">Edit Customer Details</h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label
                  htmlFor="editCustomerName"
                  className="block text-gray-700 mb-2"
                >
                  Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="editCustomerName"
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {customerNameError && (
                  <p className="text-red-600 text-sm mt-1">
                    {customerNameError}
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label
                  htmlFor="editCustomerPhone"
                  className="block text-gray-700 mb-2"
                >
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  id="editCustomerPhone"
                  type="text"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {customerPhoneError && (
                  <p className="text-red-600 text-sm mt-1">
                    {customerPhoneError}
                  </p>
                )}
              </div>

              {/* GST Number */}
              <div>
                <label
                  htmlFor="editCustomerGst"
                  className="block text-gray-700 mb-2"
                >
                  GST Number
                </label>
                <input
                  id="editCustomerGst"
                  type="text"
                  value={editCustomerGst}
                  onChange={(e) => setEditCustomerGst(e.target.value.toUpperCase())}
                  placeholder="Enter GST Number"
                  maxLength={15}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {customerGstError && (
                  <p className="text-red-600 text-sm mt-1">
                    {customerGstError}
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <label
                  htmlFor="editCustomerAddress"
                  className="block text-gray-700 mb-2"
                >
                  Address <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="editCustomerAddress"
                  value={editCustomerAddress}
                  onChange={(e) => setEditCustomerAddress(e.target.value)}
                  placeholder="Enter address"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {customerAddressError && (
                  <p className="text-red-600 text-sm mt-1">
                    {customerAddressError}
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={handleCloseEditCustomer}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmEditCustomer}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    editCustomerName && editCustomerPhone && editCustomerAddress
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Success"
          message={successMessage}
          onClose={() => setShowSuccessPopup(false)}
          type="success"
        />
      )}

      {/* Delete Payment Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletingPaymentId(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-4">Delete Payment</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this payment? This will reverse the
              settlement on associated orders and deduct the amount from the
              receiving account. This action cannot be undone.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingPaymentId(null);
                }}
                disabled={deletingPayment}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeletePayment}
                disabled={deletingPayment}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  deletingPayment
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {deletingPayment ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Close Icon */}
            <button
              onClick={handleCloseExportModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-gray-900 mb-2">Export Customer Ledger</h2>
            <p className="text-gray-500 text-sm mb-6">Orders are filtered by their delivered date</p>

            <div className="space-y-4">
              {/* From Date */}
              <div>
                <label
                  htmlFor="exportFromDate"
                  className="block text-gray-700 mb-2"
                >
                  From Date <span className="text-red-600">*</span>
                </label>
                <input
                  id="exportFromDate"
                  type="date"
                  value={exportFromDate}
                  onChange={(e) => setExportFromDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* To Date */}
              <div>
                <label
                  htmlFor="exportToDate"
                  className="block text-gray-700 mb-2"
                >
                  To Date <span className="text-red-600">*</span>
                </label>
                <input
                  id="exportToDate"
                  type="date"
                  value={exportToDate}
                  onChange={(e) => setExportToDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Date Range Error */}
              {dateRangeError && (
                <p className="text-red-600 text-sm">{dateRangeError}</p>
              )}

              {/* Export Format */}
              <div>
                <label
                  htmlFor="exportFormat"
                  className="block text-gray-700 mb-2"
                >
                  Export Format <span className="text-red-600">*</span>
                </label>
                <select
                  id="exportFormat"
                  value={exportFormat}
                  onChange={(e) =>
                    setExportFormat(e.target.value as "PDF" | "Image")
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="PDF">PDF</option>
                  <option value="Image">Image</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={handleCloseExportModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadExport}
                  disabled={!exportFromDate || !exportToDate}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    exportFromDate && exportToDate
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Transactions Popup */}
      {showNoTransactionsPopup && (
        <Popup
          title="No Transactions Found"
          message="No transactions found for the selected date range."
          onClose={() => setShowNoTransactionsPopup(false)}
          type="warning"
        />
      )}

      {/* Export Error Popup */}
      {showExportErrorPopup && (
        <Popup
          title="Export Failed"
          message="Unable to generate export. Please try again."
          onClose={() => setShowExportErrorPopup(false)}
        />
      )}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <CustomerLedgerExport
          ref={exportRef}
          customer={customer}
          orders={exportOrders}
          payments={exportPayments.length > 0 ? exportPayments : payments}
          fromDate={exportFromDate}
          toDate={exportToDate}
        />
      </div>
    </div>
  );
}
