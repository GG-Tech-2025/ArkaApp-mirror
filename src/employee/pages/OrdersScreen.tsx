import React from "react";
import { ArrowLeft, MapPin, Phone, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";

export function OrdersScreen() {
  const navigate = useNavigate();
  const { orders, loading, error } = useOrders();

   if (loading) {
    return <div className="p-6 text-gray-600">Loading orders...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  const navigateToDeliveryEntryScreen = (orderId: string) => {
    navigate(`/employee/orders/${orderId}/delivery`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/employee/home")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <h1 className="text-gray-900">Undelivered Orders</h1>
          <p className="text-gray-600 mt-1">
            Select an order to enter delivery details
          </p>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              No orders assigned for delivery.
            </div>
          )}
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() =>
                navigateToDeliveryEntryScreen(order.id)
              }
              className="w-full bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h3 className="text-gray-900 mb-1">{order.customers?.name}</h3>
                  <p className="text-gray-500 text-sm">Order ID: {order.id}</p>
                </div>
                <div className="mt-2 sm:mt-0">
                  <span className="inline-block bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">
                    Pending Delivery
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-sm">Phone Number</p>
                    <p className="text-gray-900">{order.customers?.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-sm">Quantity</p>
                    <p className="text-gray-900">
                      {order.brick_quantity} bricks
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:col-span-2">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-500 text-sm">Location</p>
                    <p className="text-gray-900 truncate">{order.location}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-gray-500 text-sm">Order Amount</p>
                  <p className="text-gray-900">
                    ₹{order.final_price}
                  </p>
                </div>
                <div 
                  className="text-blue-600 group-hover:translate-x-1 transition-transform" 
                  onClick={() => navigateToDeliveryEntryScreen(order.id)}>
                  Select Order →
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
