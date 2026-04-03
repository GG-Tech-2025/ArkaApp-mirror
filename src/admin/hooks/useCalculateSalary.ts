import { useState, useEffect } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import {
  getSalaryEmployees,
  generateSalaryRPC,
  checkSalaryAlreadyGenerated,
} from '../../services/middleware.service';
import type { SalaryEmployee } from '../../services/types';

/**
 * Returns the first day of the current month as YYYY-MM-DD.
 * e.g. if today is 2026-04-03, returns "2026-04-01"
 * The RPC internally subtracts 1 month to get last month's attendance.
 */
function getCurrentMonthFirstDay(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Returns the first day of last month as YYYY-MM-DD.
 * e.g. if today is 2026-04-03, returns "2026-03-01"
 * Used for salary_batches lookup and generation (stores actual salary month).
 */
function getLastMonthFirstDay(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-based
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function getLastMonthLabel(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function useCalculateSalary() {
  const { goBack } = useAdminNavigation();

  const currentMonthDate = getCurrentMonthFirstDay();
  const salaryMonth = getLastMonthFirstDay();
  const lastMonthLabel = getLastMonthLabel();

  const [employees, setEmployees] = useState<SalaryEmployee[]>([]);
  const [finalSalaries, setFinalSalaries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadyGenerated, setAlreadyGenerated] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check if already generated, then fetch employees
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        // 1. Check if salary batch already exists for last month
        const exists = await checkSalaryAlreadyGenerated(salaryMonth);
        if (exists) {
          setAlreadyGenerated(true);
          return;
        }

        // 2. Fetch fixed salary employees with attendance data
        const data = await getSalaryEmployees(currentMonthDate);

        if (!data || data.length === 0) {
          setEmployees([]);
        } else {
          setEmployees(data);
          // Pre-fill final salary = base_salary for each employee
          const salaries: Record<string, number> = {};
          data.forEach((emp) => {
            salaries[emp.employee_id] = emp.base_salary;
          });
          setFinalSalaries(salaries);
        }
      } catch (err: any) {
        setErrorMessage('Failed to load employees. Please try again.');
        console.error('Failed to fetch salary employees:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentMonthDate, salaryMonth]);

  const updateFinalSalary = (employeeId: string, value: number | null) => {
    setFinalSalaries((prev) => ({
      ...prev,
      [employeeId]: value ?? 0,
    }));
  };

  const handleGenerate = async () => {
    if (employees.length === 0) return;

    try {
      setGenerating(true);
      setErrorMessage(null);

      const items = employees.map((emp) => ({
        employee_id: emp.employee_id,
        present_days: emp.present_days,
        absent_days: emp.absent_days,
        leave_days: emp.leave_days,
        half_days: emp.half_days,
        base_salary: emp.base_salary,
        final_salary: finalSalaries[emp.employee_id] ?? emp.base_salary,
      }));

      await generateSalaryRPC(salaryMonth, items);
      setShowSuccess(true);
      setAlreadyGenerated(true);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes('Salary already generated')) {
        setAlreadyGenerated(true);
        setErrorMessage('Salary has already been generated for this month.');
      } else {
        setErrorMessage('Failed to generate salary. Please try again.');
        console.error('Failed to generate salary:', err);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
  };

  return {
    employees,
    finalSalaries,
    loading,
    generating,
    errorMessage,
    alreadyGenerated,
    showSuccess,
    lastMonthLabel,
    updateFinalSalary,
    handleGenerate,
    handleSuccessClose,
    goBack,
  };
}
