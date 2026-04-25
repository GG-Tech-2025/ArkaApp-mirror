import { useState, useEffect, useCallback } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import {
  getEmployeesForAttendance,
  getAttendanceForMonth,
  getAppStartDate,
} from '../../services/middleware.service';
import type { EmployeeForAttendance, AttendanceRecord } from '../../services/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DisplayStatus = 'Present' | 'Absent' | 'Half Day' | 'Leave';

const DB_TO_DISPLAY: Record<AttendanceRecord['status'], DisplayStatus> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  LEAVE: 'Leave',
};

export interface EmployeeAttendanceRow {
  employee: EmployeeForAttendance;
  isInactive: boolean;
  /** date string (YYYY-MM-DD) → display status, only for dates with records */
  statusMap: Record<string, DisplayStatus>;
  /** Last date this employee has a record — used to grey out after for inactive */
  lastRecordDate: string | null;
  totals: {
    present: number;
    absent: number;
    halfDay: number;
    leave: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function buildDateArray(year: number, month: number, appStartDate: string): string[] {
  const today = getTodayString();
  const lastDay = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dateStr > today) break;      // stop at today for current month
    if (dateStr < appStartDate) continue; // skip dates before app went live
    dates.push(dateStr);
  }
  return dates;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAttendanceView() {
  const { goBack } = useAdminNavigation();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const [rows, setRows] = useState<EmployeeAttendanceRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  /** Set of date strings where NO employee has any record (missed column) */
  const [missedDates, setMissedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [monthOptions, setMonthOptions] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12]);
  /** Full app start date string (YYYY-MM-DD) — loaded once from settings */
  const [appStartDate, setAppStartDate] = useState<string>('');

  // Load app start date once on mount, then build year + initial month options
  useEffect(() => {
    getAppStartDate().then((startDate) => {
      setAppStartDate(startDate);
      const startYear = new Date(startDate).getFullYear();
      const startMonth = new Date(startDate).getMonth() + 1; // 1-based

      // Year options: start year → 2070
      const years: number[] = [];
      for (let y = startYear; y <= 2070; y++) years.push(y);
      setYearOptions(years);

      // If the currently selected year is the start year, restrict months
      if (now.getFullYear() === startYear) {
        const months: number[] = [];
        for (let m = startMonth; m <= 12; m++) months.push(m);
        setMonthOptions(months);
        // Clamp selected month if needed
        setSelectedMonth((prev) => (prev < startMonth ? startMonth : prev));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async (year: number, month: number, startDate: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Build date array for the month (capped at today, floored at app start date)
      const dateArray = buildDateArray(year, month, startDate);
      setDates(dateArray);

      // 2. Fetch all active employees and attendance records in parallel
      const [activeEmployees, records] = await Promise.all([
        getEmployeesForAttendance(true),
        getAttendanceForMonth(year, month),
      ]);

      // 3. Build a map: employeeId → { date → status }
      const recordMap: Record<string, Record<string, DisplayStatus>> = {};
      for (const rec of records) {
        if (!recordMap[rec.employee_id]) recordMap[rec.employee_id] = {};
        recordMap[rec.employee_id][rec.date] = DB_TO_DISPLAY[rec.status];
      }

      // 4. Find inactive employee IDs that have records this month
      const activeIds = new Set(activeEmployees.map((e) => e.id));
      const inactiveIdsWithRecords = new Set<string>();
      for (const rec of records) {
        if (!activeIds.has(rec.employee_id)) {
          inactiveIdsWithRecords.add(rec.employee_id);
        }
      }

      // 5. Fetch inactive employees who have records (if any)
      let inactiveEmployees: EmployeeForAttendance[] = [];
      if (inactiveIdsWithRecords.size > 0) {
        const allInactive = await getEmployeesForAttendance(false);
        inactiveEmployees = allInactive.filter((e) => inactiveIdsWithRecords.has(e.id));
      }

      // 6. Build rows for all employees
      const allEmployees: Array<{ emp: EmployeeForAttendance; isInactive: boolean }> = [
        ...activeEmployees.map((e) => ({ emp: e, isInactive: false })),
        ...inactiveEmployees.map((e) => ({ emp: e, isInactive: true })),
      ];

      const builtRows: EmployeeAttendanceRow[] = allEmployees.map(({ emp, isInactive }) => {
        const statusMap = recordMap[emp.id] ?? {};
        const recordDates = Object.keys(statusMap);
        const lastRecordDate = recordDates.length > 0
          ? recordDates.sort().at(-1)!
          : null;

        const totals = { present: 0, absent: 0, halfDay: 0, leave: 0 };
        for (const status of Object.values(statusMap)) {
          if (status === 'Present') totals.present++;
          else if (status === 'Absent') totals.absent++;
          else if (status === 'Half Day') totals.halfDay++;
          else if (status === 'Leave') totals.leave++;
        }

        return { employee: emp, isInactive, statusMap, lastRecordDate, totals };
      });

      setRows(builtRows);

      // 7. Detect "missed columns" — past dates where zero employees have records
      const today = getTodayString();
      const missed = new Set<string>();
      for (const date of dateArray) {
        if (date >= today) continue; // skip today and future
        const anyRecord = records.some((r) => r.date === date);
        if (!anyRecord) missed.add(date);
      }
      setMissedDates(missed);
    } catch (err) {
      console.error('Failed to fetch attendance view data:', err);
      setErrorMessage('Failed to load attendance data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appStartDate) {
      fetchData(selectedYear, selectedMonth, appStartDate);
    }
  }, [selectedYear, selectedMonth, appStartDate, fetchData]);

  // Update available months when year changes
  useEffect(() => {
    if (!appStartDate) return;
    const startYear = new Date(appStartDate).getFullYear();
    const startMonth = new Date(appStartDate).getMonth() + 1;
    if (selectedYear === startYear) {
      const months: number[] = [];
      for (let m = startMonth; m <= 12; m++) months.push(m);
      setMonthOptions(months);
      setSelectedMonth((prev) => (prev < startMonth ? startMonth : prev));
    } else {
      setMonthOptions([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  }, [selectedYear, appStartDate]);

  const handleMonthChange = (month: number) => setSelectedMonth(month);
  const handleYearChange = (year: number) => setSelectedYear(year);

  return {
    selectedMonth,
    selectedYear,
    rows,
    dates,
    missedDates,
    loading,
    errorMessage,
    yearOptions,
    monthOptions,
    handleMonthChange,
    handleYearChange,
    goBack,
  };
}
