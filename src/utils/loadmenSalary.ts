/**
 * Loading/Unloading Salary Calculation Utility
 * 
 * Calculates equal pay for all employees (Loadmen + Others) involved in delivery work
 * 
 * @module loadmenSalary
 */

export type LoadingType = 'LOADING_ONLY' | 'LOADING_UNLOADING' | 'CUSTOMER_SELF';

export interface LoadmenSalaryCalculation {
  employeeId: string;
  amount: number;
  isLoadmenCategory: boolean;
}

/**
 * Calculate salary for loading/unloading work
 * Equal division among ALL selected employees
 * 
 * @param perBrickRate - Global rate per brick from settings (₹)
 * @param brickQuantity - Number of bricks delivered
 * @param loadingType - LOADING_ONLY (50%) | LOADING_UNLOADING (100%) | CUSTOMER_SELF (0%)
 * @param selectedEmployees - Array of {employeeId, isLoadmenCategory}
 * @returns Salary amount for each employee
 * 
 * @example
 * // 5000 bricks, ₹0.50/brick, Loading & Unloading, 3 employees
 * calculateLoadingSalary(0.50, 5000, 'LOADING_UNLOADING', [
 *   { employeeId: '123', isLoadmenCategory: true },
 *   { employeeId: '456', isLoadmenCategory: true },
 *   { employeeId: '789', isLoadmenCategory: false }
 * ])
 * // Returns: [
 * //   { employeeId: '123', amount: 833.33, isLoadmenCategory: true },
 * //   { employeeId: '456', amount: 833.33, isLoadmenCategory: true },
 * //   { employeeId: '789', amount: 833.33, isLoadmenCategory: false }
 * // ]
 * // Total: ₹2,500 (₹0.50 × 5000) ÷ 3 = ₹833.33 each
 */
export function calculateLoadingSalary(
  perBrickRate: number = 0,
  brickQuantity: number,
  loadingType: LoadingType,
  selectedEmployees: Array<{ employeeId: string; isLoadmenCategory: boolean }>
): LoadmenSalaryCalculation[] {
  
  // No calculation for customer self-loading
  if (loadingType === 'CUSTOMER_SELF') {
    return [];
  }

  // Validate inputs
  if (!selectedEmployees || selectedEmployees.length === 0) {
    return [];
  }

  if (perBrickRate <= 0 || brickQuantity <= 0) {
    console.warn('Invalid calculation inputs:', { perBrickRate, brickQuantity });
    return [];
  }

  // Calculate multiplier based on loading type
  let multiplier = 1.0; // Default: Full rate (100%)
  if (loadingType === 'LOADING_ONLY') {
    multiplier = 0.5; // Half rate (50%) for loading only
  }

  // Total amount for this delivery
  const totalAmount = perBrickRate * brickQuantity * multiplier;

  // Divide EQUALLY among ALL selected employees (Loadmen + Others)
  const amountPerPerson = totalAmount / selectedEmployees.length;

  // Round to 2 decimal places to avoid floating point issues
  const roundedAmount = Math.round(amountPerPerson * 100) / 100;

  // Return salary for ALL selected employees
  return selectedEmployees.map(emp => ({
    employeeId: emp.employeeId,
    amount: roundedAmount,
    isLoadmenCategory: emp.isLoadmenCategory
  }));
}

/**
 * Format salary calculation breakdown for display/logging
 * 
 * @example
 * formatLoadingSalaryBreakdown(0.50, 5000, 'LOADING_UNLOADING', 3)
 * // "₹0.50/brick × 5000 bricks × 100% ÷ 3 employees = ₹833.33 per person"
 */
export function formatLoadingSalaryBreakdown(
  perBrickRate: number,
  brickQuantity: number,
  loadingType: LoadingType,
  employeeCount: number
): string {
  const multiplier = loadingType === 'LOADING_ONLY' ? 0.5 : 1.0;
  const percentage = multiplier === 0.5 ? '50%' : '100%';
  const total = perBrickRate * brickQuantity * multiplier;
  const perPerson = total / employeeCount;

  return `₹${perBrickRate}/brick × ${brickQuantity} bricks × ${percentage} ÷ ${employeeCount} employee${employeeCount > 1 ? 's' : ''} = ₹${perPerson.toFixed(2)} per person`;
}
