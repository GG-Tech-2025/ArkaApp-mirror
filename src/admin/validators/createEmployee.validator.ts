import type { CreateEmployeeInput, RoleWithCategory } from '../../services/types';

export function validateCreateEmployee(
  input: CreateEmployeeInput,
  selectedRole?: RoleWithCategory
): Record<string, string> {
  const errors: Record<string, string> = {};

  // Name validation
  if (!input.name.trim()) {
    errors.name = 'Employee name is required';
  }

  // Phone validation
  if (!input.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!/^[0-9]{10}$/.test(input.phone)) {
    errors.phone = 'Phone number must be 10 digits';
  }

  // Alternate phone validation (optional, but must be valid if provided)
  if (input.alternate_phone && !/^[0-9]{10}$/.test(input.alternate_phone)) {
    errors.alternate_phone = 'Alternate phone must be 10 digits';
  }

  // Blood group validation
  if (!input.blood_group.trim()) {
    errors.blood_group = 'Blood group is required';
  }

  // Aadhar number validation
  if (!input.aadhar_number.trim()) {
    errors.aadhar_number = 'Aadhar number is required';
  } else if (!/^[0-9]{12}$/.test(input.aadhar_number.replace(/[-\s]/g, ''))) {
    errors.aadhar_number = 'Aadhar number must be 12 digits';
  }

  // Permanent address validation
  if (!input.permanent_address.trim()) {
    errors.permanent_address = 'Permanent address is required';
  }

  // Role validation
  if (!input.role_id) {
    errors.role_id = 'Employee role is required';
  }

  // Emergency contact phone validation (optional, but must be valid if provided)
  if (
    input.emergency_contact_phone &&
    !/^[0-9]{10}$/.test(input.emergency_contact_phone)
  ) {
    errors.emergency_contact_phone = 'Emergency contact number must be 10 digits';
  }

  // Deduction amount validation (mandatory for FIXED salary employees)
  if (selectedRole?.category === 'FIXED') {
    if (input.deduction_amount == null || input.deduction_amount <= 0) {
      errors.deduction_amount = 'Deduction amount is required for fixed salary employees';
    }
  }

  return errors;
}
