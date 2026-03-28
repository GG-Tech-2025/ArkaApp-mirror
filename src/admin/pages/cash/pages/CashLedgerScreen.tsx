import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Popup } from '../../../../components/Popup';
import { useNavigate, useParams } from 'react-router-dom';
import { getCashLedgerForDate, getAccounts, CASH_ACCOUNT_ID } from '../../../../services/middleware.service';
import type { CashLedgerForDate, Account, AccountAggregate } from '../../../../services/types';

export function CashLedgerScreen() {
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const [activeTab, setActiveTab] = useState<'cash-in' | 'cash-out'>('cash-in');
  const [ledgerData, setLedgerData] = useState<CashLedgerForDate | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const ledgerDate = date ?? new Date().toISOString().split('T')[0];

  const formatDate = (dateString: string) => {
    const dateOnly = dateString.split(' ')[0].split('T')[0];
    const d = new Date(dateOnly + 'T00:00:00');
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ledger, accs] = await Promise.all([
        getCashLedgerForDate(ledgerDate),
        getAccounts(),
      ]);
      setLedgerData(ledger);
      setAccounts(accs);
    } catch (err) {
      console.error('Failed to load cash ledger:', err);
      setErrorMessage((err as Error).message || 'Failed to load cash ledger');
      setShowErrorPopup(true);
    } finally {
      setLoading(false);
    }
  }, [ledgerDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Derived values ───
  const cashAccount = accounts.find((a) => a.id === CASH_ACCOUNT_ID);
  const bankAccounts = accounts.filter((a) => a.id !== CASH_ACCOUNT_ID);

  const totalCashIn = ledgerData?.total_cash_in ?? 0;
  const totalCashOut = ledgerData?.total_cash_out ?? 0;

  // Build per-account summary cards from aggregates
  const buildAccountSummary = () => {
    const cashInByAccount = ledgerData?.cash_in_by_account ?? [];
    const cashOutByAccount = ledgerData?.cash_out_by_account ?? [];

    // Collect all unique account IDs
    const allAccountIds = new Set<string | null>();
    if (cashAccount) allAccountIds.add(cashAccount.id);
    bankAccounts.forEach((a) => allAccountIds.add(a.id));
    cashInByAccount.forEach((a) => allAccountIds.add(a.account_id));
    cashOutByAccount.forEach((a) => allAccountIds.add(a.account_id));

    const findIn = (accountId: string | null) =>
      cashInByAccount.find((a) => a.account_id === accountId)?.total ?? 0;
    const findOut = (accountId: string | null) =>
      cashOutByAccount.find((a) => a.account_id === accountId)?.total ?? 0;

    return {
      cash: {
        cashIn: findIn(CASH_ACCOUNT_ID),
        cashOut: findOut(CASH_ACCOUNT_ID),
      },
      banks: bankAccounts.map((ba) => ({
        id: ba.id,
        accountNumber: ba.account_number,
        cashIn: findIn(ba.id),
        cashOut: findOut(ba.id),
      })),
    };
  };

  const accountSummary = ledgerData ? buildAccountSummary() : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/cash')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Cash Flow
          </button>

          <div>
            <h1 className="text-gray-900">Cash Ledger - {formatDate(ledgerDate)}</h1>
            <p className="text-gray-600 mt-1">Daily cash flow tracking</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Card */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6 border-2 border-blue-200">
                <h3 className="text-gray-700 mb-4">Total</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">Cash In</span>
                    <span className="text-green-600">₹{totalCashIn.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">Cash Out</span>
                    <span className="text-red-600">₹{totalCashOut.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-300">
                    <span className="text-gray-900">Net</span>
                    <span className={totalCashIn - totalCashOut >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ₹{(totalCashIn - totalCashOut).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cash Account Card */}
              {accountSummary && (
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                  <h3 className="text-gray-700 mb-4">Cash</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 text-sm">Cash In</span>
                      <span className="text-green-600">₹{accountSummary.cash.cashIn.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 text-sm">Cash Out</span>
                      <span className="text-red-600">₹{accountSummary.cash.cashOut.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Account Cards */}
              {accountSummary?.banks.map((bank) => (
                <div key={bank.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                  <h3 className="text-gray-700 mb-4">#{bank.accountNumber}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 text-sm">Cash In</span>
                      <span className="text-green-600">₹{bank.cashIn.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 text-sm">Cash Out</span>
                      <span className="text-red-600">₹{bank.cashOut.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('cash-in')}
                    className={`flex-1 px-6 py-4 text-center transition-colors ${
                      activeTab === 'cash-in'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Cash In ({ledgerData?.cash_in_entries.length ?? 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('cash-out')}
                    className={`flex-1 px-6 py-4 text-center transition-colors ${
                      activeTab === 'cash-out'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Cash Out ({ledgerData?.cash_out_entries.length ?? 0})
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'cash-in' ? (
                  <div className="overflow-x-auto">
                    {(ledgerData?.cash_in_entries.length ?? 0) === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No cash-in entries for this date.
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-gray-700">Source Type</th>
                            <th className="px-4 py-3 text-left text-gray-700">Description</th>
                            <th className="px-4 py-3 text-left text-gray-700">Account</th>
                            <th className="px-4 py-3 text-left text-gray-700">Mode</th>
                            <th className="px-4 py-3 text-left text-gray-700">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {ledgerData?.cash_in_entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-gray-900">{entry.source_type}</td>
                              <td className="px-4 py-4 text-gray-700">{entry.description}</td>
                              <td className="px-4 py-4 text-gray-700">{entry.receiver_account_number}</td>
                              <td className="px-4 py-4 text-gray-700">{entry.payment_mode}</td>
                              <td className="px-4 py-4 text-green-600">+₹{entry.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {(ledgerData?.cash_out_entries.length ?? 0) === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No cash-out entries for this date.
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-gray-700">Payment Type</th>
                            <th className="px-4 py-3 text-left text-gray-700">Description</th>
                            <th className="px-4 py-3 text-left text-gray-700">Account</th>
                            <th className="px-4 py-3 text-left text-gray-700">Mode</th>
                            <th className="px-4 py-3 text-left text-gray-700">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {ledgerData?.cash_out_entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-gray-900">{entry.payment_type}</td>
                              <td className="px-4 py-4 text-gray-700">{entry.description}</td>
                              <td className="px-4 py-4 text-gray-700">{entry.sender_account_number}</td>
                              <td className="px-4 py-4 text-gray-700">{entry.payment_mode}</td>
                              <td className="px-4 py-4 text-red-600">-₹{entry.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Error Popup */}
      {showErrorPopup && (
        <Popup
          title="Error"
          message={errorMessage}
          onClose={() => setShowErrorPopup(false)}
        />
      )}
    </div>
  );
}
