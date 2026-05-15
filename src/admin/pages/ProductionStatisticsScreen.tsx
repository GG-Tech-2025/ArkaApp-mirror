import React, { useState, useEffect } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { useAdminNavigation } from '../hooks/useAdminNavigation';
import { useProductionEntries } from '../hooks/useProductionEntries';
import { Popup } from '../../components/Popup';


// fetch handled by `useProductionEntries` hook in admin/hooks

export function ProductionStatisticsScreen() {
  const { goBack } = useAdminNavigation();
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const { entries: productionEntries, loading, refetch, error } = useProductionEntries();
  // Hook currently returns `entries` and `refetch`. Normalize to the
  // shape expected by this component (camelCase keys and `date`).
  const loadMore = refetch; // compatibility alias (no pagination implemented in hook)
  const hasMore = false;

  const normalizedEntries = productionEntries.map((e: any) => ({
    date: e.production_date || e.date || '',
    bricks: e.bricks ?? 0,
    round: e.round ?? 0,
    wetAshKg: e.wet_ash_kg ?? e.wetAshKg ?? 0,
    marblePowderKg: e.marble_powder_kg ?? e.marblePowderKg ?? 0,
    crusherPowderKg: e.crusher_powder_kg ?? e.crusherPowderKg ?? 0,
    flyAshKg: e.fly_ash_kg ?? e.flyAshKg ?? 0,
    cementBags: e.cement_bags ?? e.cementBags ?? 0,
    notes: e.notes ?? null,
  }));
  // Show error popup when API fails
  useEffect(() => {
    if (error) {
      setShowErrorPopup(true);
    }
  }, [error]);

  // Handle error popup close - navigate to admin home
  const handleErrorClose = () => {
    setShowErrorPopup(false);
    goBack('/admin/home');
  };
  // Graph data: use up to first 30 entries from the initial pull; reverse so oldest->newest on x-axis
  const graphData = normalizedEntries
    .slice(0, 30)
    .map((e) => ({ date: formatGraphLabel(e.date), bricks: e.bricks }))
    .reverse();

  // For the history table we show all entries fetched so far (appended on loadMore)
  const displayedEntries = normalizedEntries;

  // Helper functions for conversions
  const convertToTons = (round: number, kgs: number): number => {
    return (round * kgs) / 1000;
  };

  // Cement is stored as number of bags in the backend — display directly
  const formatCementBags = (bags: number): number => bags;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  function formatGraphLabel(dateString: string) {
    const d = new Date(dateString);
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
  }

  // Most recent production entry from the fetched data (if any)
  const yesterday = normalizedEntries.length > 0 ? normalizedEntries[0] : null;

  const MAX_BRICKS = 15000;
  const CIRCLE_CIRCUMFERENCE = 440;
  const bricksProgress = yesterday ? Math.min(yesterday.bricks, MAX_BRICKS) / MAX_BRICKS : 0;
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - bricksProgress);

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
          <h1 className="text-gray-900">Production Statistics</h1>
          <p className="text-gray-600 mt-1">View production metrics and performance</p>
        </div>

        {/* Top Section - Graph and Yesterday's Production */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Production Graph - This Month */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-gray-900 mb-4">This Month's Production</h2>
            {loading ? (
              <div className="text-gray-500">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="bricks"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Bricks Produced"
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Yesterday's Production with Progress Circle */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-gray-900 mb-6">Last Production</h2>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              {/* Animated Progress Circle */}
              <div className="flex-shrink-0">
                <div className="relative w-40 h-40">
                  {/* Static progress ring */}
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="#E5E7EB"
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="#10B981"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={CIRCLE_CIRCUMFERENCE}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center content */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-gray-900 text-2xl">{yesterday ? yesterday.bricks.toLocaleString() : '-'}</p>
                      <p className="text-gray-600 text-xs">/ {MAX_BRICKS.toLocaleString()}</p>
                      <p className="text-gray-600 text-sm">Bricks</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Materials List */}
              <div className="flex-1 space-y-3 w-full">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div className="flex justify-between w-full">
                    <span className="text-gray-700">Round:</span>
                    <span className="text-gray-900">{yesterday ? yesterday.round : '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div className="flex justify-between w-full">
                    <span className="text-gray-700">Wet Ash:</span>
                    <span className="text-gray-900">
                      {yesterday ? convertToTons(yesterday.round, yesterday.wetAshKg).toFixed(2) + ' Tons' : '-'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div className="flex justify-between w-full">
                    <span className="text-gray-700">Marble Powder:</span>
                    <span className="text-gray-900">
                      {yesterday ? convertToTons(yesterday.round, yesterday.marblePowderKg).toFixed(2) + ' Tons' : '-'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div className="flex justify-between w-full">
                    <span className="text-gray-700">Crusher Powder:</span>
                    <span className="text-gray-900">
                      {yesterday ? convertToTons(yesterday.round, yesterday.crusherPowderKg).toFixed(2) + ' Tons' : '-'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div className="flex justify-between w-full">
                    <span className="text-gray-700">Fly Ash:</span>
                    <span className="text-gray-900">
                      {yesterday ? convertToTons(yesterday.round, yesterday.flyAshKg).toFixed(2) + ' Tons' : '-'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div className="flex justify-between w-full">
                    <span className="text-gray-700">Cement:</span>
                    <span className="text-gray-900">
                      {yesterday ? formatCementBags(yesterday.cementBags).toFixed(0) + ' Bags' : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Production Entries Table */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-gray-900">Production History</h2>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-gray-700">No of Bricks</th>
                    <th className="px-4 py-3 text-left text-gray-700">Round</th>
                    <th className="px-4 py-3 text-left text-gray-700">Wet Ash (Tons)</th>
                    <th className="px-4 py-3 text-left text-gray-700">Marble Powder (Tons)</th>
                    <th className="px-4 py-3 text-left text-gray-700">Crusher Powder (Tons)</th>
                    <th className="px-4 py-3 text-left text-gray-700">Fly Ash (Tons)</th>
                    <th className="px-4 py-3 text-left text-gray-700">Cement (Bags)</th>
                    <th className="px-4 py-3 text-left text-gray-700">Notes</th>
                    <th className="px-4 py-3 text-center text-gray-700">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayedEntries.map((entry, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-gray-900">{formatDate(entry.date)}</td>
                      <td className="px-4 py-4 text-gray-900">{entry.bricks.toLocaleString()}</td>
                      <td className="px-4 py-4 text-gray-900">{entry.round}</td>
                      <td className="px-4 py-4 text-gray-900">
                        {convertToTons(entry.round, entry.wetAshKg).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-gray-900">
                        {convertToTons(entry.round, entry.marblePowderKg).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-gray-900">
                        {convertToTons(entry.round, entry.crusherPowderKg).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-gray-900">
                        {convertToTons(entry.round, entry.flyAshKg).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-gray-900">
                        {formatCementBags(entry.cementBags).toFixed(0)}
                      </td>
                      <td className="px-4 py-4 text-gray-500 max-w-37.5">
                        {entry.notes
                          ? entry.notes.length > 25
                            ? entry.notes.slice(0, 25) + '...'
                            : entry.notes
                          : '—'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => { setSelectedEntry(entry); setShowEntryModal(true); }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <Info size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => loadMore()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Entry Details Modal */}
      {showEntryModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Production Entry</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-900 font-medium">{formatDate(selectedEntry.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bricks</span>
                <span className="text-gray-900 font-medium">{selectedEntry.bricks.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Round</span>
                <span className="text-gray-900 font-medium">{selectedEntry.round}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Wet Ash</span>
                <span className="text-gray-900 font-medium">{convertToTons(selectedEntry.round, selectedEntry.wetAshKg).toFixed(2)} Tons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Marble Powder</span>
                <span className="text-gray-900 font-medium">{convertToTons(selectedEntry.round, selectedEntry.marblePowderKg).toFixed(2)} Tons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Crusher Powder</span>
                <span className="text-gray-900 font-medium">{convertToTons(selectedEntry.round, selectedEntry.crusherPowderKg).toFixed(2)} Tons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fly Ash</span>
                <span className="text-gray-900 font-medium">{convertToTons(selectedEntry.round, selectedEntry.flyAshKg).toFixed(2)} Tons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cement</span>
                <span className="text-gray-900 font-medium">{formatCementBags(selectedEntry.cementBags).toFixed(0)} Bags</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-gray-500 mb-1">Notes</p>
                <p className="text-gray-900 whitespace-pre-wrap">{selectedEntry.notes || '—'}</p>
              </div>
            </div>
            <button
              onClick={() => setShowEntryModal(false)}
              className="mt-5 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Error Popup */}
      {showErrorPopup && (
        <Popup
          title="Error Loading Data"
          message={error || 'Failed to load production data. Please try again.'}
          type="error"
          onClose={handleErrorClose}
        />
      )}
    </div>
  );
}