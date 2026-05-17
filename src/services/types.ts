/* ------------------------------------------------------------------
   TYPES (derived from schema)
-------------------------------------------------------------------*/

export type UserRole = "ADMIN" | "EMPLOYEE";
export type EmployeeCategory = "DAILY" | "FIXED" | "LOADMEN";
export type LoanType = "OWNER" | "BANK" | "SHORT_TERM";
export type LoanStatus = "ACTIVE" | "CLOSED";
export type LoanTransactionType =
  | "DISBURSEMENT"
  | "REPAYMENT"
  | "INTEREST";
export type PaymentMode = "CASH" | "BANK" | "UPI" | "CHEQUE";
export type DbPaymentMode = "CASH" | "BANK" | "UPI" | "CHEQUE";

export interface Profile {
  id: string;
  phone: string;
  role: UserRole;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  created_at: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  alternate_phone: string | null;
  address: string | null;
  gst_number: string | null;
  notes: string | null;
}

export interface CreateVendorInput {
  name: string;
  phone: string;
  alternate_phone?: string | null;
  address: string;
  gst_number?: string | null;
  notes?: string | null;
}
export interface ProcurementInput {
  material_id: string;
  vendor_id: string;
  quantity: number;
  rate_per_unit: number;
  total_price: number;
  date: string;
}

export interface ProductionEntryInput {
  production_date: string;
  bricks: number;
  round: number;
  wet_ash_kg?: number;
  marble_powder_kg?: number;
  crusher_powder_kg?: number;
  fly_ash_kg?: number;
  cement_bags?: number;
}

export type PaymentStatus =
  | "NOT_PAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID";

export interface OrderCustomer {
  name: string;
  phone: string;
}

export type LoadingType = 'LOADING_UNLOADING' | 'LOADING_ONLY' | 'CUSTOMER_SELF';
export interface Order {
  id: string;
  customer_id: string;
  order_date: string;
  delivery_date: string;
  brick_quantity: number;
  price_per_brick: number | null;
  paper_price: number | null;
  final_price: number;
  location: string;
  payment_status: PaymentStatus;
  loading_type: LoadingType;
  amount_paid: number;
  gst_number: string | null;
  dc_number: string | null;
  delivered: boolean;
  created_by: string;
  created_at: string;
  customers?: OrderCustomer;
  time: string | null;
  loadingType: LoadingType;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  role_id: string;
}

export interface OrderWithLoadmen extends Order {
  loadmen?: Employee[];
}

export interface EmployeeWithCategory extends Employee {
  roles: {
    id: string;
    name: string;
    category: EmployeeCategory;
    salary_value: number;
    no_loading_salary: boolean;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;      // total matching rows
  hasMore: boolean;   // for "Load more" visibility
}

export interface Customer{
  id: string;
  name: string;
  phone: string;
  address: string;
  gst_number?: string | null;
  created_at: string;
}

export interface CreateCustomerPaymentInput {
  customer_id: string;
  payment_date: string;
  amount: number;
  mode: "Cash" | "UPI" | "Bank Transfer" | "Cheque";
  sender_account_no?: string;        // ✅ text
  receiver_account_id?: string;      // ✅ uuid, optional for Cash
}
export interface CreateOrderInput {
  customer_id: string;
  order_date: string;        // YYYY-MM-DD
  delivery_date: string;     // YYYY-MM-DD
  brick_quantity: number;
  price_per_brick?: number;
  paper_price?: number;
  final_price: number;
  location: string;
  payment_status: "NOT_PAID" | "PARTIALLY_PAID" | "FULLY_PAID";
  amount_paid: number;
  gst_number?: string | null;
  dc_number?: string | null;
}

export interface ProductionEntry {
  id: string;
  production_date: string;
  round: number;
  bricks: number;

  wet_ash_kg: number | null;
  marble_powder_kg: number | null;
  crusher_powder_kg: number | null;
  fly_ash_kg: number | null;
  cement_bags: number | null;

