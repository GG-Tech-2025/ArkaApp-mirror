import { useState, useEffect, useCallback } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import {
  getEmployeesForAttendance,
  getAttendanceForDate,
  saveAttendance,
  createSalaryLedgerEntry,
} from '../../services/middleware.service';
import type {
  EmployeeForAttendance,
  AttendanceStatus,
  AttendanceEntry,
  AttendanceRecord,
} from '../../services/types';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

type DbStatus = AttendanceRecord['status'];

const DB_TO_DISPLAY: Record<DbStatus, AttendanceStatus> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  LEAVE: 'Leave',
};

const DISPLAY_TO_DB: Record<AttendanceStatus, DbStatus> = {
  Present: 'PRESENT',
  Absent: 'ABSENT',
  'Half Day': 'HALF_DAY',
  Leave: 'LEAVE',
};

export type AttendanceTab = 'Active' | 'Inactive';

/**
 * Calculate salary amount based on attendance status and role's salary_value.
 * Present → full salary, Half Day → half, Absent/Leave → 0
 */
function getSalaryAmount(status: AttendanceStatus, salaryValue: number): number {
  switch (status) {
    case 'Present':
      return salaryValue;
    case 'Half Day':
      return Math.round(salaryValue / 2);
    case 'Absent':
    case 'Leave':
    default:
      return 0;
  }
}

