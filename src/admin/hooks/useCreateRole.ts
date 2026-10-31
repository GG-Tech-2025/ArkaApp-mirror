import { useState } from 'react';
import { useAdminNavigation } from './useAdminNavigation';
import { createRole } from '../../services/middleware.service';
import { validateCreateRole, type CreateRoleFormInput, type RoleCategoryLabel } from '../validators/createRole.validator';
import type { EmployeeCategory } from '../../services/types';

const CATEGORY_TO_DB: Record<Exclude<RoleCategoryLabel, ''>, EmployeeCategory> = {
  'Daily Wages': 'DAILY',
  'Fixed Salary': 'FIXED',
  Loadmen: 'LOADMEN',
};

export function useCreateRole() {
  const { goBack } = useAdminNavigation();

  const [createRoleInput, setCreateRoleInput] = useState<CreateRoleFormInput>({
    roleName: '',
    category: '',
    perDayWage: '',
    monthlySalary: '',
    ratePerLoad: '',
    minimumLoadRequirement: '',
    no_loading_salary: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [loading, setLoading] = useState(false);

  function updateCreateRoleInput(field: keyof CreateRoleFormInput, value: string | boolean | RoleCategoryLabel) {
    setCreateRoleInput(prev => ({ ...prev, [field]: value }));
  }

  function handleCategoryChange(category: RoleCategoryLabel) {
    setCreateRoleInput(prev => ({
      ...prev,
      category,
      perDayWage: '',
      monthlySalary: '',
      ratePerLoad: '',
      minimumLoadRequirement: '',
    }));

    setErrors(prev => {
      const next = { ...prev };
      delete next.perDayWage;
      delete next.monthlySalary;
      delete next.ratePerLoad;
      delete next.form;
      return next;
    });
  }

  const validateForm = () => {
    const newErrors = validateCreateRole(createRoleInput);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getSalaryValue = () => {
    if (createRoleInput.category === 'Daily Wages') return Number(createRoleInput.perDayWage);
    if (createRoleInput.category === 'Fixed Salary') return Number(createRoleInput.monthlySalary);
    if (createRoleInput.category === 'Loadmen') return Number(createRoleInput.ratePerLoad);
    return 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    if (!createRoleInput.category) return;

    try {
      setLoading(true);
      await createRole({
        name: createRoleInput.roleName.trim(),
        category: CATEGORY_TO_DB[createRoleInput.category],
        salary_value: getSalaryValue(),
        minimum_requirement:
          createRoleInput.category === 'Loadmen' && createRoleInput.minimumLoadRequirement.trim()
            ? Number(createRoleInput.minimumLoadRequirement)
            : null,
        no_loading_salary: createRoleInput.no_loading_salary,
        active: true,
      });
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Failed to create role:', err);
      setErrors(prev => ({
        ...prev,
        form: (err as Error).message || 'Failed to create role',
      }));
      setShowFailurePopup(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
    goBack('/admin/employees/role-setup');
  };

  const handleFailureClose = () => {
    setShowFailurePopup(false);
  };

  return {
    createRoleInput,
    updateCreateRoleInput,
    handleCategoryChange,
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