  created_at: string;
}

export interface CreateLoanInput {
  lender_name: string;
  loan_type: LoanType;
  principal_amount: number;
  interest_rate?: number | null;
  disbursement_account_id?: string | null;
  start_date: string; // YYYY-MM-DD
  notes?: string | null;
}

export interface Account {
  id: string;
  account_number: string;
  opening_balance: number;
  balance: number;
  created_at: string;
}

export interface CreateAccountInput {
  account_number: string;
  opening_balance: number;
}

export interface CreateAccountTransferInput {
  sender_account_id: string;
  receiver_account_id: string;
  amount: number;
  transfer_date: string;
  notes?: string | null;
}

export interface AccountTransfer {
  id: number;
  sender_account_id: string;
  receiver_account_id: string;
  amount: number;
  transfer_date: string;
  notes: string | null;
  created_at: string;
  sender_account?: { account_number: string };
  receiver_account?: { account_number: string };
}

export interface Loan {
  id: string;
  lender_name: string;
  loan_type: LoanType;
  principal_amount: number;
  interest_rate: number | null;
  outstanding_balance: number;
  disbursement_account_id: string | null;
  start_date: string;
  status: LoanStatus;
  notes: string | null;
  created_at: string;
}

export interface LoanLedgerItem {
  id: string;
  loan_id: string;
  transaction_type: LoanTransactionType;
  amount: number;
  running_balance: number;
  payment_mode: "CASH" | "BANK" | "UPI" | "CHEQUE";
  sender_account_id: string | null;
  receiver_account_info: string | null;
  transaction_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
}

export interface CreateLoanLedgerInput {
  loan_id: string;
  transaction_type: LoanTransactionType;
  amount: number;
  transaction_date: string; // YYYY-MM-DD
  payment_mode: PaymentMode;
  sender_account_id: string;
  receiver_account_info?: string | null;
  notes?: string | null;
}

export interface VendorWithMaterials {
  id: string;
  name: string;
  phone: string | null;
  alternate_phone: string | null;
  gst_number: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  materials: Material[];
}

export interface RoleWithCategory {
  id: string;
  name: string;
  category: EmployeeCategory;
  no_loading_salary: boolean;
}

export interface CreateEmployeeInput {
  name: string;
  phone: string;
  alternate_phone?: string | null;
  blood_group: string;
  aadhar_number: string;
  permanent_address: string;
  local_address?: string | null;
  role_id: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  deduction_amount?: number | null;
}

export interface UpdateEmployeeInput {
  name: string;
  phone: string;
  alternate_phone?: string | null;
  blood_group: string;
  aadhar_number: string;
  permanent_address: string;
  local_address?: string | null;
  role_id: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  deduction_amount?: number | null;
}

export interface EmployeeDetail {
  id: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  blood_group: string;
  aadhar: string;
  permanent_address: string;
  local_address: string | null;
  role_id: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  deduction_amount: number | null;
  active: boolean;
  created_at: string;
  roles: {
    id: string;
    name: string;
    category: EmployeeCategory;
  };
}

export interface CreateRoleInput {
  name: string;
  category: EmployeeCategory;
  salary_value: number;
  minimum_requirement?: number | null;
  no_loading_salary?: boolean;
  active?: boolean;
}

export interface UpdateRoleInput {
  name: string;
  category: EmployeeCategory;
  salary_value: number;
  minimum_requirement?: number | null;
  no_loading_salary?: boolean;
  active?: boolean;
}

export interface Role {
  id: string;
  name: string;
  category: EmployeeCategory;
  salary_value: number;
  minimum_requirement: number | null;
  no_loading_salary: boolean;
  active: boolean;
}

export type AttendanceStatus = "Present" | "Absent" | "Half Day" | "Leave";

export interface EmployeeForAttendance {
  id: string;
  name: string;
  phone: string;
  role_id: string;
  deduction_amount: number | null;
  roles: {
    id: string;
    name: string;
    category: EmployeeCategory;
    salary_value: number;
  };
}

export interface AttendanceRecord {
  employee_id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
}

export interface AttendanceEntry {
  employee: EmployeeForAttendance;
  status: AttendanceStatus | "";
}

export interface SaveAttendanceInput {
  employee_id: string;
  date: string;
  status: AttendanceRecord['status'];
}

export interface EmployeeSearchResult {
  id: string;
  name: string;
  phone: string;
  role_name: string;
  category: "DAILY" | "FIXED" | "LOADMEN";
  running_balance: number;
}

export interface EmployeeSummary {
  id: string;
  name: string;
  phone: string;
  role_name: string | null;
  role_category: string | null;
  running_balance: number;
}

export interface SalaryLedgerTransaction {
  id: string;
  entry_type: string;
  amount: number;
  payment_mode: string | null;
  sender_account_id: string | null;
  receiver_account: string | null;
  notes: string | null;
  payment_at: string;
}

export interface EmployeeLedgerResponse {
  employee: EmployeeSummary;
  transactions: SalaryLedgerTransaction[];
  total_count: number;
}

export interface SalaryLedger {
  id: string;
  employee_id: string;
  entry_type: SalaryLedgerEntryType;
  amount: number;
  running_balance: number;
  payment_mode: string | null;
  sender_account_id: string | null;
  receiver_account: string | null;
  notes: string | null;
  created_at: string;
}

export type SalaryLedgerEntryType =
  | "ADVANCE"
  | "WEEKLY"
  | "EMERGENCY"
  | "DAILY"
  | "PARTIAL_SETTLEMENT"
  | "FULL_SETTLEMENT"
  | "SALARY_AUTO_ENTRY"
  | "SALARY_MANUAL_ENTRY"
  | "DEDUCTION"
  | "AUTO";

export interface CreateSalaryLedgerInput {
  payment_at: string;
  employee_id: string;
  entry_type: SalaryLedgerEntryType;
  amount: number;
  payment_mode?: string | null;
  sender_account_id?: string | null;
  receiver_account?: string | null;
  notes?: string | null;
  created_at?: string | null; // ISO string for backdating
}

export interface FinancialSummary {
  total_receivables: number;
  total_vendor_payables: number;
  total_loan_outstanding: number;
  total_salary_payable: number;
}

export interface DailyCashSummary {
  date: string;
  cash_in: number;
  cash_out: number;
}

export interface DailyCashSummaryResponse {
  data: DailyCashSummary[];
  total_days: number;
  has_more: boolean;
}

export interface CashInEntry {
  id: string;
  source_type: string;
  description: string;
  amount: number;
  receiver_account_id: string | null;
  receiver_account_number: string;
  payment_mode: string;
  notes: string | null;
  created_at: string;
}

export interface CashOutEntry {
  id: string;
  payment_type: string;
  description: string;
  amount: number;
  sender_account_id: string | null;
  sender_account_number: string;
  payment_mode: string;
  notes: string | null;
  created_at: string;
}

export interface AccountAggregate {
  account_id: string | null;
  account_number: string;
  total: number;
}

export interface CashLedgerForDate {
  cash_in_entries: CashInEntry[];
  cash_out_entries: CashOutEntry[];
  cash_in_by_account: AccountAggregate[];
  cash_out_by_account: AccountAggregate[];
  total_cash_in: number;
  total_cash_out: number;
}

export interface SalaryEmployee {
  employee_id: string;
  name: string;
  phone: string;
  present_days: number;
  absent_days: number;
  leave_days: number;
  half_days: number;
  base_salary: number;
}

export interface Withdrawal {
  id: number;
  date: string;
  amount: number;
  notes: string | null;
  created_at: string;
  account_id: string;
  accounts?: {
    account_number: string;
  };
}

export interface CreateWithdrawalInput {
  date: string;         // YYYY-MM-DD
  amount: number;
  notes?: string | null;
  account_id: string;
}