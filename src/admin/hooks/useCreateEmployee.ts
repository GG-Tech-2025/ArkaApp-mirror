import { useState, useEffect } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import { validateCreateEmployee } from '../validators/createEmployee.validator';
import { getRoles, createEmployee } from '../../services/middleware.service';
import type { CreateEmployeeInput, RoleWithCategory } from '../../services/types';

export const CATEGORY_LABELS: Record<string, string> = {
  DAILY: 'Daily Wages',
  FIXED: 'Fixed Salary',
  LOADMEN: 'Loadmen',
};

export function useCreateEmployee() {
  const { goBack } = useAdminNavigation();

  const [createEmployeeInput, setCreateEmployeeInput] = useState<CreateEmployeeInput>({
    name: '',
    phone: '',
    alternate_phone: null,
    blood_group: '',
    aadhar_number: '',
    permanent_address: '',
    local_address: null,
    role_id: '',
    emergency_contact_name: null,
    emergency_contact_phone: null,
    deduction_amount: null,
  });

  const [roles, setRoles] = useState<RoleWithCategory[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setRolesLoading(true);
        const data = await getRoles();
        if (mounted) setRoles(data);
      } catch (err) {
        console.error('Failed to load roles:', err);
        if (mounted) {
          setErrors(prev => ({
            ...prev,
            form: 'Failed to load roles. Please refresh and try again.',
          }));
          setShowFailurePopup(true);
        }
      } finally {
        if (mounted) setRolesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  function updateCreateEmployeeInput(field: keyof CreateEmployeeInput, value: any) {
    setCreateEmployeeInput(prev => ({ ...prev, [field]: value }));
  }

  const selectedRole = roles.find(r => r.id === createEmployeeInput.role_id);

  const validateForm = () => {
    const newErrors = validateCreateEmployee(createEmployeeInput, selectedRole);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      await createEmployee({
        ...createEmployeeInput,
        alternate_phone: createEmployeeInput.alternate_phone?.trim() || null,
        local_address: createEmployeeInput.local_address?.trim() || null,
        emergency_contact_name: createEmployeeInput.emergency_contact_name?.trim() || null,
        emergency_contact_phone: createEmployeeInput.emergency_contact_phone?.trim() || null,
      });
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Failed to create employee:', err);
      setErrors(prev => ({
        ...prev,
        form: (err as Error).message || 'Failed to create employee',
      }));
      setShowFailurePopup(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
    goBack('/admin/employees');
  };

  const handleFailureClose = () => {
    setShowFailurePopup(false);
  };

  return {
    createEmployeeInput,
    updateCreateEmployeeInput,
    selectedRole,
    roles,
    rolesLoading,
    errors,
    showSuccessPopup,
    showFailurePopup,
    loading,
    handleCreate,
    handleSuccessClose,
    handleFailureClose,
    goBack,
  };
}
