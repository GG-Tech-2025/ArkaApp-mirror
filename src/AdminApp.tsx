import React, { useState } from 'react';
import { AdminRoutes } from './admin/routes';

export type AdminScreen = 
  | 'login' 
  | 'home' 
  | 'orders' 
  | 'create-order' 
  | 'order-details'
  | 'production'
  | 'inventory'
  | 'unapproved-procurements'
  | 'customers'
  | 'customer-details'
  | 'accounts'
  | 'create-expense'
  | 'create-expense-subtype'
  | 'edit-expense'
  | 'metrics'
  | 'employees'
  | 'create-employee'
  | 'edit-employee'
  | 'attendance'
  | 'role-setup'
  | 'create-role'
  | 'edit-role'
  | 'salary-ledger'
  | 'salary-ledger-detail'
  | 'add-payment'
  | 'vendors'
  | 'create-vendor'
  | 'edit-vendor'
  | 'vendor-ledger'
  | 'create-procurement-request'
  | 'procurement-request-detail'
  | 'vendor-payment'
  | 'cash-flow'
  | 'cash-ledger'
  | 'loan-management'
  | 'create-loan'
  | 'loan-ledger'
  | 'add-loan-transaction';

export interface AdminOrder {
  id: string;
  date: string;
  deliveryDate: string;
  customerName: string;
  customerNumber: string;
  customerId: string;
  quantity: number;
  pricePerBrick: number;
  paperPrice: number;
  location: string;
  finalPrice: number;
  paymentStatus: 'Not Paid' | 'Partially Paid' | 'Fully Paid';
  amountPaid?: number;
  loadMen?: string[];
  deliveryToday: boolean;
  isDelivered: boolean;
  deliveryChallanNumber?: string;
  gstNumber?: string;
}

export interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  address: string;
  unpaidAmount: number;
  totalSales: number;
  gstNumber?: string;
}

export interface Employee {
  id: string;
  name: string;
  phoneNumber: string;
  alternatePhone?: string;
  bloodGroup: string;
  aadharNumber: string;
  permanentAddress: string;
  localAddress?: string;
  role: string;
  category: 'Daily Wages' | 'Fixed Salary' | 'Loadmen';
  isActive: boolean;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
}

export interface Role {
  id: string;
  name: string;
  category: 'Daily Wages' | 'Fixed Salary' | 'Loadmen';
  salaryType: string;
  salaryValue: number;
  isActive: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  phoneNumber: string;
  alternatePhone?: string;
  materialsSupplied: string[];
  address: string;
  gstNumber?: string;
  notes?: string;
  isActive: boolean;
}

export interface Expense {
  id: string;
  date: string;
  type: string;
  subtype?: string;
  amount: number;
  comments: string;
  status?: 'Paid' | 'Pending';
  modeOfPayment: 'UPI' | 'Bank Transfer' | 'Cheque' | 'Cash';
  sai?: string;
  rai?: string;
}

interface AdminAppProps {
  onBack?: () => void;
}

