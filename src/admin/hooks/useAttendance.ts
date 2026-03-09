import { useState, useEffect, useCallback } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import {
  getEmployeesForAttendance,
  getAttendanceForDate,
  saveAttendance,
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

export function useAttendance() {
  const { goBack } = useAdminNavigation();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasValidationError, setHasValidationError] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showBulkConfirmation, setShowBulkConfirmation] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<'Present' | 'Leave'>('Present');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch all non-loadmen active employees once on mount
  const [employees, setEmployees] = useState<EmployeeForAttendance[]>([]);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      const data = await getEmployeesForAttendance();
      setEmployees(data);
    } catch (err) {
      console.error('Failed to fetch employees for attendance:', err);
      setErrorMessage('Failed to load employees. Please try again.');
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // When employees or selected date changes, build entry list with existing attendance
  const fetchAttendance = useCallback(
    async (date: string, currentEmployees: EmployeeForAttendance[]) => {
      if (currentEmployees.length === 0) return;
      try {
        setLoadingAttendance(true);
        const records = await getAttendanceForDate(date);

        // Build a map of employee_id → status for quick lookup
        const statusMap = new Map<string, AttendanceStatus>();
        records.forEach((r) => {
          statusMap.set(r.employee_id, DB_TO_DISPLAY[r.status]);
        });

        setEntries(
          currentEmployees.map((emp) => ({
            employee: emp,
            status: statusMap.get(emp.id) ?? '',
          }))
        );
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

  useEffect(() => {
    if (employees.length > 0) {
      fetchAttendance(selectedDate, employees);
    }
  }, [selectedDate, employees, fetchAttendance]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setHasValidationError(false);
    setErrorMessage(null);
  };

  const handleAttendanceChange = (
    employeeId: string,
    status: AttendanceStatus
  ) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.employee.id === employeeId ? { ...e, status } : e
      )
    );
    setHasValidationError(false);
  };

  const handleMarkAllClick = (type: 'Present' | 'Leave') => {
    setPendingBulkAction(type);
    setShowBulkConfirmation(true);
  };

  const handleBulkConfirm = () => {
    setEntries((prev) => prev.map((e) => ({ ...e, status: pendingBulkAction })));
    setShowBulkConfirmation(false);
    setHasValidationError(false);
  };

  const handleBulkCancel = () => {
    setShowBulkConfirmation(false);
  };

  const handleSave = async () => {
    // Validate: every employee must have an attendance status
    const missing = entries.some((e) => !e.status);
    if (missing) {
      setHasValidationError(true);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      const payload = entries.map((e) => ({
        employee_id: e.employee.id,
        date: selectedDate,
        status: DISPLAY_TO_DB[e.status as AttendanceStatus],
      }));
      await saveAttendance(payload);
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
    entries,
    loading,
    saving,
    hasValidationError,
    showSaveSuccess,
    showBulkConfirmation,
    pendingBulkAction,
    errorMessage,
    handleDateChange,
    handleAttendanceChange,
    handleMarkAllClick,
    handleBulkConfirm,
    handleBulkCancel,
    handleSave,
    handleSuccessClose,
    goBack,
  };
}
