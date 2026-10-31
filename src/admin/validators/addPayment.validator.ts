export type PaymentEntryTypeLabel =
  | 'Advance Payment'
  | 'Weekly Payment'
  | 'Emergency Payment'
  | 'Daily / Ad-hoc Payment'
  | 'Partial Settlement'
  | 'Full Settlement'
  | 'Manual Salary Entry'
  | '';

export type PaymentModeLabel = 'UPI' | 'Bank Transfer' | 'Cash';

export interface AddPaymentFormInput {
  entryType: PaymentEntryTypeLabel;
  amount: string;
  dateTime: string;
  notes: string;
  modeOfPayment: PaymentModeLabel;
  senderAccountId: string;
  receiverAccountInfo: string;
}

export function validateAddPayment(
  input: AddPaymentFormInput,
  runningBalance: number,
  selectedAccountBalance?: number | null
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.entryType) {
    errors.entryType = 'Entry type is required';
  } else if (input.entryType === 'Full Settlement' && runningBalance === 0) {
    errors.entryType = 'No pending balance available for settlement';
  }

  if (!input.amount.trim()) {
    errors.amount = 'Please enter a valid amount';
  } else if (isNaN(Number(input.amount)) || Number(input.amount) <= 0) {
    errors.amount = 'Please enter a valid amount';
  } else if (
    input.entryType === 'Partial Settlement' &&
    Number(input.amount) > runningBalance
  ) {
    errors.amount = 'Settlement amount cannot exceed pending balance';
  }

  if (!input.dateTime) {
    errors.dateTime = 'Date and time is required';
  } else if (new Date(input.dateTime) > new Date()) {
    errors.dateTime = 'Date cannot be in the future';
  }

  if (input.entryType !== 'Manual Salary Entry') {
    if (!input.modeOfPayment) {
      errors.modeOfPayment = 'Mode of payment is required';
    }

    if (input.modeOfPayment !== 'Cash') {
      if (!input.senderAccountId) {
        errors.senderAccountId = 'SAI is required';
      }
      if (!input.receiverAccountInfo.trim()) {
        errors.receiverAccountInfo = 'RAI is required';
      }
    }

    // Validate that the selected account has sufficient balance
    if (
      !errors.amount &&
      selectedAccountBalance != null &&
      Number(input.amount) > selectedAccountBalance
    ) {
      errors.amount = `Insufficient account balance (₹${selectedAccountBalance.toLocaleString()} available)`;
    }
  }

  return errors;
}