export default function AdminApp({ onBack }: AdminAppProps) {
  const [currentScreen, setCurrentScreen] = useState<AdminScreen>('login');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Expense types and subtypes state
  const [expenseTypes, setExpenseTypes] = useState<string[]>([
    'Procurement',
    'Salary',
    'Equipment Service',
    'Fuel',
    'Others'
  ]);
  
  const [expenseSubtypes, setExpenseSubtypes] = useState<Record<string, string[]>>({
    'Procurement': ['Fly Ash', 'Crusher Powder', 'Sand', 'Cement'],
    'Salary': ['Production Workers', 'Admin Staff', 'Drivers'],
    'Equipment Service': ['Machine Maintenance', 'Repair', 'Parts Replacement'],
    'Fuel': ['Diesel', 'Petrol'],
    'Others': ['Office Supplies', 'Utilities', 'Miscellaneous']
  });

  const handleLogin = () => {
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    setCurrentScreen('login');
  };

  const handleNavigate = (screen: AdminScreen) => {
    setCurrentScreen(screen);
  };

  const handleOrderSelect = (order: AdminOrder) => {
    setSelectedOrder(order);
    setCurrentScreen('order-details');
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCurrentScreen('customer-details');
  };

  const handleEmployeeEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setCurrentScreen('edit-employee');
  };

  const handleRoleEdit = (role: Role) => {
    setSelectedRole(role);
    setCurrentScreen('edit-role');
  };

  const handleVendorEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setCurrentScreen('edit-vendor');
  };

  const handleExpenseEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setCurrentScreen('edit-expense');
  };

  const handleTypeCreated = (typeName: string) => {
    setExpenseTypes([...expenseTypes, typeName]);
    setExpenseSubtypes({ ...expenseSubtypes, [typeName]: [] });
  };

  const handleSubtypeCreated = (type: string, subtype: string) => {
    const currentSubtypes = expenseSubtypes[type] || [];
    setExpenseSubtypes({
      ...expenseSubtypes,
      [type]: [...currentSubtypes, subtype]
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminRoutes />
      {/* {currentScreen === 'login' && <AdminLoginScreen onLogin={handleLogin} onBack={onBack} />}
      {currentScreen === 'home' && <AdminHomeScreen onNavigate={handleNavigate} onLogout={handleLogout} />}
      {currentScreen === 'orders' && <OrderManagementScreen onNavigate={handleNavigate} onOrderSelect={handleOrderSelect} />}
      {currentScreen === 'create-order' && <CreateOrderScreen onNavigate={handleNavigate} />}
      {currentScreen === 'order-details' && selectedOrder && <OrderDetailsScreen order={selectedOrder} onNavigate={handleNavigate} />}
      {currentScreen === 'production' && <ProductionStatisticsScreen onNavigate={handleNavigate} />}
      {currentScreen === 'inventory' && <InventoryManagementScreen onNavigate={handleNavigate} />}
      {currentScreen === 'unapproved-procurements' && <UnapprovedProcurementsScreen onNavigate={handleNavigate} />}
      {currentScreen === 'customers' && <CustomerManagementScreen onNavigate={handleNavigate} onCustomerSelect={handleCustomerSelect} />}
      {currentScreen === 'customer-details' && selectedCustomer && <CustomerDetailsScreen customer={selectedCustomer} onNavigate={handleNavigate} onOrderSelect={handleOrderSelect} />}
      {currentScreen === 'accounts' && <AccountsManagementScreen onNavigate={handleNavigate} onExpenseEdit={handleExpenseEdit} onOrderSelect={handleOrderSelect} />}
      {currentScreen === 'create-expense' && <CreateExpenseScreen onNavigate={handleNavigate} expenseTypes={expenseTypes} expenseSubtypes={expenseSubtypes} onTypeCreated={handleTypeCreated} onSubtypeCreated={handleSubtypeCreated} />}
      {currentScreen === 'create-expense-subtype' && <CreateExpenseSubtypeScreen onNavigate={handleNavigate} expenseTypes={expenseTypes} expenseSubtypes={expenseSubtypes} onTypeCreated={handleTypeCreated} onSubtypeCreated={handleSubtypeCreated} />}
      {currentScreen === 'edit-expense' && selectedExpense && <EditExpenseScreen expense={selectedExpense} onNavigate={handleNavigate} expenseTypes={expenseTypes} expenseSubtypes={expenseSubtypes} onTypeCreated={handleTypeCreated} onSubtypeCreated={handleSubtypeCreated} />}
      {currentScreen === 'metrics' && <MetricsScreen onNavigate={handleNavigate} />}
      {currentScreen === 'employees' && <EmployeeManagementScreen onNavigate={handleNavigate} onEmployeeEdit={handleEmployeeEdit} />}
      {currentScreen === 'create-employee' && <CreateEmployeeScreen onNavigate={handleNavigate} />}
      {currentScreen === 'edit-employee' && selectedEmployee && <EditEmployeeScreen employee={selectedEmployee} onNavigate={handleNavigate} />}
      {currentScreen === 'attendance' && <EmployeeAttendanceScreen onNavigate={handleNavigate} />}
      {currentScreen === 'role-setup' && <RoleSalarySetupScreen onNavigate={handleNavigate} onRoleEdit={handleRoleEdit} />}
      {currentScreen === 'create-role' && <CreateRoleScreen onNavigate={handleNavigate} />}
      {currentScreen === 'edit-role' && selectedRole && <EditRoleScreen role={selectedRole} onNavigate={handleNavigate} />}
      {currentScreen === 'salary-ledger' && <SalaryLedgerScreen onNavigate={handleNavigate} />}
      {currentScreen === 'salary-ledger-detail' && <SalaryLedgerDetailScreen onNavigate={handleNavigate} />}
      {currentScreen === 'add-payment' && <AddPaymentScreen onNavigate={handleNavigate} />}
      {currentScreen === 'vendors' && <VendorManagementScreen onNavigate={handleNavigate} onVendorEdit={handleVendorEdit} />}
      {currentScreen === 'create-vendor' && <CreateVendorScreen onNavigate={handleNavigate} />}
      {currentScreen === 'edit-vendor' && selectedVendor && <EditVendorScreen vendor={selectedVendor} onNavigate={handleNavigate} />}
      {currentScreen === 'vendor-ledger' && <VendorLedgerScreen onNavigate={handleNavigate} />}
      {currentScreen === 'create-procurement-request' && <CreateProcurementRequestScreen onNavigate={handleNavigate} />}
      {currentScreen === 'procurement-request-detail' && <ProcurementRequestDetailScreen onNavigate={handleNavigate} requestId="PR-001" />}
      {currentScreen === 'vendor-payment' && <VendorPaymentScreen onNavigate={handleNavigate} />}
      {currentScreen === 'cash-flow' && <CashFlowScreen onNavigate={handleNavigate} />}
      {currentScreen === 'cash-ledger' && <CashLedgerScreen onNavigate={handleNavigate} />}
      {currentScreen === 'loan-management' && <LoanManagementScreen onNavigate={handleNavigate} />}
      {currentScreen === 'create-loan' && <CreateLoanScreen onNavigate={handleNavigate} />}
      {currentScreen === 'loan-ledger' && <LoanLedgerScreen onNavigate={handleNavigate} />}
      {currentScreen === 'add-loan-transaction' && <AddLoanTransactionScreen onNavigate={handleNavigate} />} */}
    </div>
  );
}