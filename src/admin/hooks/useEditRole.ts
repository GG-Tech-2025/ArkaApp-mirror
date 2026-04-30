import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAdminNavigation } from './useAdminNavigation';
import { getRoleById, updateRole } from '../../services/middleware.service';
import { validateEditRole, type EditRoleFormInput } from '../validators/editRole.validator';
import type { EmployeeCategory } from '../../services/types';
import type { RoleCategoryLabel } from '../validators/createRole.validator';

const DB_TO_CATEGORY: Record<EmployeeCategory, Exclude<RoleCategoryLabel, ''>> = {
  DAILY: 'Daily Wages',
  FIXED: 'Fixed Salary',
  LOADMEN: 'Loadmen',
};

const CATEGORY_TO_DB: Record<Exclude<RoleCategoryLabel, ''>, EmployeeCategory> = {
  'Daily Wages': 'DAILY',
  'Fixed Salary': 'FIXED',
  Loadmen: 'LOADMEN',
};

export function useEditRole() {
  const { goBack } = useAdminNavigation();
  const { id: roleId } = useParams<{ id: string }>();

  const [editRoleInput, setEditRoleInput] = useState<EditRoleFormInput>({
    roleName: '',
    category: '',
    perDayWage: '',
    monthlySalary: '',
    ratePerLoad: '',
    minimumLoadRequirement: '',
    no_loading_salary: false,
  });

  const [roleLoading, setRoleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showFailurePopup, setShowFailurePopup] = useState(false);
  const [loading, setLoading] = useState(false);

  // Category change confirmation
  const [showCategoryChangeConfirm, setShowCategoryChangeConfirm] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<RoleCategoryLabel>('');

  useEffect(() => {
    if (!roleId) return;

    let mounted = true;
    (async () => {
      try {
        setRoleLoading(true);
        const role = await getRoleById(roleId);
        if (mounted) {
          const categoryLabel = DB_TO_CATEGORY[role.category];
          setEditRoleInput({
            roleName: role.name,
            category: categoryLabel,
            perDayWage: role.category === 'DAILY' ? role.salary_value.toString() : '',
            monthlySalary: role.category === 'FIXED' ? role.salary_value.toString() : '',
            ratePerLoad: role.category === 'LOADMEN' ? role.salary_value.toString() : '',
            minimumLoadRequirement:
              role.minimum_requirement != null ? role.minimum_requirement.toString() : '',
            no_loading_salary: role.no_loading_salary ?? false,
          });
        }
      } catch (err) {
        console.error('Failed to load role:', err);
        if (mounted) {
          setErrors(prev => ({
            ...prev,
            form: 'Failed to load role details. Please refresh and try again.',
          }));
          setShowFailurePopup(true);
        }
      } finally {
        if (mounted) setRoleLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [roleId]);

  function updateEditRoleInput(field: keyof EditRoleFormInput, value: string | boolean) {
    setEditRoleInput(prev => ({ ...prev, [field]: value }));
  }

  function requestCategoryChange(category: RoleCategoryLabel) {
    if (category !== editRoleInput.category) {
      setPendingCategory(category);
      setShowCategoryChangeConfirm(true);
    }
  }

  function confirmCategoryChange() {
    setEditRoleInput(prev => ({
      ...prev,
      category: pendingCategory,
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
      return next;
    });
    setShowCategoryChangeConfirm(false);
    setPendingCategory('');
  }

  function cancelCategoryChange() {
    setShowCategoryChangeConfirm(false);
    setPendingCategory('');
  }

  const validateForm = () => {
    const newErrors = validateEditRole(editRoleInput);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getSalaryValue = () => {
    if (editRoleInput.category === 'Daily Wages') return Number(editRoleInput.perDayWage);
    if (editRoleInput.category === 'Fixed Salary') return Number(editRoleInput.monthlySalary);
    if (editRoleInput.category === 'Loadmen') return Number(editRoleInput.ratePerLoad);
    return 0;
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;
    if (!roleId || !editRoleInput.category) return;

    try {
      setLoading(true);
      await updateRole(roleId, {
        name: editRoleInput.roleName.trim(),
        category: CATEGORY_TO_DB[editRoleInput.category as Exclude<RoleCategoryLabel, ''>],
        salary_value: getSalaryValue(),
        minimum_requirement:
          editRoleInput.category === 'Loadmen' && editRoleInput.minimumLoadRequirement.trim()
            ? Number(editRoleInput.minimumLoadRequirement)
            : null,
        no_loading_salary: editRoleInput.no_loading_salary,
      });
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Failed to update role:', err);
      setErrors(prev => ({
        ...prev,
        form: (err as Error).message || 'Failed to update role',
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
    editRoleInput,
    updateEditRoleInput,
    requestCategoryChange,
    confirmCategoryChange,
    cancelCategoryChange,
    showCategoryChangeConfirm,
    roleLoading,
    roleId,
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
