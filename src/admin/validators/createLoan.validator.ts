import type { CreateLoanInput } from '../../services/types';

export function validateCreateLoan(input: CreateLoanInput): Record<string, string> {
  const errors: Record<string, string> = {};

  // Lender Name validation
  if (!input.lender_name.trim()) {
    errors.lender_name = 'Lender name is required';
  }

  // Principal Amount validation
  if (!input.principal_amount || input.principal_amount <= 0) {
    errors.principal_amount = 'Principal amount must be a valid positive number';
  }

  // Interest Rate validation (optional, but must be valid if provided)
  if (input.interest_rate !== null && input.interest_rate !== undefined) {
    if (isNaN(Number(input.interest_rate)) || Number(input.interest_rate) < 0) {
      errors.interest_rate = 'Interest rate must be a valid non-negative number';
    }
  }

  // Loan Start Date validation
  if (!input.start_date) {
    errors.start_date = 'Loan start date is required';
  }

  // Disbursement Account validation
  if (!input.disbursement_account_id) {
    errors.disbursement_account_id = 'Disbursement account is required';
  }

  return errors;
}
