import { useState } from 'react';
import { ArrowLeft, Droplets, Mountain, Sparkles, Hammer, Wind, Boxes } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useProcurementsCountWithFilter } from '../../../hooks/useProcurementsWithFilters';
import { useAllInventoryStock } from '../../../hooks/useInventoryStock';
import { useProcurements } from '../../../hooks/useProcurements';
import { useProductionEntries } from '../../../hooks/useProductionEntries';
import { useProductInventory } from '../../../hooks/useProductInventory';
import { useAdjustments } from '../../../hooks/useAdjustments';
import { validateSession } from '../../../../services/middleware.service';
import { createAdjustment } from '../../../../services/middleware.service';

type FilterType = 'Current month' | 'Last month' | 'Last year' | 'Custom range';
type TabType = 'Procurement' | 'Usage' | 'Adjustments';
type MaterialFilter = 'All' | 'Wet Ash' | 'Marble Powder' | 'Crusher Powder' | 'Fly Ash' | 'Cement';

export function InventoryManagementScreen() {
  const {goTo,goBack} = useAdminNavigation();
  const [filterType, setFilterType] = useState<FilterType>('Current month');
  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('Procurement');
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>('All');
  const [displayCount, setDisplayCount] = useState(10);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Fetch unapproved procurements count with filter
  const { count: unapprovedCount } = useProcurementsCountWithFilter(
    filterType,
    filterType === 'Custom range' ? customStartDate : undefined,
    filterType === 'Custom range' ? customEndDate : undefined
  );

  // Fetch inventory stock data
  const { stock: inventoryStock, refetch: refetchStock } = useAllInventoryStock();

  // Fetch approved procurements data
  const { procurements: procurementsData, loading: procurementsLoading, refetch: refetchProcurements } = useProcurements();

  // Fetch production entries data
  const { entries: productionEntries, loading: productionLoading, refetch: refetchProductionEntries } = useProductionEntries();

  // Fetch product inventory data (Bricks)
  const { inventory: productInventory, refetch: refetchProductInventory } = useProductInventory();

  // Fetch adjustments data
  const { adjustments: adjustmentsData, loading: adjustmentsLoading, refetch: refetchAdjustments } = useAdjustments();

  // Build inventory metrics from database
  const buildInventoryMetrics = () => {
    const metrics: any = {
      bricksReady: productInventory?.quantity ?? 0, // Get from product_inventory table
      wetAshKg: 0,
      marblePowderKg: 0,
      crusherPowderKg: 0,
      flyAshKg: 0,
      cementKg: 0,
    };

    inventoryStock.forEach((item) => {
      const materialName = item.materials?.name?.toLowerCase() || '';
      
      if (materialName.includes('wet ash')) {
        metrics.wetAshKg = item.quantity;
      } else if (materialName.includes('marble')) {
        metrics.marblePowderKg = item.quantity;
      } else if (materialName.includes('crusher')) {
        metrics.crusherPowderKg = item.quantity;
      } else if (materialName.includes('fly ash')) {
        metrics.flyAshKg = item.quantity;
      } else if (materialName.includes('cement')) {
        metrics.cementKg = item.quantity;
      }
    });

    return metrics;
  };

  const INVENTORY_METRICS = buildInventoryMetrics();

  // Production Capacity Constants (per round)
  const PRODUCTION_CONSTANTS = {
    CEMENT_PER_ROUND: 25, // kg
    FLY_ASH_PER_ROUND: 110, // kg
    WET_ASH_PER_ROUND: 90, // kg
    MARBLE_POWDER_PER_ROUND: 90, // kg
    CRUSHER_POWDER_PER_ROUND: 1800, // kg
    TOTAL_KG_PER_ROUND: 2115, // Total kg per round
    BRICKS_PER_ROUND: 175, // bricks per round
    COST_PER_ROUND: 640, // ₹ per round
    PRODUCTION_COST_PER_BRICK: 3.65, // ₹ per brick
  };

  // Calculate production capacity based on available materials
  const calculateProductionCapacity = () => {
    // Calculate how many rounds can be produced from each material
    const roundsFromCement = Math.floor((INVENTORY_METRICS.cementKg / PRODUCTION_CONSTANTS.CEMENT_PER_ROUND));
    const roundsFromFlyAsh = Math.floor((INVENTORY_METRICS.flyAshKg / PRODUCTION_CONSTANTS.FLY_ASH_PER_ROUND));
    const roundsFromWetAsh = Math.floor((INVENTORY_METRICS.wetAshKg / PRODUCTION_CONSTANTS.WET_ASH_PER_ROUND));
    const roundsFromMarblePowder = Math.floor((INVENTORY_METRICS.marblePowderKg / PRODUCTION_CONSTANTS.MARBLE_POWDER_PER_ROUND));
    const roundsFromCrusherPowder = Math.floor((INVENTORY_METRICS.crusherPowderKg / PRODUCTION_CONSTANTS.CRUSHER_POWDER_PER_ROUND));

    // The limiting factor is the material that allows the fewest rounds
    const maxRounds = Math.min(
      roundsFromCement,
      roundsFromFlyAsh,
      roundsFromWetAsh,
      roundsFromMarblePowder,
      roundsFromCrusherPowder
    );

    // Calculate total bricks and cost
    const totalBrickCapacity = maxRounds * PRODUCTION_CONSTANTS.BRICKS_PER_ROUND;
    const totalProductionCost = totalBrickCapacity * PRODUCTION_CONSTANTS.PRODUCTION_COST_PER_BRICK;
    const totalRoundCost = maxRounds * PRODUCTION_CONSTANTS.COST_PER_ROUND;

    return {
      maxRounds,
      totalBricks: totalBrickCapacity,
      totalProductionCost,
      totalRoundCost,
      limitingMaterial: getLimitingMaterial(
        roundsFromCement,
        roundsFromFlyAsh,
        roundsFromWetAsh,
        roundsFromMarblePowder,
        roundsFromCrusherPowder
      ),
    };
  };

  const getLimitingMaterial = (
    cement: number,
    flyAsh: number,
    wetAsh: number,
    marblePowder: number,
    crusherPowder: number
  ): string => {
    const materials = [
      { name: 'Cement', rounds: cement },
      { name: 'Fly Ash', rounds: flyAsh },
      { name: 'Wet Ash', rounds: wetAsh },
      { name: 'Marble Powder', rounds: marblePowder },
      { name: 'Crusher Powder', rounds: crusherPowder },
    ];

    const limited = materials.reduce((min, current) =>
      current.rounds < min.rounds ? current : min
    );

    return limited.name;
  };

  const PRODUCTION_CAPACITY = calculateProductionCapacity();

  // Adjustment form state
  const [adjBricksReady, setAdjBricksReady] = useState('');
  const [adjWetAsh, setAdjWetAsh] = useState('');
  const [adjMarblePowder, setAdjMarblePowder] = useState('');
  const [adjCrusherPowder, setAdjCrusherPowder] = useState('');
  const [adjFlyAsh, setAdjFlyAsh] = useState('');
  const [adjCement, setAdjCement] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  const handleFilterChange = (value: FilterType) => {
    if (value === 'Custom range') {
      setShowCustomRangeModal(true);
    } else {
      setFilterType(value);
    }
  };

  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      setFilterType('Custom range');
      setShowCustomRangeModal(false);
    }
  };

  const handleCancelCustomRange = () => {
    setShowCustomRangeModal(false);
  };

  const handleOpenAdjustmentModal = () => {
    // Pre-fill with current values - fresh on every click
    setAdjBricksReady(INVENTORY_METRICS.bricksReady.toString());
    setAdjWetAsh(INVENTORY_METRICS.wetAshKg.toString());
    setAdjMarblePowder(INVENTORY_METRICS.marblePowderKg.toString());
    setAdjCrusherPowder(INVENTORY_METRICS.crusherPowderKg.toString());
    setAdjFlyAsh(INVENTORY_METRICS.flyAshKg.toString());
    // Cement: convert from KG to bags for display
    setAdjCement(convertToBags(INVENTORY_METRICS.cementKg).toString());
    setAdjReason('');
    setShowAdjustmentModal(true);
  };

  const handleSubmitAdjustment = async () => {
    try {
      setAdjLoading(true);
      setAdjError(null);

      const user = await validateSession();
      if (!user) throw new Error("User not authenticated");

      await createAdjustment(
        new Date().toISOString().split('T')[0], // adjustment_date
        INVENTORY_METRICS.bricksReady, // actual_bricks
        INVENTORY_METRICS.wetAshKg, // actual_wet_ash_kg
        INVENTORY_METRICS.marblePowderKg, // actual_marble_powder_kg
        INVENTORY_METRICS.crusherPowderKg, // actual_crusher_powder_kg
        INVENTORY_METRICS.flyAshKg, // actual_fly_ash_kg
        convertToBags(INVENTORY_METRICS.cementKg), // actual_cement_bags
        Number(adjBricksReady) || 0, // adjusted_bricks
        Number(adjWetAsh) || 0, // adjusted_wet_ash_kg
        Number(adjMarblePowder) || 0, // adjusted_marble_powder_kg
        Number(adjCrusherPowder) || 0, // adjusted_crusher_powder_kg
        Number(adjFlyAsh) || 0, // adjusted_fly_ash_kg
        Number(adjCement) || 0, // adjusted_cement_bags
        adjReason || null, // reason
        user.id // userId
      );

      // Reset form
      setAdjBricksReady('');
      setAdjWetAsh('');
      setAdjMarblePowder('');
      setAdjCrusherPowder('');
      setAdjFlyAsh('');
      setAdjCement('');
      setAdjReason('');
      
      setShowAdjustmentModal(false);
      setShowSuccessPopup(true);

      // Refetch all data to update UI
      await Promise.all([
        refetchStock(),
        refetchProductInventory(),
        refetchAdjustments(),
        refetchProcurements(),
        refetchProductionEntries()
      ]);
    } catch (error: any) {
      setAdjError(error.message || "Failed to submit adjustment");
    } finally {
      setAdjLoading(false);
    }
  };

  const handleCancelAdjustment = () => {
    setShowAdjustmentModal(false);
  };

  // Filter procurement data based on selected material AND date range
  const getFilteredProcurementData = () => {
    let filtered = procurementsData;

    // Filter by date range based on filterType
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date = now;

    if (filterType === 'Current month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filterType === 'Last month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filterType === 'Last year') {
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
    } else if (filterType === 'Custom range') {
      if (customStartDate) startDate = new Date(customStartDate);
      if (customEndDate) endDate = new Date(customEndDate);
    }

    // Apply date filter
    if (startDate) {
      filtered = filtered.filter(entry => {
        const procDate = new Date(entry.date);
        return procDate >= startDate && procDate <= endDate;
      });
    }

    // Apply material filter
    if (materialFilter === 'All') {
      return filtered;
    }
    return filtered.filter(entry => {
      const materialName = entry.materials?.name?.toLowerCase() || '';
      return materialName.includes(materialFilter.toLowerCase());
    });
  };

  const getFilteredProductionData = () => {
    let filtered = productionEntries;

    // Filter by date range based on filterType
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date = now;

    if (filterType === 'Current month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filterType === 'Last month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filterType === 'Last year') {
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
    } else if (filterType === 'Custom range') {
      if (customStartDate) startDate = new Date(customStartDate);
      if (customEndDate) endDate = new Date(customEndDate);
    }

    // Apply date filter
    if (startDate) {
      filtered = filtered.filter(entry => {
        const prodDate = new Date(entry.production_date);
        return prodDate >= startDate && prodDate <= endDate;
      });
    }

    return filtered;
  };

  const getFilteredAdjustmentData = () => {
    let filtered = adjustmentsData;

    // Filter by date range based on filterType
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date = now;

    if (filterType === 'Current month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filterType === 'Last month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filterType === 'Last year') {
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
    } else if (filterType === 'Custom range') {
      if (customStartDate) startDate = new Date(customStartDate);
      if (customEndDate) endDate = new Date(customEndDate);
    }

    // Apply date filter
    if (startDate) {
      filtered = filtered.filter(entry => {
        const adjDate = new Date(entry.adjustment_date);
        return adjDate >= startDate && adjDate <= endDate;
      });
    }

    return filtered;
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'Procurement':
        return getFilteredProcurementData();
      case 'Usage':
        return getFilteredProductionData();
      case 'Adjustments':
        return getFilteredAdjustmentData();
      default:
        return [];
    }
  };

  const currentData = getCurrentData();
  const hasMoreData = displayCount < currentData.length;

  // Helper functions for conversions
  const convertToTons = (kgs: number): number => {
    return kgs / 1000;
  };

  const convertToBags = (kgs: number): number => {
    return kgs / 50;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getDifferenceColor = (difference: number): string => {
    if (difference > 0) return '#22c55e'; // GREEN
    if (difference < 0) return '#ef4444'; // RED
    return '#999999'; // GRAY
  };

  const formatAdjustmentValueDisplay = (actual: number | null, adjusted: number | null) => {
    if (actual === null || adjusted === null) {
      return <span className="text-gray-500">N/A</span>;
    }

    const difference = adjusted - actual;
    const diffColor = getDifferenceColor(difference);

    return (
      <span>
        {actual.toLocaleString()} → {adjusted.toLocaleString()}
        <span style={{ color: diffColor }}>
          ({difference > 0 ? '+' : ''}{difference.toLocaleString()})
        </span>
      </span>
    );
  };

  const formatAdjustmentValue = (actual: number, adjustment: number): string => {
    if (adjustment >= 0) {
      return `${actual.toLocaleString()}(+${adjustment})`;
    } else {
      return `${actual.toLocaleString()}(${adjustment})`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => goBack('/admin/home')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-gray-900">Inventory Management</h1>
              <p className="text-gray-600 mt-1">Track stock, production, and raw material usage</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Filter Dropdown */}
              <select
                value={filterType}
                onChange={(e) => handleFilterChange(e.target.value as FilterType)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="Current month">Current month</option>
                <option value="Last month">Last month</option>
                <option value="Last year">Last year</option>
                <option value="Custom range">Custom range</option>
              </select>

              {/* Unapproved Procurements Button */}
              <button
                onClick={() => goTo('unapproved-procurements')}
                className="relative px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Unapproved procurements
                {unapprovedCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                    {unapprovedCount}
                  </span>
                )}
              </button>

              {/* Make Adjustments Button */}
              <button
                onClick={handleOpenAdjustmentModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                Make adjustments
              </button>
            </div>
          </div>
        </div>

        {/* Top Half - Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Bricks Ready */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col items-center justify-center">
              <Boxes className="w-16 h-16 text-blue-600 mb-4" />
              <h3 className="text-gray-700 mb-2">Bricks Ready</h3>
              <p className="text-gray-900 mb-6">{INVENTORY_METRICS.bricksReady.toLocaleString()}</p>
              
              {/* Divider */}
              <div className="w-full border-t border-gray-200 my-4"></div>
              
              {/* Production Capacity */}
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-3">Potential Production Capacity</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-gray-700 font-semibold text-lg">{PRODUCTION_CAPACITY.totalBricks.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs">Bricks ({PRODUCTION_CAPACITY.maxRounds} rounds)</p>
                  </div>
                  {/* <div className="pt-2 border-t border-gray-200">
                    <p className="text-gray-700 font-semibold text-sm">₹{PRODUCTION_CAPACITY.totalProductionCost.toLocaleString('en-IN', {maximumFractionDigits: 0})}</p>
                    <p className="text-gray-500 text-xs">Production Cost</p>
                  </div> */}
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-amber-600 text-xs font-medium">Limited by: {PRODUCTION_CAPACITY.limitingMaterial}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Raw Materials */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-900 mb-4">Raw Material Stock</h3>
            <div className="space-y-4">
              {/* Wet Ash */}
              <div className="flex items-center gap-3">
                <Droplets className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <p className="text-gray-600 text-sm">Wet Ash</p>
                  <p className="text-gray-900">
                    {INVENTORY_METRICS.wetAshKg.toLocaleString()} Kg ({convertToTons(INVENTORY_METRICS.wetAshKg).toFixed(2)} Tons)
                  </p>
                </div>
              </div>

              {/* Marble Powder */}
              <div className="flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-pink-600" />
                <div className="flex-1">
                  <p className="text-gray-600 text-sm">Marble Powder</p>
                  <p className="text-gray-900">
                    {INVENTORY_METRICS.marblePowderKg.toLocaleString()} Kg ({convertToTons(INVENTORY_METRICS.marblePowderKg).toFixed(2)} Tons)
                  </p>
                </div>
              </div>

              {/* Crusher Powder */}
              <div className="flex items-center gap-3">
                <Hammer className="w-8 h-8 text-orange-600" />
                <div className="flex-1">
                  <p className="text-gray-600 text-sm">Crusher Powder</p>
                  <p className="text-gray-900">
                    {INVENTORY_METRICS.crusherPowderKg.toLocaleString()} Kg ({convertToTons(INVENTORY_METRICS.crusherPowderKg).toFixed(2)} Tons)
                  </p>
                </div>
              </div>

              {/* Fly Ash */}
              <div className="flex items-center gap-3">
                <Wind className="w-8 h-8 text-gray-600" />
                <div className="flex-1">
                  <p className="text-gray-600 text-sm">Fly Ash</p>
                  <p className="text-gray-900">
                    {INVENTORY_METRICS.flyAshKg.toLocaleString()} Kg ({convertToTons(INVENTORY_METRICS.flyAshKg).toFixed(2)} Tons)
                  </p>
                </div>
              </div>

              {/* Cement */}
              <div className="flex items-center gap-3">
                <Mountain className="w-8 h-8 text-green-600" />
                <div className="flex-1">
                  <p className="text-gray-600 text-sm">Cement</p>
                  <p className="text-gray-900">
                    {INVENTORY_METRICS.cementKg.toLocaleString()} Kg ({convertToBags(INVENTORY_METRICS.cementKg).toFixed(0)} Bags)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Half - Tabs and Data */}
        <div className="bg-white rounded-lg shadow-md">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab('Procurement');
                  setDisplayCount(10);
                  setMaterialFilter('All');
                }}
                className={`px-6 py-4 whitespace-nowrap transition-colors ${
                  activeTab === 'Procurement'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Procurement
              </button>
              <button
                onClick={() => {
                  setActiveTab('Usage');
                  setDisplayCount(10);
                }}
                className={`px-6 py-4 whitespace-nowrap transition-colors ${
                  activeTab === 'Usage'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Usage
              </button>
              <button
                onClick={() => {
                  setActiveTab('Adjustments');
                  setDisplayCount(10);
                }}
                className={`px-6 py-4 whitespace-nowrap transition-colors ${
                  activeTab === 'Adjustments'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Adjustments
              </button>
            </div>
          </div>

          {/* Material Filter Tabs (only for Procurement) */}
          {activeTab === 'Procurement' && (
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setMaterialFilter('All');
                    setDisplayCount(10);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    materialFilter === 'All'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setMaterialFilter('Wet Ash');
                    setDisplayCount(10);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    materialFilter === 'Wet Ash'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Wet Ash
                </button>
                <button
                  onClick={() => {
                    setMaterialFilter('Marble Powder');
                    setDisplayCount(10);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    materialFilter === 'Marble Powder'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Marble Powder
                </button>
                <button
                  onClick={() => {
                    setMaterialFilter('Crusher Powder');
                    setDisplayCount(10);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    materialFilter === 'Crusher Powder'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Crusher Powder
                </button>
                <button
                  onClick={() => {
                    setMaterialFilter('Fly Ash');
                    setDisplayCount(10);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    materialFilter === 'Fly Ash'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Fly Ash
                </button>
                <button
                  onClick={() => {
                    setMaterialFilter('Cement');
                    setDisplayCount(10);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    materialFilter === 'Cement'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cement
                </button>
              </div>
            </div>
          )}

          {/* Data List */}
          <div className="p-6">
            {/* Procurement Tab */}
            {activeTab === 'Procurement' && (
              <div className="space-y-4">
                {procurementsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading procurements...</p>
                  </div>
                ) : getFilteredProcurementData().length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No procurements found</p>
                  </div>
                ) : (
                  getFilteredProcurementData().slice(0, displayCount).map((entry) => (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div>
                          <p className="text-gray-500 text-sm">Material</p>
                          <p className="text-gray-900">{entry.materials?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Date</p>
                          <p className="text-gray-900">{formatDate(entry.date)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Vendor</p>
                          <p className="text-gray-900">{entry.vendors?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Quantity</p>
                          <p className="text-gray-900">{entry.quantity} {entry.materials?.unit || ''}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Total Price</p>
                          <p className="text-gray-900">₹{entry.total_price.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Usage Tab */}
            {activeTab === 'Usage' && (
              <div className="overflow-x-auto">
                {productionLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading production entries...</p>
                  </div>
                ) : getFilteredProductionData().length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No production entries found</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Date</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">No of Bricks</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Round</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Wet Ash</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Marble Powder</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Crusher Powder</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Fly Ash</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Cement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getFilteredProductionData().slice(0, displayCount).map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">{formatDate(entry.production_date)}</td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">{entry.bricks.toLocaleString()}</td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">{entry.round}</td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {(entry.wet_ash_kg ?? 0).toLocaleString()} Kg ({convertToTons(entry.wet_ash_kg ?? 0).toFixed(2)} Tons)
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {(entry.marble_powder_kg ?? 0).toLocaleString()} Kg ({convertToTons(entry.marble_powder_kg ?? 0).toFixed(2)} Tons)
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {(entry.crusher_powder_kg ?? 0).toLocaleString()} Kg ({convertToTons(entry.crusher_powder_kg ?? 0).toFixed(2)} Tons)
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {(entry.fly_ash_kg ?? 0).toLocaleString()} Kg ({convertToTons(entry.fly_ash_kg ?? 0).toFixed(2)} Tons)
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {(entry.cement_bags ?? 0).toLocaleString()} Bags ({((entry.cement_bags ?? 0) * 50).toLocaleString()} Kg)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Adjustments Tab */}
            {activeTab === 'Adjustments' && (
              <div className="overflow-x-auto">
                {adjustmentsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading adjustments...</p>
                  </div>
                ) : getFilteredAdjustmentData().length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No adjustments found</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Date</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">No of Bricks</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Wet Ash (Kg)</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Marble Powder (Kg)</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Crusher Powder (Kg)</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Fly Ash (Kg)</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Cement (Kg)</th>
                        <th className="px-4 py-3 text-left text-gray-700 whitespace-nowrap">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getFilteredAdjustmentData().slice(0, displayCount).map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">{formatDate(entry.adjustment_date)}</td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {formatAdjustmentValueDisplay(entry.actual_bricks, entry.adjusted_bricks)}
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {formatAdjustmentValueDisplay(entry.actual_wet_ash_kg, entry.adjusted_wet_ash_kg)}
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {formatAdjustmentValueDisplay(entry.actual_marble_powder_kg, entry.adjusted_marble_powder_kg)}
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {formatAdjustmentValueDisplay(entry.actual_crusher_powder_kg, entry.adjusted_crusher_powder_kg)}
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {formatAdjustmentValueDisplay(entry.actual_fly_ash_kg, entry.adjusted_fly_ash_kg)}
                          </td>
                          <td className="px-4 py-4 text-gray-900 whitespace-nowrap">
                            {formatAdjustmentValueDisplay(entry.actual_cement_bags, entry.adjusted_cement_bags)}
                          </td>
                          <td className="px-4 py-4 text-gray-900 text-sm">{entry.reason || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Load More Button */}
            {hasMoreData && (
              <div className="flex justify-center pt-6">
                <button
                  onClick={() => setDisplayCount(displayCount + 10)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Range Modal */}
      {showCustomRangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-gray-900 mb-4">Custom Date Range</h2>
            
            <div className="space-y-4">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-gray-700 mb-2">
                  Start <span className="text-red-600">*</span>
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="endDate" className="block text-gray-700 mb-2">
                  End <span className="text-red-600">*</span>
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCancelCustomRange}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCustomRange}
                  disabled={!customStartDate || !customEndDate}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    customStartDate && customEndDate
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Make Adjustments Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-gray-900 mb-4">Make Adjustments</h2>
            
            <div className="space-y-4">
              {/* Bricks Ready */}
              <div>
                <label htmlFor="adjBricksReady" className="block text-gray-700 mb-2">
                  Bricks Ready
                </label>
                <input
                  id="adjBricksReady"
                  type="number"
                  value={adjBricksReady}
                  onChange={(e) => setAdjBricksReady(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Wet Ash */}
              <div>
                <label htmlFor="adjWetAsh" className="block text-gray-700 mb-2">
                  Wet Ash (Kg)
                </label>
                <input
                  id="adjWetAsh"
                  type="number"
                  value={adjWetAsh}
                  onChange={(e) => setAdjWetAsh(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Marble Powder */}
              <div>
                <label htmlFor="adjMarblePowder" className="block text-gray-700 mb-2">
                  Marble Powder (Kg)
                </label>
                <input
                  id="adjMarblePowder"
                  type="number"
                  value={adjMarblePowder}
                  onChange={(e) => setAdjMarblePowder(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Crusher Powder */}
              <div>
                <label htmlFor="adjCrusherPowder" className="block text-gray-700 mb-2">
                  Crusher Powder (Kg)
                </label>
                <input
                  id="adjCrusherPowder"
                  type="number"
                  value={adjCrusherPowder}
                  onChange={(e) => setAdjCrusherPowder(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Fly Ash */}
              <div>
                <label htmlFor="adjFlyAsh" className="block text-gray-700 mb-2">
                  Fly Ash (Kg)
                </label>
                <input
                  id="adjFlyAsh"
                  type="number"
                  value={adjFlyAsh}
                  onChange={(e) => setAdjFlyAsh(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Cement */}
              <div>
                <label htmlFor="adjCement" className="block text-gray-700 mb-2">
                  Cement (Bags)
                </label>
                <input
                  id="adjCement"
                  type="number"
                  value={adjCement}
                  onChange={(e) => setAdjCement(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Reason (Optional) */}
              <div>
                <label htmlFor="adjReason" className="block text-gray-700 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  id="adjReason"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g., Physical count discrepancy, theft, damage..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={handleCancelAdjustment}
                  disabled={adjLoading}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAdjustment}
                  disabled={adjLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-75 flex items-center gap-2"
                >
                  {adjLoading && (
                    <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {adjLoading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <Popup
          title="Adjustment Submitted"
          message="The inventory adjustment has been recorded successfully."
          onClose={() => setShowSuccessPopup(false)}
          type="success"
        />
      )}
    </div>
  );
}