export function useAttendance() {
  const { goBack } = useAdminNavigation();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [activeTab, setActiveTab] = useState<AttendanceTab>('Active');

  // Separate employee lists for each tab
  const [activeEmployees, setActiveEmployees] = useState<EmployeeForAttendance[]>([]);
  const [inactiveEmployees, setInactiveEmployees] = useState<EmployeeForAttendance[]>([]);
  const [activeEntries, setActiveEntries] = useState<AttendanceEntry[]>([]);
  const [inactiveEntries, setInactiveEntries] = useState<AttendanceEntry[]>([]);

  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasValidationError, setHasValidationError] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showBulkConfirmation, setShowBulkConfirmation] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<'Present' | 'Leave'>('Present');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track which tabs have had their employees fetched
  const [activeEmployeesFetched, setActiveEmployeesFetched] = useState(false);
  const [inactiveEmployeesFetched, setInactiveEmployeesFetched] = useState(false);

  // Whether attendance has already been saved for the selected date
  const [isAlreadySaved, setIsAlreadySaved] = useState(false);

  // Determine if selected date is in the past (before today)
  const isPastDate = selectedDate < getTodayString();

  // Current entries based on active tab
  const entries = activeTab === 'Active' ? activeEntries : inactiveEntries;

  // Editable only if active tab AND not a past date AND not already saved
  const isEditable = activeTab === 'Active'  && !isAlreadySaved;

  // Fetch employees for a tab
  const fetchEmployeesForTab = useCallback(async (tab: AttendanceTab) => {
    const isActive = tab === 'Active';
    try {
      setLoadingEmployees(true);
      const data = await getEmployeesForAttendance(isActive);
      if (isActive) {
        setActiveEmployees(data);
        setActiveEmployeesFetched(true);
      } else {
        setInactiveEmployees(data);
        setInactiveEmployeesFetched(true);
      }
      return data;
    } catch (err) {
      console.error('Failed to fetch employees for attendance:', err);
      setErrorMessage('Failed to load employees. Please try again.');
      return [];
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  // Fetch attendance and build entries for a given employee list
  const fetchAttendanceForEmployees = useCallback(
    async (date: string, employeeList: EmployeeForAttendance[], tab: AttendanceTab) => {
      if (employeeList.length === 0) {
        if (tab === 'Active') setActiveEntries([]);
        else setInactiveEntries([]);
        setIsAlreadySaved(false);
        return;
      }
      try {
        setLoadingAttendance(true);
        const records = await getAttendanceForDate(date);

        const statusMap = new Map<string, AttendanceStatus>();
        records.forEach((r) => {
          statusMap.set(r.employee_id, DB_TO_DISPLAY[r.status]);
        });

        const newEntries: AttendanceEntry[] = employeeList.map((emp) => ({
          employee: emp,
          status: (statusMap.get(emp.id) ?? '') as AttendanceEntry['status'],
        }));

        if (tab === 'Active') {
          setActiveEntries(newEntries);
          // If any active employee already has a saved attendance record, mark as already saved
          const hasExistingRecords = employeeList.some((emp) => statusMap.has(emp.id));
          setIsAlreadySaved(hasExistingRecords);
        } else {
          setInactiveEntries(newEntries);
        }

        setHasValidationError(false);
      } catch (err) {
        console.error('Failed to fetch attendance:', err);
        setErrorMessage('Failed to load attendance. Please try again.');
      } finally {
        setLoadingAttendance(false);
      }
    },
    []
  );

  // Initial load: fetch active employees + attendance
  useEffect(() => {
    (async () => {
      const data = await fetchEmployeesForTab('Active');
      if (data.length > 0) {
        await fetchAttendanceForEmployees(selectedDate, data, 'Active');
      }
    })();
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When date changes, re-fetch attendance for the current tab's employees
  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setHasValidationError(false);
    setErrorMessage(null);

    const employeeList = activeTab === 'Active' ? activeEmployees : inactiveEmployees;
    const fetched = activeTab === 'Active' ? activeEmployeesFetched : inactiveEmployeesFetched;

    if (fetched && employeeList.length > 0) {
      await fetchAttendanceForEmployees(date, employeeList, activeTab);
    }
  };

  // When tab changes, fetch employees if needed, then fetch attendance
  const handleTabChange = async (tab: AttendanceTab) => {
    setActiveTab(tab);
    setHasValidationError(false);
    setErrorMessage(null);

    const isActive = tab === 'Active';
    const alreadyFetched = isActive ? activeEmployeesFetched : inactiveEmployeesFetched;
    let employeeList = isActive ? activeEmployees : inactiveEmployees;

    if (!alreadyFetched) {
      employeeList = await fetchEmployeesForTab(tab);
    }

    if (employeeList.length > 0) {
      await fetchAttendanceForEmployees(selectedDate, employeeList, tab);
    }
  };

  const handleAttendanceChange = (
    employeeId: string,
    status: AttendanceStatus
  ) => {
    if (!isEditable) return;
    setActiveEntries((prev) =>
      prev.map((e) =>
        e.employee.id === employeeId ? { ...e, status } : e
      )
    );
    setHasValidationError(false);
  };

  const handleMarkAllClick = (type: 'Present' | 'Leave') => {
    if (!isEditable) return;
    setPendingBulkAction(type);
    setShowBulkConfirmation(true);
  };

  const handleBulkConfirm = () => {
    setActiveEntries((prev) => prev.map((e) => ({ ...e, status: pendingBulkAction })));
    setShowBulkConfirmation(false);
    setHasValidationError(false);
  };

  const handleBulkCancel = () => {
    setShowBulkConfirmation(false);
  };

  const handleSave = async () => {
    if (!isEditable) return;

    // Validate: every employee must have an attendance status
    const missing = activeEntries.some((e) => !e.status);
    if (missing) {
      setHasValidationError(true);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      // 1. Save attendance records
      const payload = activeEntries.map((e) => ({
        employee_id: e.employee.id,
        date: selectedDate,
        status: DISPLAY_TO_DB[e.status as AttendanceStatus],
      }));
      await saveAttendance(payload);

      // 2. Auto-increment salary ledger for active employees (skip FIXED — they only get deductions)
      const salaryPromises = activeEntries
        .filter((e) => {
          if (e.employee.roles.category === 'FIXED') return false;
          const amount = getSalaryAmount(e.status as AttendanceStatus, e.employee.roles.salary_value);
          return amount > 0;
        })
        .map((e) => {
          const amount = getSalaryAmount(e.status as AttendanceStatus, e.employee.roles.salary_value);
          return createSalaryLedgerEntry({
            employee_id: e.employee.id,
            entry_type: 'SALARY_AUTO_ENTRY',
            amount,
            notes: `Auto-entry for ${selectedDate} — ${e.status}`,
            payment_at: new Date(selectedDate + 'T00:00:00').toISOString(),
          });
        });

      await Promise.all(salaryPromises);

      // 3. Create deduction entries for FIXED salary employees marked Absent or Half Day
      const deductionPromises = activeEntries
        .filter((e) => {
          const status = e.status as AttendanceStatus;
          return (
            e.employee.roles.category === 'FIXED' &&
            e.employee.deduction_amount != null &&
            e.employee.deduction_amount > 0 &&
            (status === 'Absent' || status === 'Half Day')
          );
        })
        .map((e) => {
          const status = e.status as AttendanceStatus;
          const deductionAmt = status === 'Half Day'
            ? Math.round(e.employee.deduction_amount! / 2)
            : e.employee.deduction_amount!;
          return createSalaryLedgerEntry({
            employee_id: e.employee.id,
            entry_type: 'DEDUCTION',
            amount: deductionAmt,
            notes: `Deduction for ${selectedDate} — ${status}`,
            payment_at: new Date(selectedDate + 'T00:00:00').toISOString(),
          });
        });

      await Promise.all(deductionPromises);

      // Mark as already saved so it becomes read-only
      setIsAlreadySaved(true);
      setShowSaveSuccess(true);
    } catch (err) {
      console.error('Failed to save attendance:', err);
      setErrorMessage('Failed to save attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSaveSuccess(false);
  };

  const loading = loadingEmployees || loadingAttendance;

  return {
    selectedDate,
    activeTab,
    entries,
    loading,
    saving,
    hasValidationError,
    showSaveSuccess,
    showBulkConfirmation,
    pendingBulkAction,
    errorMessage,
    isPastDate,
    isEditable,
    isAlreadySaved,
    handleDateChange,
    handleTabChange,
    handleAttendanceChange,
    handleMarkAllClick,
    handleBulkConfirm,
    handleBulkCancel,
    handleSave,
    handleSuccessClose,
    goBack,
  };
}
