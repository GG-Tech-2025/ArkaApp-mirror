import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAdminNavigation } from './useAdminNavigation';
import { validateEditEmployee } from '../validators/editEmployee.validator';
import { getRoles, getEmployeeById, updateEmployee } from '../../services/middleware.service';
import type { UpdateEmployeeInput, RoleWithCategory } from '../../services/types';
import { CATEGORY_LABELS } from './useCreateEmployee';

export function useEditEmployee() {
  const { goBack } = useAdminNavigation();
  const { id: employeeId } = useParams<{ id: string }>();

  const [editEmployeeInput, setEditEmployeeInput] = useState<UpdateEmployeeInput>({
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
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Fetch roles
      try {
        setRolesLoading(true);
        const rolesData = await getRoles();
        if (mounted) setRoles(rolesData);
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

      // Fetch employee details
      if (!employeeId) return;
      try {
        setEmployeeLoading(true);
        const employee = await getEmployeeById(employeeId);
        if (mounted) {
          setEditEmployeeInput({
            name: employee.name,
            phone: employee.phone,
            alternate_phone: employee.alternate_phone,
            blood_group: employee.blood_group,
            aadhar_number: employee.aadhar,
            permanent_address: employee.permanent_address,
            local_address: employee.local_address,
            role_id: employee.role_id,
            emergency_contact_name: employee.emergency_contact_name,
            emergency_contact_phone: employee.emergency_contact_phone,
            deduction_amount: employee.deduction_amount,
          });
        }
      } catch (err) {
        console.error('Failed to load employee details:', err);
        if (mounted) {
          setErrors(prev => ({
            ...prev,
            form: 'Failed to load employee details. Please refresh and try again.',
          }));
          setShowFailurePopup(true);
        }
      } finally {
        if (mounted) setEmployeeLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [employeeId]);

  function updateEditEmployeeInput(field: keyof UpdateEmployeeInput, value: any) {
    setEditEmployeeInput(prev => ({ ...prev, [field]: value }));
  }

  const selectedRole = roles.find(r => r.id === editEmployeeInput.role_id);

  const validateForm = () => {
    const newErrors = validateEditEmployee(editEmployeeInput, selectedRole);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;
    if (!employeeId) return;

    try {
      setLoading(true);
      await updateEmployee(employeeId, {
        ...editEmployeeInput,
        alternate_phone: editEmployeeInput.alternate_phone?.trim() || null,
        local_address: editEmployeeInput.local_address?.trim() || null,
        emergency_contact_name: editEmployeeInput.emergency_contact_name?.trim() || null,
        emergency_contact_phone: editEmployeeInput.emergency_contact_phone?.trim() || null,
      });
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Failed to update employee:', err);
      setErrors(prev => ({
        ...prev,
        form: (err as Error).message || 'Failed to update employee',
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
    editEmployeeInput,
    updateEditEmployeeInput,
    selectedRole,
    roles,
    rolesLoading,
    employeeLoading,
    employeeId,
    errors,
    showSuccessPopup,
    showFailurePopup,
    loading,
    handleUpdate,
    handleSuccessClose,
    handleFailureClose,
    goBack,
  };
}

export { CATEGORY_LABELS };
