import { Session, User } from "@supabase/supabase-js";
import supabase from "../lib/supabaseClient"
import {
  EmployeeCategory,
  Profile,
  Material,
  Vendor,
  CreateVendorInput,
  ProcurementInput,
  ProductionEntryInput,
  Order,
  Employee,
  OrderWithLoadmen,
  EmployeeWithCategory,
  PaginatedResult,
  Customer,
  CreateLoanInput,
  Account,
  CreateAccountInput,
  CreateCustomerPaymentInput,
  CreateOrderInput,
  ProductionEntry,
  Loan,
  LoanLedgerItem,
  CreateLoanLedgerInput,
  VendorWithMaterials,
  RoleWithCategory,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeDetail,
  CreateRoleInput,
  UpdateRoleInput,
  Role,
  EmployeeForAttendance,
  AttendanceRecord,
  SaveAttendanceInput,
  AttendanceStatus,
  EmployeeSearchResult,
  EmployeeLedgerResponse,
  SalaryLedger,
  CreateSalaryLedgerInput,
  FinancialSummary,
  DailyCashSummaryResponse,
  CashLedgerForDate,
  SalaryEmployee,
} from './types'
import { MaterialPurchaseInput, ProductionInput } from "../employee/types";
import { getRange, getRangeForProductionStatistics, PAGE_SIZE , mapPaymentModeToDb } from "../utils/reusables";

export const CASH_ACCOUNT_ID = "04f194f4-af1f-4ac0-98be-a5b7f81b449f";

/* ------------------------------------------------------------------
   1. LOGIN 
-------------------------------------------------------------------*/

export async function login(
  email: string,
  password: string
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data.session!;
}

/* ------------------------------------------------------------------
   2. TOKEN VALIDATION
-------------------------------------------------------------------*/

