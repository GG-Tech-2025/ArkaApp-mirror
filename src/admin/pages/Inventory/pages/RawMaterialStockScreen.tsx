import React from 'react';
import { ArrowLeft, Droplets, Mountain, Sparkles, Hammer, Wind, TrendingUp, Clock } from 'lucide-react';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useAllInventoryStock } from '../../../hooks/useInventoryStock';

interface MaterialStockItem {
  material_id: string;
  name: string;
  unit: string;
  quantity: number;
  updated_at: string;
}

const getMaterialIcon = (materialName: string) => {
  const name = materialName.toLowerCase();
  if (name.includes('wet ash')) return <Droplets className="w-8 h-8 text-blue-600" />;
  if (name.includes('marble')) return <Sparkles className="w-8 h-8 text-pink-600" />;
  if (name.includes('crusher')) return <Hammer className="w-8 h-8 text-orange-600" />;
  if (name.includes('fly ash')) return <Wind className="w-8 h-8 text-gray-600" />;
  if (name.includes('cement')) return <Mountain className="w-8 h-8 text-green-600" />;
  return <TrendingUp className="w-8 h-8 text-purple-600" />;
};

const convertToTons = (kgs: number): number => {
  return kgs / 1000;
};

const convertToBags = (kgs: number): number => {
  return kgs / 50;
};

const convertToUnits = (kgs: number): number => {
  // 1 unit = 4500 kg
  return kgs / 4500;
};

const getUnitDisplay = (materialName: string, quantityInKg: number, unit: string): string => {
  const name = materialName.toLowerCase();
  
  if (name.includes('cement')) {
    // Display as bags (from KG)
    const bags = convertToBags(quantityInKg);
    return `${bags.toFixed(0)} Bags (${quantityInKg.toLocaleString()} Kg)`;
  } else if (name.includes('crusher')) {
    // Display as units (from KG)
    const units = convertToUnits(quantityInKg);
    return `${units.toFixed(0)} Units (${quantityInKg.toLocaleString()} Kg)`;
  } else if (name.includes('wet ash') || name.includes('marble') || name.includes('fly ash')) {
    // Display as tons (from KG)
    const tons = convertToTons(quantityInKg);
    return `${tons.toFixed(2)} Tons (${quantityInKg.toLocaleString()} Kg)`;
  }
  
  return `${quantityInKg.toLocaleString()} ${unit}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} days ago`;
  }
  
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export function RawMaterialStockScreen() {
  const { goBack } = useAdminNavigation();
  const { stock: inventoryStock, loading, error, showError, closeError } = useAllInventoryStock();

  // Prepare data for display
  const stockItems: MaterialStockItem[] = inventoryStock.map((item) => ({
    material_id: item.material_id,
    name: item.materials?.name || 'Unknown Material',
    unit: item.materials?.unit || 'units',
    quantity: item.quantity,
    updated_at: item.updated_at || new Date().toISOString(),
  }));

  // Sort by name
  stockItems.sort((a, b) => a.name.localeCompare(b.name));

  // Calculate total stock value (for dashboard)
  const totalStockItems = stockItems.length;
  const totalQuantity = stockItems.reduce((sum, item) => sum + item.quantity, 0);

  // Get low stock materials (arbitrary threshold)
  const lowStockMaterials = stockItems.filter(item => item.quantity < 1000);

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
            <h1 className="text-gray-900">Raw Material Stock</h1>
            <p className="text-gray-600 mt-1">View and track all raw material inventory levels</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Materials Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Materials</p>
                <p className="text-3xl font-bold text-gray-900">{totalStockItems}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-blue-600" />
            </div>
          </div>

          {/* Total Quantity Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Quantity</p>
                <p className="text-3xl font-bold text-gray-900">{totalQuantity.toLocaleString()}</p>
                <p className="text-gray-500 text-xs mt-1">units</p>
              </div>
              <Droplets className="w-12 h-12 text-green-600" />
            </div>
          </div>

          {/* Low Stock Alert Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Low Stock Items</p>
                <p className="text-3xl font-bold text-gray-900">{lowStockMaterials.length}</p>
                <p className="text-gray-500 text-xs mt-1">Below 1000 units</p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                lowStockMaterials.length > 0 ? 'bg-red-100' : 'bg-green-100'
              }`}>
                <span className={`text-lg font-bold ${lowStockMaterials.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {lowStockMaterials.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stock List */}
        <div className="bg-white rounded-lg shadow-md">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Material Inventory</h2>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="p-8 text-center">
              <p className="text-gray-600">Loading inventory stock...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && stockItems.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-gray-600">No materials in inventory</p>
            </div>
          )}

          {/* Stock Items */}
          {!loading && stockItems.length > 0 && (
            <div className="divide-y divide-gray-200">
              {stockItems.map((item) => {
                const isLowStock = item.quantity < 1000;
                return (
                  <div
                    key={item.material_id}
                    className={`px-6 py-6 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors ${
                      isLowStock ? 'bg-red-50' : ''
                    }`}
                  >
                    {/* Material Info */}
                    <div className="flex items-center gap-4 flex-1">
                      {getMaterialIcon(item.name)}
                      <div className="flex-1">
                        <h3 className="text-gray-900 font-medium">{item.name}</h3>
                        <div className="flex items-center gap-2 text-gray-600 text-sm mt-1">
                          <Clock className="w-4 h-4" />
                          <span>Last updated: {formatDate(item.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity Display */}
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                        {getUnitDisplay(item.name, item.quantity, item.unit)}
                      </p>
                      {isLowStock && (
                        <p className="text-red-600 text-sm mt-1">Low stock ⚠️</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error Popup */}
        {showError && error && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
              <h2 className="font-semibold text-gray-900 mb-4 text-2xl">Error</h2>
              <p className="text-gray-600 mb-6 text-lg">{error}</p>
              <button
                onClick={closeError}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
