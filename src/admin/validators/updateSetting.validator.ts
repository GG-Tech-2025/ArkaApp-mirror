export interface UpdateSettingInput {
  value: string;
}

export function validateUpdateSetting(input: UpdateSettingInput): {
  isValid: boolean;
  errors: { value?: string };
} {
  const errors: { value?: string } = {};

  // Validate value is not empty
  if (!input.value || input.value.trim() === '') {
    errors.value = 'Value is required';
  }

  // Validate numeric value for price settings
  const numValue = parseFloat(input.value);
  if (isNaN(numValue)) {
    errors.value = 'Value must be a valid number';
  } else if (numValue < 0) {
    errors.value = 'Value must be greater than or equal to 0';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
