import type { CreateAccountTransferInput } from '../../services/types';

export function validateAccountTransfer(
  input: CreateAccountTransferInput
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.sender_account_id) {
    errors.sender_account_id = 'Sender account is required';
  }

  if (!input.receiver_account_id) {
    errors.receiver_account_id = 'Receiver account is required';
  }

  if (input.sender_account_id && input.receiver_account_id && input.sender_account_id === input.receiver_account_id) {
    errors.receiver_account_id = 'Sender and receiver must be different accounts';
  }

  if (input.amount === null || input.amount === undefined || isNaN(Number(input.amount))) {
    errors.amount = 'Amount is required';
  } else if (Number(input.amount) <= 0) {
    errors.amount = 'Amount must be greater than 0';
  }

  if (!input.transfer_date) {
    errors.transfer_date = 'Transfer date is required';
  }

  return errors;
}
