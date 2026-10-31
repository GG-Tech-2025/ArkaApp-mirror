import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popup } from '../../../../components/Popup';
import {
  getAccounts,
  getAccountTransfers,
  createAccountTransfer,
} from '../../../../services/middleware.service';
import type {
  Account,
  AccountTransfer,
  CreateAccountTransferInput,
} from '../../../../services/types';
import { validateAccountTransfer } from '../../../validators/accountTransfer.validator';

const today = new Date().toISOString().split('T')[0];

export function SwitchBalanceScreen() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [formInput, setFormInput] = useState<CreateAccountTransferInput>({
    sender_account_id: '',
    receiver_account_id: '',
    amount: 0,
    transfer_date: today,
    notes: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');

  useEffect(() => {
    Promise.all([getAccounts(), getAccountTransfers(0)])
      .then(([accts, result]) => {
        setAccounts(accts);
        setTransfers(result.data);
        setHasMore(result.hasMore);
      })
      .catch((err) => {
        console.error('Failed to load transfer data:', err);
        setFailureMessage((err as Error).message || 'Failed to load transfer data');
        setShowFailurePopup(true);
      })
      .finally(() => setLoadingData(false));
  }, []);

  function update<K extends keyof CreateAccountTransferInput>(field: K, value: CreateAccountTransferInput[K]) {
    setFormInput((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  }

  const selectedSender = accounts.find((a) => a.id === formInput.sender_account_id);

  function validate(): Record<string, string> {
    const validation = validateAccountTransfer(formInput);
    if (selectedSender && !isNaN(Number(formInput.amount)) && Number(formInput.amount) > Number(selectedSender.balance)) {
      validation.amount = 'Amount cannot be greater than sender account balance';
    }
    return validation;
  }

  async function handleSubmit() {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      setSubmitting(true);
      await createAccountTransfer(formInput);
      const [accts, result] = await Promise.all([getAccounts(), getAccountTransfers(0)]);
      setAccounts(accts);
      setTransfers(result.data);
      setHasMore(result.hasMore);
      setPage(0);
      setFormInput({
        sender_account_id: '',
        receiver_account_id: '',
        amount: 0,
        transfer_date: today,
        notes: null,
      });
      setShowSuccessPopup(true);
    } catch (err) {
      setFailureMessage((err as Error).message || 'Failed to switch balance');
      setShowFailurePopup(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadMore() {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const result = await getAccountTransfers(nextPage);
      setTransfers((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more transfers:', err);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/cash')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Cash Flow
          </button>
          <h1 className="text-gray-900">Switch Balance</h1>
          <p className="text-gray-600 mt-1">Transfer funds between accounts without withdrawing cash.</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-8">
          <div className="space-y-5">
            <div>
              <label htmlFor="sender_account_id" className="block text-gray-700 mb-2">
                Sender Account <span className="text-red-600">*</span>
              </label>
              {loadingData ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts...
                </div>
              ) : (
                <select
                  id="sender_account_id"
                  value={formInput.sender_account_id}
                  onChange={(e) => update('sender_account_id', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                    errors.sender_account_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select sender account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_number} — ₹{Number(account.balance).toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
              {errors.sender_account_id && (
                <p className="text-red-600 text-sm mt-1">{errors.sender_account_id}</p>
              )}
              {selectedSender && (
                <p className="text-gray-500 text-sm mt-1">
                  Available balance: ₹{Number(selectedSender.balance).toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="receiver_account_id" className="block text-gray-700 mb-2">
                Receiver Account <span className="text-red-600">*</span>
              </label>
              <select
                id="receiver_account_id"
                value={formInput.receiver_account_id}
                onChange={(e) => update('receiver_account_id', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.receiver_account_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select receiver account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_number} — ₹{Number(account.balance).toLocaleString()}
                  </option>
                ))}
              </select>
              {errors.receiver_account_id && (
                <p className="text-red-600 text-sm mt-1">{errors.receiver_account_id}</p>
              )}
            </div>

            <div>
              <label htmlFor="amount" className="block text-gray-700 mb-2">
                Amount (₹) <span className="text-red-600">*</span>
              </label>
              <input
                id="amount"
                type="number"
                min="0"
                value={formInput.amount === 0 ? '' : formInput.amount}
                onChange={(e) => update('amount', Number(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter transfer amount"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amount && (
                <p className="text-red-600 text-sm mt-1">{errors.amount}</p>
              )}
            </div>

            <div>
              <label htmlFor="transfer_date" className="block text-gray-700 mb-2">
                Transfer Date <span className="text-red-600">*</span>
              </label>
              <input
                id="transfer_date"
                type="date"
                value={formInput.transfer_date}
                max={today}
                onChange={(e) => update('transfer_date', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                  errors.transfer_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.transfer_date && (
                <p className="text-red-600 text-sm mt-1">{errors.transfer_date}</p>
              )}
            </div>

            <div>
              <label htmlFor="notes" className="block text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                value={formInput.notes ?? ''}
                onChange={(e) => update('notes', e.target.value || null)}
                rows={3}
                placeholder="Optional notes"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Transfer'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-gray-900">Transfer History</h2>
          </div>
          <div className="p-6">
            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : transfers.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No transfers recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-700">Date</th>
                      <th className="px-4 py-3 text-left text-gray-700">Sender</th>
                      <th className="px-4 py-3 text-left text-gray-700">Receiver</th>
                      <th className="px-4 py-3 text-left text-gray-700">Amount</th>
                      <th className="px-4 py-3 text-left text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transfers.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-900">{formatDate(transfer.transfer_date)}</td>
                        <td className="px-4 py-4 text-gray-900">
                          {transfer.sender_account?.account_number ?? transfer.sender_account_id}
                        </td>
                        <td className="px-4 py-4 text-gray-900">
                          {transfer.receiver_account?.account_number ?? transfer.receiver_account_id}
                        </td>
                        <td className="px-4 py-4 text-green-600">₹{Number(transfer.amount).toLocaleString()}</td>
                        <td className="px-4 py-4 text-gray-600">{transfer.notes ?? '-'}</td>
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
          title="Balance Switched"
          message="The account balance transfer was recorded successfully."
          onClose={() => setShowSuccessPopup(false)}
          type="success"
        />
      )}

      {showFailurePopup && (
        <Popup
          title="Transfer Failed"
          message={failureMessage}
          onClose={() => setShowFailurePopup(false)}
          type="error"
        />
      )}
    </div>
  );
}
