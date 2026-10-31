import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popup } from '../../../../components/Popup';
import {
  getAccounts,
  getWithdrawals,
  getTotalWithdrawalsAmount,
  createWithdrawal,
} from '../../../../services/middleware.service';
import type { Account, Withdrawal } from '../../../../services/types';

interface WithdrawFormInput {
  account_id: string;
  amount: string;
  date: string;
  notes: string;
}

const today = new Date().toISOString().split('T')[0];

export function WithdrawMoneyScreen() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [totalWithdrawalsAmount, setTotalWithdrawalsAmount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [formInput, setFormInput] = useState<WithdrawFormInput>({
    account_id: '',
    amount: '',
    date: today,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');

  useEffect(() => {
    Promise.all([getAccounts(), getWithdrawals(0), getTotalWithdrawalsAmount()])
      .then(([accts, result, total]) => {
        setAccounts(accts);
        setWithdrawals(result.data);
        setHasMore(result.hasMore);
        setTotalWithdrawalsAmount(total);
      })
      .catch((err) => console.error('Failed to load data:', err))
      .finally(() => setLoadingData(false));
  }, []);

  function update<K extends keyof WithdrawFormInput>(field: K, value: string) {
    setFormInput((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!formInput.account_id) errs.account_id = 'Account is required';
    const amt = Number(formInput.amount);
    if (!formInput.amount || isNaN(amt) || amt <= 0)
      errs.amount = 'Amount must be greater than 0';
    if (formInput.account_id && !isNaN(amt) && amt > 0) {
      const selected = accounts.find((a) => a.id === formInput.account_id);
      const availableBalance = Number(selected?.balance ?? 0);
      if (selected && amt > availableBalance) {
        errs.amount = 'Amount cannot be greater than available account balance';
      }
    }
    if (!formInput.date) errs.date = 'Date is required';
    return errs;
  }

  async function handleSubmit() {
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setSubmitting(true);
      await createWithdrawal({
        account_id: formInput.account_id,
        amount: Number(formInput.amount),
        date: formInput.date,
        notes: formInput.notes.trim() || null,
      });
      // Refresh accounts + list to keep balances in sync
      const [accts, result, total] = await Promise.all([
        getAccounts(),
        getWithdrawals(0),
        getTotalWithdrawalsAmount(),
      ]);
      setAccounts(accts);
      setWithdrawals(result.data);
      setHasMore(result.hasMore);
      setTotalWithdrawalsAmount(total);
      setPage(0);
      // Reset form
      setFormInput({ account_id: '', amount: '', date: today, notes: '' });
      setShowSuccessPopup(true);
    } catch (err) {
      setFailureMessage((err as Error).message || 'Failed to create withdrawal');
      setShowFailurePopup(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadMore() {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const result = await getWithdrawals(nextPage);
      setWithdrawals((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const selectedAccount = accounts.find((a) => a.id === formInput.account_id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/cash')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Cash Flow
          </button>
          <h1 className="text-gray-900">Withdraw Money</h1>
          <p className="text-gray-600 mt-1">Record a withdrawal from an account</p>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500 text-center">
            <p className="text-gray-600 text-sm mb-2">Total Withdrawals</p>
            <p className="text-green-600 text-2xl font-bold">₹{totalWithdrawalsAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-8">
          <div className="space-y-5">
            {/* Account */}
            <div>
              <label htmlFor="account_id" className="block text-gray-700 mb-2">
                Account <span className="text-red-600">*</span>
              </label>
              {loadingData ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts...
                </div>
              ) : (
                <select
                  id="account_id"
                  value={formInput.account_id}
                  onChange={(e) => update('account_id', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                    errors.account_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_number} — ₹{Number(a.balance).toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
              {errors.account_id && (
                <p className="text-red-600 text-sm mt-1">{errors.account_id}</p>
              )}
              {selectedAccount && (
                <p className="text-gray-500 text-sm mt-1">
                  Available balance: ₹{Number(selectedAccount.balance).toLocaleString()}
                </p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-gray-700 mb-2">
                Amount (₹) <span className="text-red-600">*</span>
              </label>
              <input
                id="amount"
                type="number"
                value={formInput.amount}
                onChange={(e) => update('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter amount"
                min="1"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amount && (
                <p className="text-red-600 text-sm mt-1">{errors.amount}</p>
              )}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-gray-700 mb-2">
                Date <span className="text-red-600">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={formInput.date}
                onChange={(e) => update('date', e.target.value)}
                max={today}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.date && (
                <p className="text-red-600 text-sm mt-1">{errors.date}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                value={formInput.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Optional notes"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Withdraw'}
            </button>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-gray-900">Withdrawal History</h2>
          </div>
          <div className="p-6">
            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : withdrawals.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No withdrawals yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-700">Date</th>
                      <th className="px-4 py-3 text-left text-gray-700">Account</th>
                      <th className="px-4 py-3 text-left text-gray-700">Amount</th>
                      <th className="px-4 py-3 text-left text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-900">{formatDate(w.date)}</td>
                        <td className="px-4 py-4 text-gray-900">
                          {(w.accounts as any)?.account_number ?? '-'}
                        </td>
                        <td className="px-4 py-4 text-red-600">₹{Number(w.amount).toLocaleString()}</td>
                        <td className="px-4 py-4 text-gray-600">{w.notes ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSuccessPopup && (
        <Popup
          title="Withdrawal Recorded"
          message="The withdrawal has been recorded successfully."
          onClose={() => setShowSuccessPopup(false)}
          type="success"
        />
      )}

      {showFailurePopup && (
        <Popup
          title="Withdrawal Failed"
          message={failureMessage}
          onClose={() => setShowFailurePopup(false)}
          type="error"
        />
      )}
    </div>
  );
}
