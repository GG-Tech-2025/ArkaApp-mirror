import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, AlertCircle, Trash2 } from "lucide-react";
import { AdminOrder } from "../../../../AdminApp";
import { useAdminNavigation } from "../../../hooks/useAdminNavigation";
import {
  getTodayDeliveryOrdersWithPagination,
  getUndeliveredOrders,
  getDeliveredOrders,
  getUnpaidOrders,
  deleteOrder,
} from "../../../../services/middleware.service";
import { updateOrderWithLoadmen } from "../../../../services/middleware.service";
import { Popup } from "../../../../components/Popup";
import { Order } from "../../../../services/types";


type OrderTab = "Today" | "Undelivered" | "Delivered" | "Unpaid";

export function OrderManagementScreen() {
  const { goTo, goBack } = useAdminNavigation();
  const [activeTab, setActiveTab] = useState<OrderTab>("Today");
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders based on the active tab
  const fetchOrders = async (page: number, isInitial: boolean = true) => {
    try {
      setLoading(true);
      setError(null);
      
      let result;
      switch (activeTab) {
        case "Today":
          result = await getTodayDeliveryOrdersWithPagination(page);
          break;
        case "Undelivered":
          result = await getUndeliveredOrders(page);
          break;
        case "Delivered":
          result = await getDeliveredOrders(page);
          break;
        case "Unpaid":
          result = await getUnpaidOrders(page);
          break;
        default:
          result = { data: [], total: 0, hasMore: false };
      }

      if (isInitial) {
        setOrders(Array.isArray(result.data) ? result.data : [result.data]);
      } else {
        setOrders((prev) => [...prev, ...(Array.isArray(result.data) ? result.data : [result.data])]);
      }
      setHasMore(result.hasMore);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders when tab changes
  useEffect(() => {
    setCurrentPage(0);
    setOrders([]);
    setHasMore(false);
    fetchOrders(0, true);
  }, [activeTab]);

  const isOrderOverdue = (order: Order) => {
    const today = new Date().toISOString().split("T")[0];
    return !order.delivered && order.delivery_date < today;
  };

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    fetchOrders(nextPage, false);
  };

  const handleToggleDeliveryToday = async (orderId: string) => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split("T")[0];

      // Update delivery_date to today's date (skip loadmen update)
      await updateOrderWithLoadmen(orderId, { delivery_date: today }, [], true);

      // Refetch the current page after update to ensure consistency
      await fetchOrders(currentPage, true);
    } catch (err) {
      console.error("Failed to update delivery date:", err);
      setError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setLoading(false);
    }
  };

  const [deleteConfirmOrderId, setDeleteConfirmOrderId] = useState<string | null>(null);

  const handleDeleteOrder = async () => {
    if (!deleteConfirmOrderId) return;
    try {
      setLoading(true);
      setError(null);
      await deleteOrder(deleteConfirmOrderId);
      setDeleteConfirmOrderId(null);
      await fetchOrders(0, true);
    } catch (err) {
      console.error("Failed to delete order:", err);
      setError(err instanceof Error ? err.message : "Failed to delete order");
      setDeleteConfirmOrderId(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <Popup title="Error" message={error} onClose={() => setError(null)} type="error" />
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack("/admin/home")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Order Management</h1>
              <p className="text-gray-600 mt-1">Manage all customer orders</p>
            </div>
            <button
              onClick={() =>
                goTo("create")
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Order
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <div className="flex">
              {(
                ["Today", "Undelivered", "Delivered", "Unpaid"] as OrderTab[]
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div className="p-6">
            {loading && currentPage === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-600">Loading orders...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
                <p className="text-red-600">{error}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-gray-600">No orders at the moment</p>
              </div>
            ) : (
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
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Phone
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Final Price
                        </th>
                        <th className="px-4 py-3 text-left text-gray-700">
                          Payment
                        </th>
                        {activeTab === "Delivered" && (
                          <th className="px-4 py-3 text-left text-gray-700">
                            DC No
                          </th>
                        )}
                        {activeTab === "Undelivered" && (
                          <th className="px-4 py-3 text-left text-gray-700">
                            Delivery Today
                          </th>
                        )}
                        {(activeTab === "Today" || activeTab === "Undelivered") && (
                          <th className="px-4 py-3 text-left text-gray-700">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orders.map((order) => {
                        const isDeliveryToday =
                          order.delivery_date === new Date().toISOString().split("T")[0];

                        return (
                          <tr
                            key={order.id}
                            onClick={() => goTo(`${order.id}`)}
                            className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                              isOrderOverdue(order) ? "text-red-600" : ""
                            }`}
                          >
                          <td className="px-4 py-4">{order.id}</td>
                          <td className="px-4 py-4">
                            {new Date(order.order_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4">
                            {new Date(order.delivery_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4">{order.customers?.name || "-"}</td>
                          <td className="px-4 py-4">{order.customers?.phone || "-"}</td>
                          <td className="px-4 py-4">
                            {order.brick_quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            ₹{order.final_price.toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-sm ${
                                order.payment_status === "FULLY_PAID"
                                  ? "bg-green-100 text-green-800"
                                  : order.payment_status === "PARTIALLY_PAID"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {order.payment_status === "FULLY_PAID"
                                ? "Fully Paid"
                                : order.payment_status === "PARTIALLY_PAID"
                                  ? "Partially Paid"
                                  : "Not Paid"}
                            </span>
                          </td>
                          {activeTab === "Delivered" && (
                            <td className="px-4 py-4">
                              {order.dc_number || "-"}
                            </td>
                          )}
                          {activeTab === "Undelivered" && (
                            <td className="px-4 py-4">
                              <label
                                className="relative inline-flex items-center cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isDeliveryToday}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (isDeliveryToday) {
                                      // If delivery date is already today, navigate to edit screen
                                      goTo(`${order.id}`);
                                    } else {
                                      handleToggleDeliveryToday(order.id);
                                    }
                                  }}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </td>
                          )}
                          {(activeTab === "Today" || activeTab === "Undelivered") && (
                            <td className="px-4 py-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmOrderId(order.id);
                                }}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete order"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View - Cards */}
                <div className="lg:hidden space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => goTo(`${order.id}`)}
                      className={`bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${
                        isOrderOverdue(order)
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p
                            className={`${isOrderOverdue(order) ? "text-red-900" : "text-gray-900"}`}
                          >
                            {order.id}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {order.customers?.name || "-"}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-sm ${
                            order.payment_status === "FULLY_PAID"
                              ? "bg-green-100 text-green-800"
                              : order.payment_status === "PARTIALLY_PAID"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {order.payment_status === "FULLY_PAID"
                            ? "Fully Paid"
                            : order.payment_status === "PARTIALLY_PAID"
                              ? "Partially Paid"
                              : "Not Paid"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Delivery Date</p>
                          <p
                            className={
                              isOrderOverdue(order)
                                ? "text-red-700"
                                : "text-gray-900"
                            }
                          >
                            {new Date(order.delivery_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Quantity</p>
                          <p
                            className={
                              isOrderOverdue(order)
                                ? "text-red-700"
                                : "text-gray-900"
                            }
                          >
                            {order.brick_quantity.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Final Price</p>
                          <p
                            className={
                              isOrderOverdue(order)
                                ? "text-red-700"
                                : "text-gray-900"
                            }
                          >
                            ₹{order.final_price.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Phone</p>
                          <p
                            className={
                              isOrderOverdue(order)
                                ? "text-red-700"
                                : "text-gray-900"
                            }
                          >
                            {order.customers?.phone || "-"}
                          </p>
                        </div>
                        {activeTab === "Delivered" &&
                          order.dc_number && (
                            <div className="col-span-2">
                              <p className="text-gray-500">DC No</p>
                              <p className="text-gray-900">
                                {order.dc_number}
                              </p>
                            </div>
                          )}
                      </div>
                      {(activeTab === "Today" || activeTab === "Undelivered") && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmOrderId(order.id);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Popup */}
      {deleteConfirmOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 mx-4 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Order</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete order <span className="font-medium">{deleteConfirmOrderId}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmOrderId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                No
              </button>
              <button
                onClick={handleDeleteOrder}
                disabled={loading}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