export async function validateSession(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/* ------------------------------------------------------------------
   3. GET USER PROFILE
-------------------------------------------------------------------*/

export async function getUserProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   4. LOGOUT
-------------------------------------------------------------------*/

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/* ------------------------------------------------------------------
   5. GET MATERIALS
-------------------------------------------------------------------*/

export async function getMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("id, name, unit")
    .order("name");

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   6. GET VENDORS
-------------------------------------------------------------------*/

export async function getVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   6.1 CREATE VENDOR
-------------------------------------------------------------------*/

export async function createVendor(input: CreateVendorInput): Promise<Vendor> {
  const { data, error } = await supabase
    .from("vendors")
    .insert({
      name: input.name,
      phone: input.phone,
      alternate_phone: input.alternate_phone || null,
      address: input.address,
      gst_number: input.gst_number || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   6.5 SEARCH CUSTOMERS
-------------------------------------------------------------------*/

export async function searchCustomers(searchTerm: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------
   7. CREATE PROCUREMENT
-------------------------------------------------------------------*/

export async function createProcurement(
  input: MaterialPurchaseInput,
  createdBy: string
): Promise<void> {
  const { error } = await supabase.from("procurements").insert({
    ...input,
    approved: false,
    rate_per_unit: 0,
    total_price: 0,
    created_by: createdBy
  });

  if (error) throw error;
}

/* ------------------------------------------------------------------
   8. CREATE PRODUCTION ENTRY
-------------------------------------------------------------------*/

export async function createProductionEntry(
  input: ProductionInput,
  createdBy: string
): Promise<void> {
  const { error } = await supabase.from("production_entries").insert({
    production_date: input.date,
    round: input.round,
    bricks: input.bricks,
    wet_ash_kg: input.wetAsh,
    marble_powder_kg: input.marblePowder,
    crusher_powder_kg: input.crusherPowder,
    fly_ash_kg: input.flyAsh,
    cement_bags: input.cement,
    created_by: createdBy
  });

  if (error) throw error;

  // Update product inventory with the bricks quantity
  await updateProductInventory(input.bricks);

  // Reduce raw materials from inventory stock
  await reduceInventoryStock(
    input.wetAsh,
    input.marblePowder,
    input.crusherPowder,
    input.flyAsh,
    input.cement
  );
}

/* ------------------------------------------------------------------
   9. GET TODAY DELIVERY ORDERS
-------------------------------------------------------------------*/

export async function getTodayDeliveryOrders(): Promise<Order[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      customers (
        name,
        phone
      )
    `)
    .eq("delivery_date", today)
    .eq("delivered", false)
    .order("created_at");

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   10. GET LOADMEN (via enum)
-------------------------------------------------------------------*/

export async function getLoadmen(): Promise<EmployeeWithCategory[]> {
  const { data, error } = await supabase
    .from("employees")
    .select(`
      id,
      name,
      phone,
      role_id,
      roles!inner ( id, name, category, salary_value )
    `)
    .eq("roles.category", "LOADMEN" satisfies EmployeeCategory);

  if (error) throw error;
  return data as unknown as EmployeeWithCategory[];
}

/* ------------------------------------------------------------------
   11. GET ORDER WITH LOADMEN
-------------------------------------------------------------------*/

export async function getOrderWithLoadmen(
  orderId: string
): Promise<OrderWithLoadmen> {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      customers ( name, phone ),
      order_loadmen (
        employees (
          id,
          name,
          phone,
          role_id
        )
      )
    `)
    .eq("id", orderId)
    .single();

  if (error) throw error;

  return {
    ...data,
    loadmen: data.order_loadmen.map(
      (ol: any) => ol.employees
    )
  };
}

/* ------------------------------------------------------------------
   12. UPDATE ORDER + LOADMEN
-------------------------------------------------------------------*/

export async function updateOrderWithLoadmen(
  orderId: string,
  orderUpdate: Partial<Order>,
  newLoadmenIds: string[]
): Promise<void> {
  /* Update order */
  const { error: orderError } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", orderId);

  if (orderError) throw orderError;

  /* Deduct bricks from product inventory when order is marked as delivered */
  if (orderUpdate.delivered === true && orderUpdate.brick_quantity) {
    await deductProductInventory(orderUpdate.brick_quantity);
  }

  /* Get existing loadmen */
  const { data: existing } = await supabase
    .from("order_loadmen")
    .select("employee_id")
    .eq("order_id", orderId);

  const existingIds = (existing ?? []).map(e => e.employee_id);

  const toDelete = existingIds.filter(id => !newLoadmenIds.includes(id));
  const toInsert = newLoadmenIds.filter(id => !existingIds.includes(id));

  /* Delete removed loadmen */
  if (toDelete.length > 0) {
    await supabase
      .from("order_loadmen")
      .delete()
      .eq("order_id", orderId)
      .in("employee_id", toDelete);
  }

  /* Insert new loadmen */
  if (toInsert.length > 0) {
    await supabase.from("order_loadmen").insert(
      toInsert.map(employee_id => ({
        order_id: orderId,
        employee_id
      }))
    );
  }
}

/* ------------------------------------------------------------------
   13. GET TODAY DELIVERY ORDERS WITH PAGINATION
-------------------------------------------------------------------*/

export async function getTodayDeliveryOrdersWithPagination(
  page: number
): Promise<PaginatedResult<Order>> {
  const today = new Date().toISOString().split("T")[0];
  const { from, to } = getRange(page);

  const { data, count, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      customers (
        name,
        phone
      )
      `,
      { count: "exact" }
    )
    .eq("delivery_date", today)
    .range(from, to)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: (from + PAGE_SIZE) < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   14. GET UNDELIVERED ORDERS WITH PAGINATION
-------------------------------------------------------------------*/

export async function getUndeliveredOrders(
  page: number
): Promise<PaginatedResult<Order>> {
  const { from, to } = getRange(page);

  const { data, count, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      customers ( name, phone )
      `,
      { count: "exact" }
    )
    .eq("delivered", false)
    .range(from, to)
    .order("delivery_date", { ascending: true });

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: (from + PAGE_SIZE) < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   15. GET DELIVERED ORDERS WITH PAGINATION
-------------------------------------------------------------------*/

export async function getDeliveredOrders(
  page: number
): Promise<PaginatedResult<Order>> {
  const { from, to } = getRange(page);

  const { data, count, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      customers ( name, phone )
      `,
      { count: "exact" }
    )
    .eq("delivered", true)
    .range(from, to)
    .order("delivery_date", { ascending: false });

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: (from + PAGE_SIZE) < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   16. GET UNPAID ORDERS WITH PAGINATION
-------------------------------------------------------------------*/

export async function getUnpaidOrders(
  page: number
): Promise<PaginatedResult<Order>> {
  const { from, to } = getRange(page);

  const { data, count, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      customers ( name, phone )
      `,
      { count: "exact" }
    )
    .eq("delivered", true)
    .in("payment_status", ["NOT_PAID", "PARTIALLY_PAID"])
    .range(from, to)
    .order("delivery_date", { ascending: true });

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: (from + PAGE_SIZE) < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   17. GET CUSTOMERS WITH PAGINATION
-------------------------------------------------------------------*/

export async function getCustomersWithFinancials(
  page = 1,
  search?: string
) {
  const PAGE_SIZE = 20;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("customer_financials")
    .select("*", { count: "exact" })
    .order("name");

  if (search && search.trim().length >= 2) {
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  return {
    data: data ?? [],
    hasMore: count ? to < count - 1 : false,
  };
}

/* ------------------------------------------------------------------
   17a. GET CUSTOMER SUMMARY TOTALS (all customers, not paginated)
-------------------------------------------------------------------*/

export async function getCustomerSummaryTotals(): Promise<{
  totalCustomers: number;
  totalSales: number;
  totalOutstanding: number;
}> {
  const { data, error } = await supabase
    .from("customer_financials")
    .select("total_sales, outstanding_amount");

  if (error) throw error;

  const rows = data ?? [];
  return {
    totalCustomers: rows.length,
    totalSales: rows.reduce((sum, r) => sum + Number(r.total_sales ?? 0), 0),
    totalOutstanding: rows.reduce(
      (sum, r) => sum + Number(r.outstanding_amount ?? 0),
      0
    ),
  };
}

/* ------------------------------------------------------------------
   18. GET CUSTOMER BY ID
-------------------------------------------------------------------*/

export async function getCustomerFinancialById(customerId: string) {
  // 1️⃣ Fetch customer basic info
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, phone, address, gst_number")
    .eq("id", customerId)
    .single();

  if (customerError) throw customerError;

  // 2️⃣ Fetch financials from the view separately
  const { data: financials, error: financialsError } = await supabase
    .from("customer_financials")
    .select("total_sales, outstanding_amount")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (financialsError) throw financialsError;

  return {
    customer_id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    gst_number: customer.gst_number ?? null,
    total_sales: financials?.total_sales ?? 0,
    outstanding_amount: financials?.outstanding_amount ?? 0,
  };
}


/* ------------------------------------------------------------------
   19. CREATE CUSTOMER
-------------------------------------------------------------------*/

export async function createCustomer(input: {
  name: string;
  phone: string;
  address: string;
  gst_number?: string;
}): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
  name: input.name,
  phone: input.phone,
  address: input.address,
  gst_number: input.gst_number ?? null,
})
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   20. GET ORDERS BY CUSTOMER
-------------------------------------------------------------------*/

export async function getCustomerOrdersWithSettlement(
  customerId: string,
  page = 1
) {
  const PAGE_SIZE = 20;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from("customer_order_settlement")
    .select(
      `
        order_id,
        customer_id,
        order_date,
        delivery_date,
        brick_quantity,
        final_price,
        gst_number,
        dc_number,
        total_paid,
        remaining_balance,
        payment_status,
        delivered
      `,
      { count: "exact" }
    )
    .eq("customer_id", customerId)
    .eq("delivered", true)
    .order("order_date", { ascending: true })
    .range(from, to);

  if (error) throw error;

  return {
    data: data ?? [],
    hasMore: count ? to < count - 1 : false,
  };
  }

  /*-----------------------------------------------------------
   21. CREATE ORDERS
-------------------------------------------------------------------*/

export async function createOrder(
  orderInput: CreateOrderInput,
  loadmenIds: string[],
  createdBy: string
): Promise<{ orderId: string }> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      ...orderInput,
      delivered: false,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (orderError) throw orderError;

  const orderId = order.id;

  if (loadmenIds.length > 0) {
    const loadmenRows = loadmenIds.map((employee_id) => ({
      order_id: orderId,
      employee_id,
    }));

    const { error: loadmenError } = await supabase
      .from("order_loadmen")
      .insert(loadmenRows);

    if (loadmenError) throw loadmenError;
  }
  return { orderId };
}

/* ------------------------------------------------------------------
   22. GET PRODUCTION ENTRIES FROM TODAY WITH PAGINATION
-------------------------------------------------------------------*/

export async function getProductionEntriesFromToday(
  page: number
): Promise<PaginatedResult<ProductionEntry>> {
  const today = new Date().toISOString().split("T")[0];
  const { from, to, limit } = getRangeForProductionStatistics(page);

  const { data, count, error } = await supabase
    .from("production_entries")
    .select(
      `
      id,
      production_date,
      round,
      bricks,
      wet_ash_kg,
      marble_powder_kg,
      crusher_powder_kg,
      fly_ash_kg,
      cement_bags,
      created_at
      `,
      { count: "exact" }
    )
    .lte("production_date", today)
    .order("production_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: from + limit < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   23. CREATE LOANS
-------------------------------------------------------------------*/

export async function createLoanWithDisbursementAndCashEntry(
  input: CreateLoanInput,
  // openCashLedgerDayId: string // currently OPEN cash_ledger_days.id
): Promise<{ loanId: string }> {
  /* -------------------------------------------------------------
     1. DETERMINE PAYMENT MODE
  --------------------------------------------------------------*/
  const paymentMode =
    input.disbursement_account_id === CASH_ACCOUNT_ID
      ? "CASH"
      : "BANK";

  /* -------------------------------------------------------------
     2. CREATE LOAN
  --------------------------------------------------------------*/
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .insert({
      lender_name: input.lender_name,
      loan_type: input.loan_type,
      principal_amount: input.principal_amount,
      interest_rate: input.interest_rate ?? null,
      outstanding_balance: input.principal_amount,
      disbursement_account_id: input.disbursement_account_id,
      start_date: input.start_date,
      status: "ACTIVE",
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (loanError) throw loanError;

  const loanId = loan.id;

  /* -------------------------------------------------------------
     3. CREATE LOAN LEDGER (DISBURSEMENT)
  --------------------------------------------------------------*/
  const { error: loanLedgerError } = await supabase
    .from("loan_ledger")
    .insert({
      loan_id: loanId,
      transaction_type: "DISBURSEMENT",
      amount: input.principal_amount,
      running_balance: input.principal_amount,
      payment_mode: paymentMode,
      sender_account_id: input.disbursement_account_id,
      receiver_account_info: input.lender_name,
      transaction_date: input.start_date,
      notes: input.notes ?? "Loan disbursement",
    });

  if (loanLedgerError) throw loanLedgerError;

  /* -------------------------------------------------------------
     4. INCREMENT DISBURSEMENT ACCOUNT BALANCE
     Loan money flows IN to the selected account.
  --------------------------------------------------------------*/
  if (input.disbursement_account_id) {
    const { error: accountError } = await supabase.rpc(
      "increment_account_balance",
      {
        p_account_id: input.disbursement_account_id,
        p_amount: input.principal_amount,
      }
    );

    if (accountError) throw accountError;
  }

  /* -------------------------------------------------------------
     5. RETURN LOAN ID
  --------------------------------------------------------------*/
  return { loanId };
}

/* ------------------------------------------------------------------
   23a. GET LOAN DISBURSEMENTS BY DATE RANGE
   Fetches DISBURSEMENT entries from loan_ledger within a date range,
   joining loans to get lender_name and loan_type.
   Used by AccountsManagementScreen — Loan Income section.
-------------------------------------------------------------------*/
export async function getLoanDisbursementsByDateRange(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("loan_ledger")
    .select(`
      id,
      loan_id,
      amount,
      payment_mode,
      transaction_date,
      notes,
      loans (
        lender_name,
        loan_type
      )
    `)
    .eq("transaction_type", "DISBURSEMENT")
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch loan interest entries from loan_ledger within a date range.
 * Used in AccountsManagementScreen — Expenses section (Loan Interest).
 */
export async function getLoanInterestByDateRange(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("loan_ledger")
    .select(`
      id,
      loan_id,
      amount,
      payment_mode,
      transaction_date,
      notes,
      sender_account_id,
      loans (
        lender_name,
        loan_type
      )
    `)
    .eq("transaction_type", "INTEREST")
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------
   23b. GET SALARY AUTO ENTRIES BY DATE RANGE
   Fetches SALARY_AUTO_ENTRY entries from salary_ledger within a date range,
   joining employees to get employee name.
   Used by AccountsManagementScreen — Salary Expense section.
-------------------------------------------------------------------*/
export async function getSalaryAutoEntriesByDateRange(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("salary_ledger")
    .select(`
      id,
      employee_id,
      entry_type,
      amount,
      notes,
      created_at,
      employees (
        name
      )
    `)
    .eq("entry_type", "SALARY_AUTO_ENTRY")
    .gte("created_at", `${startDate}T00:00:00`)
    .lte("created_at", `${endDate}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}


/* ------------------------------------------------------------------
   24. GET ACCOUNTS
-------------------------------------------------------------------*/

export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(`
      id,
      account_number,
      opening_balance,
      balance,
      created_at
    `)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

/* ------------------------------------------------------------------
   24a. CREATE ACCOUNT
-------------------------------------------------------------------*/

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      account_number: input.account_number,
      opening_balance: input.opening_balance,
      balance: input.opening_balance,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc("get_financial_summary");

  if (error) throw error;

  return data as FinancialSummary;
}

/* ------------------------------------------------------------------
   25. UPDATE CUSTOMER
-------------------------------------------------------------------*/

export async function updateCustomer(
  customerId: string,
  input: {
    name: string;
    phone: string;
    address: string;
    gst_number?: string;
  }
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update({
      name: input.name,
      phone: input.phone,
      address: input.address,
      gst_number: input.gst_number ?? null,
    })
    .eq("id", customerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   26. GET COMPANY ACC FOR CUSTOMER PAYMENTS
-------------------------------------------------------------------*/

export async function getAccountsForPayments() {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, account_number");

  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------
   27. CREATE CUSTOMER PAYMENT
-------------------------------------------------------------------*/

export async function createCustomerPayment(
  input: CreateCustomerPaymentInput
) {
  /**
   * 1️⃣ Insert payment
   */
  const dbMode = mapPaymentModeToDb(input.mode);
  const { data: payment, error: insertError } = await supabase
    .from("customer_payments")
    .insert({
      customer_id: input.customer_id,
      payment_date: input.payment_date,
      amount: input.amount,
      mode: dbMode, // MUST be: 'CASH' | 'UPI' | 'BANK' | 'CHEQUE'
      sender_account_no: input.sender_account_no ?? null,
      receiver_account_id: input.receiver_account_id,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  /**
   * 2️⃣ Apply FIFO settlement
   */
  const { error: fifoError } = await supabase.rpc(
    "apply_customer_payment_fifo",
    {
      p_customer_id: input.customer_id,
      p_payment_id: payment.id,
      p_amount: input.amount,
    }
  );

  if (fifoError) throw fifoError;

  /**
   * 3️⃣ Increment account balance
   */
  const { error: accountError } = await supabase.rpc(
    "increment_account_balance",
    {
      p_account_id: input.receiver_account_id,
      p_amount: input.amount,
    }
  );

  if (accountError) throw accountError;

  return payment;
}

/* ------------------------------------------------------------------
   27a. DELETE CUSTOMER PAYMENT (Reverse FIFO + Account)
-------------------------------------------------------------------*/

export async function deleteCustomerPayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc("reverse_customer_payment", {
    p_payment_id: paymentId,
  });

  if (error) throw error;
}

/* ------------------------------------------------------------------
   28. GET CUSTOMER PAYMENT
-------------------------------------------------------------------*/

export async function getCustomerPayments(
  customerId: string,
  page = 1
) {
  const PAGE_SIZE = 20;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from("customer_payments_view")
    .select("*", { count: "exact" })
    .eq("customer_id", customerId)
    .range(from, to);

  if (error) throw error;

  return {
    data: data ?? [],
    hasMore: count ? to < count - 1 : false,
  };
}

/* ------------------------------------------------------------------
   29. GET LOANS
-------------------------------------------------------------------*/

export async function getLoans(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from("loans")
    .select(`
      id,
      lender_name,
      loan_type,
      principal_amount,
      interest_rate,
      outstanding_balance,
      disbursement_account_id,
      start_date,
      status,
      notes,
      created_at
    `)
    // ACTIVE first, then CLOSED
    .order("status", { ascending: true }) // ACTIVE < CLOSED alphabetically
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

/* ------------------------------------------------------------------
   30. GET LOAN LEDGER
-------------------------------------------------------------------*/

export async function getLoanLedger(
  loanId: string,
  page: number
): Promise<PaginatedResult<LoanLedgerItem>> {
  const { from, to } = getRange(page);

  const { data, count, error } = await supabase
    .from("loan_ledger")
    .select(
      `
      id,
      loan_id,
      transaction_type,
      amount,
      running_balance,
      payment_mode,
      sender_account_id,
      receiver_account_info,
      transaction_date,
      notes,
      created_at
      `,
      { count: "exact" }
    )
    .eq("loan_id", loanId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: (from + PAGE_SIZE) < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   31. GET LOAN BY ID
-------------------------------------------------------------------*/

export async function getLoanById(loanId: string): Promise<Loan> {
  const { data, error } = await supabase
    .from("loans")
    .select(`
      id,
      lender_name,
      loan_type,
      principal_amount,
      interest_rate,
      outstanding_balance,
      disbursement_account_id,
      start_date,
      status,
      notes,
      created_at
    `)
    .eq("id", loanId)
    .single();

  if (error) throw error;

  return data;
}

/* ------------------------------------------------------------------
   31. GET LOAN BY ID
-------------------------------------------------------------------*/

export async function createLoanLedgerTransaction(
  input: CreateLoanLedgerInput
): Promise<{ newBalance: number; loanStatus: "ACTIVE" | "CLOSED" }> {
  /* -------------------------------------------------------------
     1. FETCH CURRENT LOAN BALANCE
  --------------------------------------------------------------*/
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("id, outstanding_balance, status")
    .eq("id", input.loan_id)
    .single();

  if (loanError) throw loanError;

  if (loan.status === "CLOSED") {
    throw new Error("Loan is already closed");
  }

  /* -------------------------------------------------------------
     2. CALCULATE NEW RUNNING BALANCE
  --------------------------------------------------------------*/
  let newBalance = loan.outstanding_balance;

  switch (input.transaction_type) {
    case "DISBURSEMENT":
      newBalance += input.amount;
      break;

    case "REPAYMENT":
      newBalance -= input.amount;
      break;

    case "INTEREST":
      // Interest does NOT affect principal balance
      newBalance = loan.outstanding_balance;
      break;

    default:
      throw new Error("Invalid loan transaction type");
  }

  if (newBalance < 0) {
    throw new Error("Repayment amount exceeds outstanding balance");
  }

  /* -------------------------------------------------------------
     3. INSERT LOAN LEDGER ENTRY
  --------------------------------------------------------------*/
  const { error: ledgerError } = await supabase
    .from("loan_ledger")
    .insert({
      loan_id: input.loan_id,
      transaction_type: input.transaction_type,
      amount: input.amount,
      running_balance: newBalance,
      payment_mode: input.payment_mode,
      sender_account_id: input.sender_account_id,
      receiver_account_info: input.receiver_account_info ?? null,
      transaction_date: input.transaction_date,
      notes: input.notes ?? null,
    });

  if (ledgerError) throw ledgerError;

  /* -------------------------------------------------------------
     4. UPDATE LOAN (BALANCE + STATUS)
  --------------------------------------------------------------*/
  const newStatus = newBalance === 0 ? "CLOSED" : "ACTIVE";

  const { error: updateError } = await supabase
    .from("loans")
    .update({
      outstanding_balance: newBalance,
      status: newStatus,
    })
    .eq("id", input.loan_id);

  if (updateError) throw updateError;

  /* -------------------------------------------------------------
     5. DEDUCT FROM SENDER ACCOUNT (REPAYMENT + INTEREST)
     Money flows OUT from the sender account for both repayments
     and interest payments.
  --------------------------------------------------------------*/
  if (input.transaction_type === "REPAYMENT" || input.transaction_type === "INTEREST") {
    const accountToDeduct = input.sender_account_id;

    if (accountToDeduct) {
      const { error: deductError } = await supabase.rpc(
        "decrement_account_balance",
        {
          p_account_id: accountToDeduct,
          p_amount: input.amount,
        }
      );

      if (deductError) throw deductError;
    }
  }

  /* -------------------------------------------------------------
     6. RETURN RESULT
  --------------------------------------------------------------*/
  return {
    newBalance,
    loanStatus: newStatus,
  };
}

/* ------------------------------------------------------------------
   32. CREATE VENDOR WITH MATERIALS
-------------------------------------------------------------------*/

export async function createVendorWithMaterials(
  vendorInput: CreateVendorInput,
  materialIds: string[]
): Promise<{ vendorId: string }> {
  /* -------------------------------------------------------------
     1. CREATE VENDOR
  --------------------------------------------------------------*/
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .insert({
      name: vendorInput.name,
      phone: vendorInput.phone ?? null,
      alternate_phone: vendorInput.alternate_phone ?? null,
      gst_number: vendorInput.gst_number ?? null,
      address: vendorInput.address ?? null,
      notes: vendorInput.notes ?? null,
    })
    .select("id")
    .single();

  if (vendorError) throw vendorError;

  const vendorId = vendor.id;

  /* -------------------------------------------------------------
     2. CREATE VENDOR ↔ MATERIAL MAPPING
  --------------------------------------------------------------*/
  if (materialIds.length > 0) {
    const rows = materialIds.map((material_id) => ({
      vendor_id: vendorId,
      material_id,
    }));

    const { error: mappingError } = await supabase
      .from("vendor_materials")
      .insert(rows);

    if (mappingError) throw mappingError;
  }

  /* -------------------------------------------------------------
     3. RETURN CREATED VENDOR ID
  --------------------------------------------------------------*/
  return { vendorId };
}

/* ------------------------------------------------------------------
   33. SEARCH VENDORS
-------------------------------------------------------------------*/

export async function searchVendors(
  searchTerm: string,
  page: number
): Promise<PaginatedResult<Vendor>> {
  const { from, to } = getRange(page);

  const trimmed = searchTerm?.trim() ?? "";

  let query = supabase
    .from("vendors")
    .select(
      `
      id,
      name,
      phone,
      alternate_phone,
      gst_number,
      address,
      notes,
      created_at
      `,
      { count: "exact" }
    );

  /* -------------------------------------------------------------
     Apply search only if string is not empty
  --------------------------------------------------------------*/
  if (trimmed.length > 0) {
    query = query.or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,alternate_phone.ilike.%${trimmed}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   34. GET VENDOR BY ID WITH MATERIALS
-------------------------------------------------------------------*/

export async function getVendorByIdWithMaterials(
  vendorId: string
): Promise<VendorWithMaterials> {
  const { data, error } = await supabase
    .from("vendors")
    .select(`
      id,
      name,
      phone,
      alternate_phone,
      gst_number,
      address,
      notes,
      created_at,
      vendor_materials (
        materials (
          id,
          name,
          unit
        )
      )
    `)
    .eq("id", vendorId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    alternate_phone: data.alternate_phone,
    gst_number: data.gst_number,
    address: data.address,
    notes: data.notes,
    created_at: data.created_at,
    materials: (data.vendor_materials ?? []).map(
      (vm: any) => vm.materials
    ),
  };
}

/* ------------------------------------------------------------------
   35. UPDATE VENDOR WITH MATERIALS
-------------------------------------------------------------------*/

export async function updateVendorWithMaterials(
  vendorId: string,
  vendorInput: CreateVendorInput,
  materialIds: string[]
): Promise<void> {
  /* -------------------------------------------------------------
     1. UPDATE VENDOR
  --------------------------------------------------------------*/
  const { error: vendorError } = await supabase
    .from("vendors")
    .update({
      name: vendorInput.name,
      phone: vendorInput.phone ?? null,
      alternate_phone: vendorInput.alternate_phone ?? null,
      gst_number: vendorInput.gst_number ?? null,
      address: vendorInput.address ?? null,
      notes: vendorInput.notes ?? null,
    })
    .eq("id", vendorId);

  if (vendorError) throw vendorError;

  /* -------------------------------------------------------------
     2. GET EXISTING MATERIALS
  --------------------------------------------------------------*/
  const { data: existingMaterials } = await supabase
    .from("vendor_materials")
    .select("material_id")
    .eq("vendor_id", vendorId);

  const existingIds = (existingMaterials ?? []).map((vm) => vm.material_id);

  /* -------------------------------------------------------------
     3. DETERMINE CHANGES
  --------------------------------------------------------------*/
  const toDelete = existingIds.filter((id) => !materialIds.includes(id));
  const toInsert = materialIds.filter((id) => !existingIds.includes(id));

  /* -------------------------------------------------------------
     4. DELETE REMOVED MATERIALS
  --------------------------------------------------------------*/
  if (toDelete.length > 0) {
    await supabase
      .from("vendor_materials")
      .delete()
      .eq("vendor_id", vendorId)
      .in("material_id", toDelete);
  }

  /* -------------------------------------------------------------
     5. INSERT NEW MATERIALS
  --------------------------------------------------------------*/
  if (toInsert.length > 0) {
    const rows = toInsert.map((material_id) => ({
      vendor_id: vendorId,
      material_id,
    }));

    const { error: insertError } = await supabase
      .from("vendor_materials")
      .insert(rows);

    if (insertError) throw insertError;
  }
}

/* ------------------------------------------------------------------
   36. GET EXPENSE TYPES
-------------------------------------------------------------------*/
export async function getExpenseTypes() {
  const { data, error } = await supabase
    .from("expense_types")
    .select("*")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------
   37. CREATE EXPENSE TYPE
-------------------------------------------------------------------*/
export async function createExpenseType(name: string) {
  const { data, error } = await supabase
    .from("expense_types")
    .insert([{ name }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   38. GET EXPENSE SUBTYPES
-------------------------------------------------------------------*/
export async function getExpenseSubtypes(typeId: string) {
  const { data, error } = await supabase
    .from("expense_subtypes")
    .select("*")
    .eq("type_id", typeId)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------
   39. CREATE EXPENSE SUBTYPE
-------------------------------------------------------------------*/
export async function createExpenseSubtype(
  typeId: string,
  name: string
) {
  const { data, error } = await supabase
    .from("expense_subtypes")
    .insert([{ type_id: typeId, name }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   40. CREATE EXPENSE
-------------------------------------------------------------------*/
export async function createExpense(payload: {
  expense_date: string;
  type_id: string;
  subtype_id: string;
  amount: number;
  payment_mode: "CASH" | "UPI" | "BANK" | "CHEQUE";
  sender_account_id?: string;
  comments?: string;
}) {
  // 1️⃣ Decide which account to deduct from
  let accountIdToDeduct: string | undefined;

  if (payload.payment_mode === "CASH") {
    const cashAccount = await getCashAccount();
    accountIdToDeduct = cashAccount.id;
  } else {
    accountIdToDeduct = payload.sender_account_id;
  }

  if (!accountIdToDeduct) {
    throw new Error("Account not found for deduction");
  }

  // 2️⃣ Deduct balance FIRST (before inserting expense)
  // This validates balance and throws error if insufficient
  const { error: rpcError } = await supabase.rpc(
    "decrement_account_balance",
    {
      p_account_id: accountIdToDeduct,
      p_amount: payload.amount,
    }
  );

  if (rpcError) throw rpcError;

  // 3️⃣ Only insert expense if balance deduction was successful
  const { data, error } = await supabase
    .from("expenses")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  return data;
}

/* ------------------------------------------------------------------
   41. GET ORDERS BY DATE RANGE (for Accounts/Income reporting)
   Only fetches delivered orders, filtered by delivery_date.
-------------------------------------------------------------------*/
export async function getOrdersByDateRange(
  startDate: string,
  endDate: string
): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      customers (
        name,
        phone
      )
    `)
    .eq("delivered", true)
    .gte("delivery_date", startDate)
    .lte("delivery_date", endDate)
    .order("delivery_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------
   42. GET EXPENSES BY DATE RANGE (for Accounts/Expenses reporting)
-------------------------------------------------------------------*/
export async function getExpensesByDateRange(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(`
      *,
      expense_types (
        id,
        name
      ),
      expense_subtypes (
        id,
        name
      ),
      accounts (
        id,
        account_number
      )
    `)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)
    .order("expense_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------
   42.0.5 GET EXPENSE BY ID
-------------------------------------------------------------------*/
export async function getExpenseById(expenseId: string): Promise<any> {
  const { data, error } = await supabase
    .from("expenses")
    .select(`
      *,
      expense_types (
        id,
        name
      ),
      expense_subtypes (
        id,
        name
      ),
      accounts (
        id,
        account_number
      )
    `)
    .eq("id", expenseId)
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   42.1 GET PAPER EXPENSES BY DATE RANGE (Expenses + Procurements)
-------------------------------------------------------------------*/
export async function getPaperExpensesByDateRange(
  startDate: string,
  endDate: string
): Promise<any[]> {
  // 1️⃣ Fetch manual expenses
  const { data: expenses, error: expenseError } = await supabase
    .from("expenses")
    .select(`
      id,
      expense_date,
      amount,
      expense_types (
        id,
        name
      ),
      expense_subtypes (
        id,
        name
      ),
      accounts (
        id,
        account_number
      )
    `)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  if (expenseError) throw expenseError;

  // 2️⃣ Fetch approved procurements only
  const { data: procurements, error: procError } = await supabase
    .from("procurements")
    .select(`
      id,
      date,
      total_price,
      materials (
        id,
        name
      ),
      vendors (
        id,
        name
      )
    `)
    .eq("approved", true)
    .gte("date", startDate)
    .lte("date", endDate);

  if (procError) throw procError;

  // 3️⃣ Transform manual expenses
  const manualExpenses = (expenses ?? []).map((e: any) => ({
    id: e.id,
    expense_date: e.expense_date,
    amount: e.amount,
    type: e.expense_types?.[0]?.name || "Unknown",
    subtype: e.expense_subtypes?.[0]?.name || "Unknown",
    source: "EXPENSE" as const,
    account_number: e.accounts?.[0]?.account_number,
  }));

  // 4️⃣ Transform procurements into expense-like format
  const procurementExpenses = (procurements ?? []).map((p: any) => ({
    id: `PROC-${p.id}`,
    expense_date: p.date,
    amount: p.total_price,
    type: "Procurement",
    subtype: p.materials?.[0]?.name || "Unknown Material",
    source: "PROCUREMENT" as const,
    vendor_name: p.vendors?.[0]?.name,
  }));

  // 5️⃣ Combine and sort by date
  const combined = [...manualExpenses, ...procurementExpenses];
  combined.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

  return combined;
}

/* ------------------------------------------------------------------
   42.2 GET PROCUREMENTS BY DATE RANGE (for Accounts integration)
-------------------------------------------------------------------*/
export async function getProcurementsByDateRange(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("procurements")
    .select(`
      id,
      date,
      total_price,
      material_id,
      vendor_id,
      materials (
        id,
        name
      ),
      vendors (
        id,
        name
      )
    `)
    .eq("approved", true)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) throw error;
  
  // Transform data to ensure consistent structure
  return (data ?? []).map(proc => ({
    ...proc,
    // Handle both array and object returns from Supabase
    materials: Array.isArray(proc.materials) ? proc.materials : (proc.materials ? [proc.materials] : []),
    vendors: Array.isArray(proc.vendors) ? proc.vendors : (proc.vendors ? [proc.vendors] : []),
  }));
}

/* ------------------------------------------------------------------
   43. GET CASH ACCOUNT SAI
-------------------------------------------------------------------*/
export async function getCashAccount() {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .ilike("account_number", "Cash")
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   44. GET ACTIVE EMPLOYEES WITH ROLE AND CATEGORY
-------------------------------------------------------------------*/
export async function getActiveEmployees(
  searchTerm: string,
  page: number
): Promise<PaginatedResult<EmployeeWithCategory>> {
  const { from, to } = getRange(page);

  const trimmed = searchTerm?.trim() ?? "";

  let query = supabase
    .from("employees")
    .select(
      `
      id,
      name,
      phone,
      role_id,
      active,
      roles ( id, name, category )
      `,
      { count: "exact" }
    )
    .eq("active", true);

  /* Apply search only if string is not empty */
  if (trimmed.length > 0) {
    query = query.or(
      `name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`
    );
  }

  query = query
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: (data ?? []) as unknown as EmployeeWithCategory[],
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   45. GET INACTIVE EMPLOYEES WITH ROLE AND CATEGORY
-------------------------------------------------------------------*/
export async function getInactiveEmployees(
  searchTerm: string,
  page: number
): Promise<PaginatedResult<EmployeeWithCategory>> {
  const { from, to } = getRange(page);

  const trimmed = searchTerm?.trim() ?? "";

  let query = supabase
    .from("employees")
    .select(
      `
      id,
      name,
      phone,
      role_id,
      active,
      roles ( id, name, category )
      `,
      { count: "exact" }
    )
    .eq("active", false);

  /* Apply search only if string is not empty */
  if (trimmed.length > 0) {
    query = query.or(
      `name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`
    );
  }

  query = query
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: (data ?? []) as unknown as EmployeeWithCategory[],
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
   46. UPDATE EMPLOYEE STATUS (ACTIVE/INACTIVE)
-------------------------------------------------------------------*/
export async function updateEmployeeStatus(
  employeeId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .update({ active: isActive })
    .eq("id", employeeId);

  if (error) throw error;
}

/* ------------------------------------------------------------------
   47. GET ROLES WITH CATEGORY
-------------------------------------------------------------------*/
export async function getRoles(): Promise<RoleWithCategory[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, name, category")
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return data as RoleWithCategory[];
}

/* ------------------------------------------------------------------
   48. CREATE EMPLOYEE
-------------------------------------------------------------------*/
export async function createEmployee(
  input: CreateEmployeeInput
): Promise<{ employeeId: string }> {
  const { data, error } = await supabase
    .from("employees")
    .insert({
      name: input.name,
      phone: input.phone,
      alternate_phone: input.alternate_phone || null,
      blood_group: input.blood_group,
      aadhar: input.aadhar_number,
      permanent_address: input.permanent_address,
      local_address: input.local_address || null,
      role_id: input.role_id,
      emergency_contact_name: input.emergency_contact_name || null,
      emergency_contact_phone: input.emergency_contact_phone || null,
      deduction_amount: input.deduction_amount ?? null,
      active: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { employeeId: data.id };
}

/* ------------------------------------------------------------------
   49. GET EMPLOYEE BY ID
-------------------------------------------------------------------*/
export async function getEmployeeById(
  employeeId: string
): Promise<EmployeeDetail> {
  const { data, error } = await supabase
    .from("employees")
    .select(`
      id,
      name,
      phone,
      alternate_phone,
      blood_group,
      aadhar,
      permanent_address,
      local_address,
      role_id,
      emergency_contact_name,
      emergency_contact_phone,
      deduction_amount,
      active,
      created_at,
      roles ( id, name, category )
    `)
    .eq("id", employeeId)
    .single();

  if (error) throw error;
  return data as unknown as EmployeeDetail;
}

/* ------------------------------------------------------------------
   50. UPDATE EMPLOYEE
-------------------------------------------------------------------*/
export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput
): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .update({
      name: input.name,
      phone: input.phone,
      alternate_phone: input.alternate_phone || null,
      blood_group: input.blood_group,
      aadhar: input.aadhar_number,
      permanent_address: input.permanent_address,
      local_address: input.local_address || null,
      role_id: input.role_id,
      emergency_contact_name: input.emergency_contact_name || null,
      emergency_contact_phone: input.emergency_contact_phone || null,
      deduction_amount: input.deduction_amount ?? null,
    })
    .eq("id", employeeId);

  if (error) throw error;
}

/* ------------------------------------------------------------------
   47. PROCUREMENT FUNCTIONS
-------------------------------------------------------------------*/

export interface ProcurementWithDetails {
  id: string;
  material_id: string;
  vendor_id: string;
  quantity: number;
  rate_per_unit: number;
  total_price: number;
  date: string;
  approved: boolean;
  created_by: string;
  created_at: string;
  materials?: {
    id: string;
    name: string;
    unit: string;
  };
  vendors?: {
    id: string;
    name: string;
    phone: string | null;
  };
}

/*-----------------------------------------------------------------------
 * 47.1 Get unapproved procurements
 * Fetch all unapproved procurements (no date range filter)
 * Used in UnapprovedProcurementsScreen
-------------------------------------------------------------------------- */
export async function getUnapprovedProcurements(): Promise<ProcurementWithDetails[]> {
  const { data, error } = await supabase
    .from("procurements")
    .select(`
      id,
      material_id,
      vendor_id,
      quantity,
      rate_per_unit,
      total_price,
      date,
      approved,
      created_by,
      created_at,
      materials!material_id(id, name, unit),
      vendors!vendor_id(id, name, phone)
    `)
    .eq("approved", false)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching procurements:", error);
    throw error;
  }
  return (data as unknown as ProcurementWithDetails[]) ?? [];
}

/**--------------------------------------------------------------------------
 * 47.2 Get unapproved procurements count
 * Get count of ALL unapproved procurements (no date range filter)
 * Used in InventoryManagementScreen - shows total unapproved count
------------------------------------------------------------------------------ */
export async function getUnapprovedProcurementCount(): Promise<number> {
  const { count, error } = await supabase
    .from("procurements")
    .select("id", { count: "exact", head: true })
    .eq("approved", false);

  if (error) throw error;
  return count ?? 0;
}

/**------------------------------------------------------------------------------
 * 47.3 Update inventory stock when procurement is approved
 * Helper function to add/update material quantity in inventory_stock table
------------------------------------------------------------------------------ */
async function updateInventoryStock(
  materialId: string,
  quantity: number
): Promise<void> {
  // First, check if the material already exists in inventory_stock
  const { data: existingStock, error: fetchError } = await supabase
    .from("inventory_stock")
    .select("*")
    .eq("material_id", materialId);

  if (fetchError) {
    throw fetchError;
  }

  if (existingStock && existingStock.length > 0) {
    // Material exists, update the quantity
    const currentStock = existingStock[0];
    const { error: updateError } = await supabase
      .from("inventory_stock")
      .update({
        quantity: currentStock.quantity + quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("material_id", materialId);

    if (updateError) throw updateError;
  } else {
    // Material doesn't exist, create new record
    const { error: insertError } = await supabase
      .from("inventory_stock")
      .insert({
        material_id: materialId,
        quantity: quantity,
        updated_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;
  }
}

/**------------------------------------------------------------------------------
 * 47.4 Convert quantity to KG based on material type
 * Handles unit conversion for different materials:
 * - Cement: Bags to KG (1 bag = 50 kg)
 * - Crusher Powder: Units to KG (1 unit = 4500 kg)
 * - Others (Wet Ash, Marble, Fly Ash): Tons to KG (1 ton = 1000 kg)
------------------------------------------------------------------------------ */
function convertToKg(materialName: string, quantity: number): number {
  const name = materialName.toLowerCase();
  
  if (name.includes('cement')) {
    // 1 bag = 50 kg
    return quantity * 50;
  } else if (name.includes('crusher')) {
    // 1 unit = 4500 kg
    return quantity * 4500;
  }
  // Wet Ash, Marble Powder, Fly Ash are in tons, convert to kg
  // 1 ton = 1000 kg
  return quantity * 1000;
}

/**------------------------------------------------------------------------------
 * 47.5 Approve procurement
 * Update procurement approval status, rate, and total price
 * Automatically converts quantity to KG and updates inventory_stock
------------------------------------------------------------------------------ */
export async function approveProcurement(
  procurementId: string,
  ratePerUnit: number,
  totalPrice: number
): Promise<void> {
  // First, get the procurement details to access material_id, quantity, and material name
  const { data: procurement, error: fetchError } = await supabase
    .from("procurements")
    .select("material_id, quantity, materials!material_id(name)")
    .eq("id", procurementId)
    .single();

  if (fetchError) throw fetchError;
  if (!procurement) throw new Error("Procurement not found");

  // Update procurement approval status
  const { error: updateError } = await supabase
    .from("procurements")
    .update({
      approved: true,
      rate_per_unit: ratePerUnit,
      total_price: totalPrice,
    })
    .eq("id", procurementId);

  if (updateError) throw updateError;

  // Convert quantity to KG based on material type
  const material = Array.isArray(procurement.materials) 
    ? procurement.materials[0] 
    : procurement.materials;
  const materialName = material?.name || '';
  const quantityInKg = convertToKg(materialName, procurement.quantity);

  // Update inventory stock for the material (store in KG)
  await updateInventoryStock(procurement.material_id, quantityInKg);
}

/**------------------------------------------------------------------------------
 * 47.6 Get inventory stock for all materials or specific material
 * Fetch inventory stock with material details
------------------------------------------------------------------------------ */
export async function getInventoryStock(materialId?: string): Promise<any[]> {
  let query = supabase
    .from("inventory_stock")
    .select(`
      material_id,
      quantity,
      updated_at,
      materials!material_id(id, name, unit)
    `)
    .order("updated_at", { ascending: false });

  if (materialId) {
    query = query.eq("material_id", materialId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

/**------------------------------------------------------------------------------
 * 47.7 Get inventory stock for specific material
 * Fetch inventory stock details for a single material by ID
------------------------------------------------------------------------------ */
export async function getInventoryStockForMaterial(materialId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("inventory_stock")
    .select(`
      material_id,
      quantity,
      updated_at,
      materials!material_id(id, name, unit)
    `)
    .eq("material_id", materialId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data ?? null;
}

/**------------------------------------------------------------------------------
 * 47.8 Get all approved procurements
 * Fetch all procurements that have been approved with material and vendor details
 * Used in InventoryManagementScreen - Procurement tab
------------------------------------------------------------------------------ */
export async function getProcurements(): Promise<any[]> {
  const { data, error } = await supabase
    .from("procurements")
    .select(`
      id,
      material_id,
      vendor_id,
      quantity,
      rate_per_unit,
      total_price,
      date,
      approved,
      created_by,
      created_at,
      materials!material_id(id, name, unit),
      vendors!vendor_id(id, name, phone)
    `)
    .eq("approved", true)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching procurements:", error);
    throw error;
  }
  return data ?? [];
}

/**------------------------------------------------------------------------------
 * 47.9 Get all production entries
 * Fetch all production entries with material usage details
 * Used in InventoryManagementScreen - Usage tab
------------------------------------------------------------------------------*/
export async function getProductionEntries(): Promise<any[]> {
  const { data, error } = await supabase
    .from("production_entries")
    .select(`
      id,
      production_date,
      bricks,
      round,
      wet_ash_kg,
      marble_powder_kg,
      crusher_powder_kg,
      fly_ash_kg,
      cement_bags,
      created_by,
      created_at
    `)
    .order("production_date", { ascending: false });

  if (error) {
    console.error("Error fetching production entries:", error);
    throw error;
  }
  return data ?? [];
}

/**------------------------------------------------------------------------------
 * 47.10 Get production entries by date range
 * Fetch production entries within a specific date range
 * Used in MetricsScreen - Production Performance section
------------------------------------------------------------------------------*/
export async function getProductionEntriesByDateRange(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("production_entries")
    .select(`
      id,
      production_date,
      bricks,
      round,
      wet_ash_kg,
      marble_powder_kg,
      crusher_powder_kg,
      fly_ash_kg,
      cement_bags,
      created_by,
      created_at
    `)
    .gte("production_date", startDate)
    .lte("production_date", endDate)
    .order("production_date", { ascending: false });

  if (error) {
    console.error("Error fetching production entries by date range:", error);
    throw error;
  }
  return data ?? [];
}

/**------------------------------------------------------------------------------
 * 48.0 Get product inventory (Bricks)
 * Fetch the current bricks quantity from product_inventory table
 * Used in InventoryManagementScreen to display bricks ready count
 ------------------------------------------------------------------------------*/
export async function getProductInventory(): Promise<any> {
  const { data, error } = await supabase
    .from("product_inventory")
    .select("id, product_type, quantity, updated_at")
    .eq("product_type", "BRICKS")
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "no rows returned" error, return default
    console.error("Error fetching product inventory:", error);
    throw error;
  }

  // Return data or default if no record exists
  return data ?? { id: null, product_type: "BRICKS", quantity: 0, updated_at: null };
}

/**------------------------------------------------------------------------------
 * 48.1 Update product inventory (Bricks)
 * When an employee submits a production entry, update the product_inventory table
 * Increments the quantity of bricks and updates the updated_at timestamp
 * Used in ProductionEntry form submission
 ------------------------------------------------------------------------------*/
export async function updateProductInventory(quantity: number): Promise<void> {
  try {
    // First, try to fetch the existing BRICKS record
    const { data: existingData, error: fetchError } = await supabase
      .from("product_inventory")
      .select("id, quantity")
      .eq("product_type", "BRICKS")
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" error, which is okay
      throw fetchError;
    }

    if (existingData) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("product_inventory")
        .update({
          quantity: existingData.quantity + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingData.id);

      if (updateError) throw updateError;
    } else {
      // Insert new record if it doesn't exist
      const { error: insertError } = await supabase
        .from("product_inventory")
        .insert({
          product_type: "BRICKS",
          quantity: quantity,
          updated_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;
    }
  } catch (error) {
    console.error("Error updating product inventory:", error);
    throw error;
  }
}

/**------------------------------------------------------------------------------
 * 48.1.1 Deduct product inventory (Bricks) on Delivery
 * When an order is delivered, reduce the bricks quantity in product_inventory
 * Used in delivery entry submission (updateOrderWithLoadmen)
 ------------------------------------------------------------------------------*/
export async function deductProductInventory(quantity: number): Promise<void> {
  try {
    const { data: existingData, error: fetchError } = await supabase
      .from("product_inventory")
      .select("id, quantity")
      .eq("product_type", "BRICKS")
      .single();

    if (fetchError) throw fetchError;

    if (!existingData) {
      throw new Error("No bricks inventory record found");
    }

    // Allow negative to tally correctly when inventory is updated later
    const newQuantity = existingData.quantity - quantity;

    const { error: updateError } = await supabase
      .from("product_inventory")
      .update({
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingData.id);

    if (updateError) throw updateError;
  } catch (error) {
    console.error("Error deducting product inventory:", error);
    throw error;
  }
}

/**------------------------------------------------------------------------------
 * 48.2 Reduce inventory stock for raw materials used in production
 * When an employee submits a production entry, reduce the used materials from inventory_stock
 * Cement: converted from bags to KG (1 bag = 50 kg)
 * Other materials: already in KG
 * Used in ProductionEntry form submission
 ------------------------------------------------------------------------------*/
export async function reduceInventoryStock(
  wetAshKg: number,
  marblePowderKg: number,
  crusherPowderKg: number,
  flyAshKg: number,
  cementBags: number
): Promise<void> {
  try {
    // Convert cement from bags to KG (1 bag = 50 kg)
    const cementKg = cementBags * 50;

    // Get all materials to find their IDs
    const materials = await getMaterials();

    // Find material IDs by name
    const wetAshMaterial = materials.find(m => m.name.toLowerCase().includes('wet ash'));
    const marbleMaterial = materials.find(m => m.name.toLowerCase().includes('marble'));
    const crusherMaterial = materials.find(m => m.name.toLowerCase().includes('crusher'));
    const flyAshMaterial = materials.find(m => m.name.toLowerCase().includes('fly ash'));
    const cementMaterial = materials.find(m => m.name.toLowerCase().includes('cement'));

    // Array of material reductions to process
    const reductions = [
      { materialId: wetAshMaterial?.id, quantity: wetAshKg, name: 'Wet Ash' },
      { materialId: marbleMaterial?.id, quantity: marblePowderKg, name: 'Marble Powder' },
      { materialId: crusherMaterial?.id, quantity: crusherPowderKg, name: 'Crusher Powder' },
      { materialId: flyAshMaterial?.id, quantity: flyAshKg, name: 'Fly Ash' },
      { materialId: cementMaterial?.id, quantity: cementKg, name: 'Cement' },
    ];

    // Process each material reduction
    for (const reduction of reductions) {
      if (!reduction.materialId || reduction.quantity <= 0) continue;

      // Fetch current stock
      const { data: currentStock, error: fetchError } = await supabase
        .from("inventory_stock")
        .select("quantity")
        .eq("material_id", reduction.materialId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error(`Error fetching ${reduction.name} stock:`, fetchError);
        throw fetchError;
      }

      if (currentStock) {
        // Reduce the quantity (allow negative to tally when unapproved procurements are approved later)
        const newQuantity = currentStock.quantity - reduction.quantity;
        const { error: updateError } = await supabase
          .from("inventory_stock")
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("material_id", reduction.materialId);

        if (updateError) {
          console.error(`Error updating ${reduction.name} stock:`, updateError);
          throw updateError;
        }
      } else {
        // If no stock exists, create a negative entry so it tallies when procurement is approved
        const { error: insertError } = await supabase
          .from("inventory_stock")
          .insert({
            material_id: reduction.materialId,
            quantity: -reduction.quantity,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Error inserting negative stock for ${reduction.name}:`, insertError);
          throw insertError;
        }
      }
    }
  } catch (error) {
    console.error("Error reducing inventory stock:", error);
    throw error;
  }
}

/**------------------------------------------------------------------------------
 * 48.3 Get all inventory adjustments
 * Fetch all adjustment records from inventory_adjustments table
 * Used in InventoryManagementScreen - Adjustments tab
 ------------------------------------------------------------------------------*/
export async function getAdjustments(): Promise<any[]> {
  const { data, error } = await supabase
    .from("inventory_adjustments")
    .select(`
      id,
      adjustment_date,
      actual_bricks,
      actual_wet_ash_kg,
      actual_marble_powder_kg,
      actual_crusher_powder_kg,
      actual_fly_ash_kg,
      actual_cement_bags,
      adjusted_bricks,
      adjusted_wet_ash_kg,
      adjusted_marble_powder_kg,
      adjusted_crusher_powder_kg,
      adjusted_fly_ash_kg,
      adjusted_cement_bags,
      reason,
      created_by,
      created_at
    `)
    .order("adjustment_date", { ascending: false });

  if (error) {
    console.error("Error fetching adjustments:", error);
    throw error;
  }
  return data ?? [];
}

/**------------------------------------------------------------------------------
 * 48.4 Create inventory adjustment
 * Create a new adjustment record and update inventory tables
 * When admin adjusts inventory values, this updates:
 * - Inserts record into inventory_adjustments table with actual and adjusted values
 * - Updates product_inventory for bricks
 * - Updates inventory_stock for all raw materials
 * Used in InventoryManagementScreen - Make Adjustments modal
 ------------------------------------------------------------------------------*/
export async function createAdjustment(
  adjustment_date: string,
  actual_bricks: number,
  actual_wet_ash_kg: number,
  actual_marble_powder_kg: number,
  actual_crusher_powder_kg: number,
  actual_fly_ash_kg: number,
  actual_cement_bags: number,
  adjusted_bricks: number,
  adjusted_wet_ash_kg: number,
  adjusted_marble_powder_kg: number,
  adjusted_crusher_powder_kg: number,
  adjusted_fly_ash_kg: number,
  adjusted_cement_bags: number,
  reason: string | null,
  userId: string
): Promise<void> {
  try {
    // Step 1: Insert adjustment record into inventory_adjustments table
    const { error: insertError } = await supabase
      .from("inventory_adjustments")
      .insert({
        adjustment_date,
        actual_bricks,
        actual_wet_ash_kg,
        actual_marble_powder_kg,
        actual_crusher_powder_kg,
        actual_fly_ash_kg,
        actual_cement_bags,
        adjusted_bricks,
        adjusted_wet_ash_kg,
        adjusted_marble_powder_kg,
        adjusted_crusher_powder_kg,
        adjusted_fly_ash_kg,
        adjusted_cement_bags,
        reason,
        created_by: userId,
      });

    if (insertError) throw insertError;

    // Step 2: Update product_inventory for bricks
    const { data: existingBricks, error: fetchBricksError } = await supabase
      .from("product_inventory")
      .select("id, quantity")
      .eq("product_type", "BRICKS")
      .single();

    if (fetchBricksError && fetchBricksError.code !== "PGRST116") {
      throw fetchBricksError;
    }

    if (existingBricks) {
      const { error: updateBricksError } = await supabase
        .from("product_inventory")
        .update({
          quantity: adjusted_bricks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingBricks.id);

      if (updateBricksError) throw updateBricksError;
    } else {
      const { error: insertBricksError } = await supabase
        .from("product_inventory")
        .insert({
          product_type: "BRICKS",
          quantity: adjusted_bricks,
          updated_at: new Date().toISOString(),
        });

      if (insertBricksError) throw insertBricksError;
    }

    // Step 3: Get all materials to find their IDs
    const materials = await getMaterials();

    // Step 4: Update inventory_stock for each raw material
    const wetAshMaterial = materials.find(m => m.name.toLowerCase().includes('wet ash'));
    const marbleMaterial = materials.find(m => m.name.toLowerCase().includes('marble'));
    const crusherMaterial = materials.find(m => m.name.toLowerCase().includes('crusher'));
    const flyAshMaterial = materials.find(m => m.name.toLowerCase().includes('fly ash'));
    const cementMaterial = materials.find(m => m.name.toLowerCase().includes('cement'));

    // Array of material updates to process
    const materialUpdates = [
      { materialId: wetAshMaterial?.id, quantity: adjusted_wet_ash_kg, name: 'Wet Ash' },
      { materialId: marbleMaterial?.id, quantity: adjusted_marble_powder_kg, name: 'Marble Powder' },
      { materialId: crusherMaterial?.id, quantity: adjusted_crusher_powder_kg, name: 'Crusher Powder' },
      { materialId: flyAshMaterial?.id, quantity: adjusted_fly_ash_kg, name: 'Fly Ash' },
      { materialId: cementMaterial?.id, quantity: adjusted_cement_bags * 50, name: 'Cement' }, // Convert bags to KG
    ];

    // Process each material update
    for (const update of materialUpdates) {
      if (!update.materialId) continue;

      // Fetch current stock (using material_id as primary key)
      const { data: currentStock, error: fetchError } = await supabase
        .from("inventory_stock")
        .select("material_id, quantity")
        .eq("material_id", update.materialId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error(`Error fetching ${update.name} stock:`, fetchError);
        throw fetchError;
      }

      if (currentStock) {
        // Update the quantity to adjusted value
        const { error: updateError } = await supabase
          .from("inventory_stock")
          .update({
            quantity: update.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("material_id", currentStock.material_id);

        if (updateError) {
          console.error(`Error updating ${update.name} stock:`, updateError);
          throw updateError;
        }
      } else {
        // If no stock exists, create new record
        const { error: insertError } = await supabase
          .from("inventory_stock")
          .insert({
            material_id: update.materialId,
            quantity: update.quantity,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Error inserting ${update.name} stock:`, insertError);
          throw insertError;
        }
      }
    }
  } catch (error) {
    console.error("Error creating adjustment:", error);
    throw error;
  }
}
/* ------------------------------------------------------------------
  Create Vendor Payment
------------------------------------------------------------------ */
export async function createVendorPayment(input: {
  vendor_id: string
  payment_date: string
  amount: number
  mode: "CASH" | "UPI" | "BANK" | "CHEQUE"
  sender_account_id: string
  receiver_account_info?: string
}) {
  // 1️⃣ Deduct account balance FIRST (validates sufficient funds)
  const { error: accountError } = await supabase.rpc(
    "decrement_account_balance",
    {
      p_account_id: input.sender_account_id,
      p_amount: input.amount
    }
  )

  if (accountError) throw accountError

  // 2️⃣ Insert payment (only if balance deduction succeeded)
  const { data: payment, error } = await supabase
    .from("vendor_payments")
    .insert({
      vendor_id: input.vendor_id,
      payment_date: input.payment_date,
      amount: input.amount,
      mode: input.mode,
      sender_account_id: input.sender_account_id,
      receiver_account_info: input.receiver_account_info ?? null
    })
    .select()
    .single()

  if (error) throw error

  // 3️⃣ Apply FIFO settlement
  const { error: fifoError } = await supabase.rpc(
    "apply_vendor_payment_fifo",
    {
      p_vendor_id: input.vendor_id,
      p_payment_id: payment.id,
      p_amount: input.amount
    }
  )

  if (fifoError) throw fifoError

  return payment
}

/* ------------------------------------------------------------------
  Delete Vendor Payment (Reverse FIFO + Account)
------------------------------------------------------------------ */
export async function deleteVendorPayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc("reverse_vendor_payment", {
    p_payment_id: paymentId,
  });

  if (error) throw error;
}

/* ------------------------------------------------------------------
  Get Vendor Procurements (Paginated with optional date range and sort)
---------------------------------------------------------------------*/
export async function getVendorProcurements(
  vendorId: string,
  page = 0,
  isAscending = false,
  fromDate?: string,
  toDate?: string
) {
  const { from, to } = getRange(page);

  let query = supabase
    .from("procurements")
    .select(`
      id,
      vendor_id,
      material_id,
      quantity,
      rate_per_unit,
      total_price,
      total_paid,
      payment_status,
      date,
      approved,
      created_at,
      materials!material_id(id, name, unit)
    `, { count: "exact" })
    .eq("vendor_id", vendorId)
    .eq("approved", true);

  if (fromDate) {
    query = query.gte("date", fromDate);
  }
  if (toDate) {
    query = query.lte("date", toDate);
  }

  query = query
    .order("date", { ascending: isAscending })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  };
}
/* ------------------------------------------------------------------
  Get Vendor Payments (Paginated with optional date range and sort)
---------------------------------------------------------------------*/

export async function getVendorPayments(
  vendorId: string,
  page = 0,
  isAscending = false,
  fromDate?: string,
  toDate?: string
) {
  const { from, to } = getRange(page);

  let query = supabase
    .from("vendor_payments")
    .select(`
      id,
      vendor_id,
      payment_date,
      amount,
      mode,
      sender_account_id,
      receiver_account_info,
      created_at,
      accounts (
        account_number
      )
    `, { count: "exact" })
    .eq("vendor_id", vendorId);

  if (fromDate) {
    query = query.gte("payment_date", fromDate);
  }
  if (toDate) {
    query = query.lte("payment_date", toDate);
  }

  query = query
    .order("payment_date", { ascending: isAscending })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  };
}
/* ------------------------------------------------------------------
  Get Vendor Financials
---------------------------------------------------------------------*/
export async function getVendorFinancials(vendorId: string) {
  const { data, error } = await supabase
    .from("vendor_financials")
    .select("*")
    .eq("vendor_id", vendorId)
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
  Create Role
---------------------------------------------------------------------*/

export async function createRole(
  input: CreateRoleInput
): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .insert({
      name: input.name,
      category: input.category,
      salary_value: input.salary_value,
      minimum_requirement: input.minimum_requirement ?? null,
      active: input.active ?? true,
    })
    .select(`
      id,
      name,
      category,
      salary_value,
      minimum_requirement,
      active
    `)
    .single();

  if (error) throw error;

  return data;
}

/* ------------------------------------------------------------------
  Get Role By ID
---------------------------------------------------------------------*/

export async function getRoleById(roleId: string): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .select(`
      id,
      name,
      category,
      salary_value,
      minimum_requirement,
      active
    `)
    .eq("id", roleId)
    .single();

  if (error) throw error;

  return data;
}

/* ------------------------------------------------------------------
  Update Role By ID
---------------------------------------------------------------------*/

export async function updateRole(
  roleId: string,
  input: UpdateRoleInput
): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .update({
      name: input.name,
      category: input.category,
      salary_value: input.salary_value,
      minimum_requirement: input.minimum_requirement ?? null,
      active: input.active ?? true,
    })
    .eq("id", roleId)
    .select(`
      id,
      name,
      category,
      salary_value,
      minimum_requirement,
      active
    `)
    .single();

  if (error) throw error;

  return data;
}

/* ------------------------------------------------------------------
  Get Active Roles (Paginated)
---------------------------------------------------------------------*/
export async function getActiveRoles(
  page: number
): Promise<PaginatedResult<Role>> {
  const { from, to } = getRange(page);

  const { data, count, error } = await supabase
    .from("roles")
    .select(
      `
      id,
      name,
      category,
      salary_value,
      minimum_requirement,
      active
      `,
      { count: "exact" }
    )
    .eq("active", true)
    .order("name")
    .range(from, to);

  if (error) throw error;

  return {
    data: (data ?? []) as Role[],
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
  Get Inactive Roles (Paginated)
---------------------------------------------------------------------*/
export async function getInactiveRoles(
  page: number
): Promise<PaginatedResult<Role>> {
  const { from, to } = getRange(page);

  const { data, count, error } = await supabase
    .from("roles")
    .select(
      `
      id,
      name,
      category,
      salary_value,
      minimum_requirement,
      active
      `,
      { count: "exact" }
    )
    .eq("active", false)
    .order("name")
    .range(from, to);

  if (error) throw error;

  return {
    data: (data ?? []) as Role[],
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
  Update Role Status (Active / Inactive)
---------------------------------------------------------------------*/
export async function updateRoleStatus(
  roleId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from("roles")
    .update({ active: isActive })
    .eq("id", roleId);

  if (error) throw error;
}

/* ------------------------------------------------------------------
  Get All Active Employees (for Attendance)
---------------------------------------------------------------------*/
export async function getEmployeesForAttendance(isActive = true): Promise<EmployeeForAttendance[]> {
  const { data, error } = await supabase
    .from("employees")
    .select(`
      id,
      name,
      phone,
      role_id,
      deduction_amount,
      roles!inner ( id, name, category, salary_value )
    `)
    .eq("active", isActive)
    .neq("roles.category", "LOADMEN" satisfies EmployeeCategory)
    .order("name");

  if (error) throw error;
  return (data ?? []) as unknown as EmployeeForAttendance[];
}

/* ------------------------------------------------------------------
  Get Attendance Records For a Specific Date
---------------------------------------------------------------------*/
export async function getAttendanceForDate(
  date: string // YYYY-MM-DD
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("employee_id, date, status")
    .eq("date", date);

  if (error) throw error;

  return (data ?? []) as AttendanceRecord[];
}

/* ------------------------------------------------------------------
  Save (Upsert) Attendance For a Date
  - If a record already exists for the employee+date → update
  - Otherwise → insert
---------------------------------------------------------------------*/
export async function saveAttendance(
  records: SaveAttendanceInput[]
): Promise<void> {
  if (records.length === 0) return;

  const { error } = await supabase
    .from("attendance")
    .upsert(
      records.map((r) => ({
        employee_id: r.employee_id,
        date: r.date,
        status: r.status,
      })),
      { onConflict: "employee_id,date" }
    );

  if (error) throw error;
}

/* ------------------------------------------------------------------
  Search Employees
---------------------------------------------------------------------*/

export async function searchEmployees(
  searchTerm: string,
  page: number,
  isActive?: boolean
): Promise<PaginatedResult<EmployeeSearchResult>> {

  const { from, to } = getRange(page);
  const trimmed = searchTerm?.trim() ?? "";

  let query = supabase
    .from("employee_with_balance")
    .select("*", { count: "exact" })
    .order("name", { ascending: true });

  if (isActive !== undefined) {
    query = query.eq("active", isActive);
  }

  if (trimmed.length > 0) {
    query = query.or(
      `name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`
    );
  }

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  };
}

/* ------------------------------------------------------------------
  Get Employee Ledger with Pagination and Date Range
  - Fetches salary ledger transactions for a specific employee
  - Supports pagination and optional date range filtering
  - Used in EmployeeDetailsScreen - Salary Ledger section
---------------------------------------------------------------------*/

export async function getEmployeeLedger(
  empId: string,
  page: number,
  isAscending: boolean,
  fromDate?: string,
  toDate?: string
): Promise<EmployeeLedgerResponse> {

  const { data, error } = await supabase.rpc(
    "get_employee_ledger",
    {
      p_employee_id: empId,
      p_is_ascending: isAscending,
      p_from_date: fromDate ?? null,
      p_to_date: toDate ?? null,
      p_page: page,
      p_page_size: 20
    }
  );

  if (error) {
    throw error;
  }

  return data as EmployeeLedgerResponse;
}

/* ------------------------------------------------------------------
  Create Salary Ledger Entry with Running Balance Calculation
  - Creates a new salary ledger entry for an employee
  - Automatically calculates the new running balance based on the last entry
  - Used when recording salary payments or adjustments for an employee
---------------------------------------------------------------------*/
export async function createSalaryLedgerEntry(
  input: CreateSalaryLedgerInput
): Promise<SalaryLedger> {

  /* -------------------------------------------------------------
     1. GET CURRENT RUNNING BALANCE
  --------------------------------------------------------------*/
  const { data: lastEntry, error: balanceError } = await supabase
    .from("salary_ledger")
    .select("running_balance")
    .eq("employee_id", input.employee_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (balanceError) throw balanceError;

  const currentBalance = lastEntry?.running_balance ?? 0;

  /* -------------------------------------------------------------
     2. CALCULATE NEW BALANCE
  --------------------------------------------------------------*/

  let newBalance = currentBalance;

  if (input.entry_type === "AUTO" || input.entry_type === "SALARY_AUTO_ENTRY") {
    newBalance += input.amount;
  } else {
    newBalance -= input.amount;
  }

  /* -------------------------------------------------------------
     3. DEDUCT FROM ACCOUNT / CASH BALANCE (payments only)
  --------------------------------------------------------------*/

  const isPayment = input.entry_type !== "AUTO" && input.entry_type !== "SALARY_AUTO_ENTRY" && input.entry_type !== "DEDUCTION";

  if (isPayment) {
    let accountIdToDeduct: string | undefined;

    if (input.payment_mode === "CASH") {
      const cashAccount = await getCashAccount();
      accountIdToDeduct = cashAccount.id;
    } else {
      accountIdToDeduct = input.sender_account_id ?? undefined;
    }

    if (!accountIdToDeduct) {
      throw new Error("Account not found for deduction");
    }

    const { error: rpcError } = await supabase.rpc(
      "decrement_account_balance",
      {
        p_account_id: accountIdToDeduct,
        p_amount: input.amount,
      }
    );

    if (rpcError) throw rpcError;
  }

  /* -------------------------------------------------------------
     4. INSERT LEDGER ENTRY
  --------------------------------------------------------------*/

  const { data, error } = await supabase
    .from("salary_ledger")
    .insert({
      employee_id: input.employee_id,
      entry_type: input.entry_type,
      amount: input.amount,
      running_balance: newBalance,
      payment_mode: input.payment_mode ?? null,
      sender_account_id: input.sender_account_id ?? null,
      receiver_account: input.receiver_account ?? null,
      notes: input.notes ?? null,
      ...(input.created_at ? { created_at: input.created_at } : {}),
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as SalaryLedger;
}

/* ------------------------------------------------------------------
  Check Employee Is Active
  - Looks up the employees table by phone number
  - Returns true if the employee record exists and active = true
  - Used by EmployeeGuard to block deactivated employees
---------------------------------------------------------------------*/
export async function checkEmployeeIsActive(phone: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("employees")
    .select("active")
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data) return false;
  return data.active === true;
}

/* ------------------------------------------------------------------
   GET DAILY CASH SUMMARY (for CashFlowScreen)
   Paginated daily cash-in / cash-out from today back to 2025-01-01
-------------------------------------------------------------------*/
export async function getDailyCashSummary(
  page: number,
  pageSize: number = 20
): Promise<DailyCashSummaryResponse> {
  const { data, error } = await supabase.rpc("get_daily_cash_summary", {
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw error;

  return data as DailyCashSummaryResponse;
}

/* ------------------------------------------------------------------
   GET CASH LEDGER FOR DATE (for CashLedgerScreen)
   All cash-in / cash-out entries + account aggregates for one day
-------------------------------------------------------------------*/
export async function getCashLedgerForDate(
  date: string // YYYY-MM-DD
): Promise<CashLedgerForDate> {
  const { data, error } = await supabase.rpc("get_cash_ledger_for_date", {
    p_date: date,
  });

  if (error) throw error;

  return data as CashLedgerForDate;
}

export async function checkSalaryAlreadyGenerated(month: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("salary_batches")
    .select("id")
    .eq("month", month)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function getSalaryEmployees(month: string) {
  const { data, error } = await supabase.rpc(
    "get_fixed_salary_employees_for_month",
    { p_month: month }
  );

  if (error) throw error;

  return data as SalaryEmployee[];
}

export async function generateSalaryRPC(
  month: string,
  employees: {
    employee_id: string;
    present_days: number;
    absent_days: number;
    leave_days: number;
    half_days: number;
    base_salary: number;
    final_salary: number;
  }[]
) {
  const { data, error } = await supabase.rpc("generate_salary_batch", {
    p_month: month,
    p_items: employees
  });

  if (error) throw error;

  return data;
}