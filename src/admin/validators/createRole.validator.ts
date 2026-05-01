export type RoleCategoryLabel = 'Daily Wages' | 'Fixed Salary' | 'Loadmen' | '';

export interface CreateRoleFormInput {
  roleName: string;
  category: RoleCategoryLabel;
  perDayWage: string;
  monthlySalary: string;
  ratePerLoad: string;
  minimumLoadRequirement: string;
  no_loading_salary: boolean;
}

export function validateCreateRole(input: CreateRoleFormInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.roleName.trim()) {
    errors.roleName = 'Role name is required';
  }

  if (!input.category) {
    errors.category = 'Category is required';
  }

  if (input.category === 'Daily Wages') {
    if (!input.perDayWage.trim()) {
      errors.perDayWage = 'Per day wage is required';
    } else if (isNaN(Number(input.perDayWage)) || Number(input.perDayWage) <= 0) {
      errors.perDayWage = 'Please enter a valid wage amount';
    } else if (input.perDayWage.includes('.')) {
      errors.perDayWage = 'Only integers allowed';
    } else if (input.perDayWage.length > 5) {
      errors.perDayWage = 'Maximum 5 digits allowed';
    }
  }

  if (input.category === 'Fixed Salary') {
    if (!input.monthlySalary.trim()) {
      errors.monthlySalary = 'Monthly salary is required';
    } else if (isNaN(Number(input.monthlySalary)) || Number(input.monthlySalary) <= 0) {
      errors.monthlySalary = 'Please enter a valid salary amount';
    } else if (input.monthlySalary.replace('.', '').length > 6) {
      errors.monthlySalary = 'Maximum 6 digits allowed';
    }
  }

  if (input.category === 'Loadmen') {
    if (!input.ratePerLoad.trim()) {
      errors.ratePerLoad = 'Rate per load is required';
    } else if (isNaN(Number(input.ratePerLoad)) || Number(input.ratePerLoad) <= 0) {
      errors.ratePerLoad = 'Please enter a valid rate';
    }
  }

  return errors;
}