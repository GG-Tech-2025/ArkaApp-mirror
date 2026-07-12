# ArkaApp — Complete Architecture, Data Flow & Reuse Guide

> **Purpose:** This document is a full technical reference for the ArkaApp codebase. It is intended for developers who want to understand the system deeply, or reuse specific modules (e.g., Accounts & Cash Flow) for a new client application.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Application Entry Points & Routing](#4-application-entry-points--routing)
5. [Authentication & Session Management](#5-authentication--session-management)
6. [Module Breakdown — Admin App](#6-module-breakdown--admin-app)
   - 6.1 Orders
   - 6.2 Production Statistics
   - 6.3 Inventory & Procurement
   - 6.4 Customers
   - 6.5 Accounts (Expenses)
   - 6.6 Cash Flow & Cash Ledger ⭐ (Reusable)
   - 6.7 Loans
   - 6.8 Employees
   - 6.9 Vendors
   - 6.10 Metrics
   - 6.11 Settings
7. [Employee App Modules](#7-employee-app-modules)
8. [Architecture Pattern — Hook-Based Data Flow](#8-architecture-pattern--hook-based-data-flow)
9. [Service Layer — middleware.service.ts](#9-service-layer--middlewareservicets)
10. [Database Tables (Supabase)](#10-database-tables-supabase)
11. [Supabase RPC Functions](#11-supabase-rpc-functions)
12. [Shared Types Reference](#12-shared-types-reference)
13. [Shared UI Components](#13-shared-ui-components)
14. [App Settings System](#14-app-settings-system)
15. [Reuse Guide — Extracting Modules for a New Client](#15-reuse-guide--extracting-modules-for-a-new-client)
16. [Environment Variables](#16-environment-variables)
17. [Build & Deployment](#17-build--deployment)

---

## 1. Application Overview

**ArkaApp** is a full-stack business management application for a **fly ash brick manufacturing company (Arka Bricks)**. It is a **dual-mode** single-page application (SPA) built with React + TypeScript + Supabase.

### Two Modes

| Mode | URL Prefix | Users | Purpose |
|------|-----------|-------|---------|
| **Admin App** | `/admin/*` | Admin / Owner | Complete business management — 30+ screens |
| **Employee App** | `/employee/*` | Field Workers | Simplified entry forms for daily operations |

The landing page (`/`) is an **AppSelector** screen — the user picks which mode to enter.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend Framework | React 18 + TypeScript | |
| Build Tool | Vite 6 | SWC-based transpilation |
| Styling | Tailwind CSS v4 | Utility-first |
| Routing | React Router DOM v7 | Nested route segments |
| Backend / DB | Supabase | PostgreSQL + Auth + RPCs |
| Supabase Client | `@supabase/supabase-js` v2 | |
| Icons | Lucide React | |
| Charts | Recharts | Used in MetricsScreen |
| PDF Export | jsPDF + html2canvas | Vendor ledger export |
| Analytics | Vercel Analytics | Injected at App root |
| UI Primitives | Radix UI (full suite) | Accordion, Dialog, Tabs, etc. |
| Deployment | Vercel | `vercel.json` present |

---

## 3. Project Structure

```
ArkaApp/
├── index.html                    # Vite entry point
├── vite.config.ts                # Vite config
├── vercel.json                   # Vercel SPA rewrite rules
├── package.json
├── tsconfig.json
├── database_migrations/          # SQL migration files
│   ├── app_settings_table.sql
│   └── app_start_date_setting.sql
└── src/
    ├── main.tsx                  # React DOM root render
    ├── App.tsx                   # Root router — splits /admin and /employee
    ├── AppSelector.tsx           # Landing page — mode picker
    ├── AdminApp.tsx              # Admin module root
    ├── index.css                 # Base CSS
    ├── styles/
    │   └── globals.css
    ├── lib/
    │   └── supabaseClient.ts     # Supabase singleton client
    ├── services/
    │   ├── middleware.service.ts # ALL Supabase calls (3800+ lines)
    │   └── types.ts              # ALL TypeScript types/interfaces
    ├── utils/
    │   └── reusables.ts          # Pagination helpers, mapPaymentModeToDb
    ├── components/
    │   ├── Popup.tsx             # Shared success/error popup
    │   └── ui/                   # Radix-based UI components
    ├── assets/
    │   └── arka_logo.png
    ├── admin/                    # Admin app code
    │   ├── routes.tsx            # Admin route tree
    │   ├── components/
    │   │   └── AdminGuard.tsx    # Auth guard — checks ADMIN role
    │   ├── hooks/                # One hook per screen/feature
    │   ├── pages/                # Grouped by module
    │   │   ├── AdminLoginScreen.tsx
    │   │   ├── AdminHomeScreen.tsx
    │   │   ├── MetricsScreen.tsx
    │   │   ├── ProductionStatisticsScreen.tsx
    │   │   ├── cash/
    │   │   ├── accounts/
    │   │   ├── orders/
    │   │   ├── customers/
    │   │   ├── employees/
    │   │   ├── vendors/
    │   │   ├── loans/
    │   │   ├── Inventory/
    │   │   └── settings/
    │   └── validators/           # Form validation functions
    └── employee/                 # Employee app code
        ├── routes.tsx
        ├── types.ts
        ├── hooks/
        ├── pages/
        ├── components/
        ├── services/
        ├── validators/
        └── constants/
```

---

## 4. Application Entry Points & Routing

### Boot Sequence

```
index.html
  └── main.tsx          → renders <App />
        └── App.tsx     → BrowserRouter + route split
              ├── /           → <AppSelector />    (mode picker)
              ├── /admin/*    → <AdminApp />        → AdminRoutes
              └── /employee/* → <EmployeeApp />     → EmployeeRoutes
```

### Admin Route Tree

```
/admin/login                      AdminLoginScreen
/admin/home                       AdminHomeScreen           [GUARD]
/admin/orders/*                   OrdersRoutes              [GUARD]
/admin/production                 ProductionStatisticsScreen[GUARD]
/admin/inventory/*                InventoryRoutes           [GUARD]
/admin/customers/*                CustomersRoutes           [GUARD]
/admin/accounts/*                 AccountsRoutes            [GUARD]
/admin/metrics                    MetricsScreen             [GUARD]
/admin/employees/*                EmployeesRoutes           [GUARD]
/admin/vendors/*                  VendorsRoutes             [GUARD]
/admin/cash/*                     CashRoutes                [GUARD]
/admin/loans/*                    LoansRoutes               [GUARD]
/admin/settings/*                 SettingsRoutes            [GUARD]
```

### Employee Route Tree

```
/employee/login                   LoginScreen
/employee/home                    HomeScreen                [GUARD]
/employee/material-entry          MaterialPurchaseEntry     [GUARD]
/employee/production-entry        ProductionEntry           [GUARD]
/employee/orders                  OrdersScreen              [GUARD]
/employee/orders/:orderId/delivery DeliveryEntry            [GUARD]
```

Each module's `routes.tsx` defines its nested screens. Every protected route is wrapped by a Guard component (see Section 5).

---

## 5. Authentication & Session Management

### Supabase Auth

- Uses **Supabase Auth** (email/phone + password)
- A `profiles` table stores the user's `role` (`ADMIN` or `EMPLOYEE`)
- The Supabase client is a **singleton** in `src/lib/supabaseClient.ts`

```typescript
// supabaseClient.ts
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);
```

### Admin Guard (`AdminGuard.tsx`)

Flow on every protected admin page load:
1. Call `validateSession()` → checks Supabase session cookie
2. Call `getUserProfile(userId)` → fetches `profiles` table row
3. If `profile.role !== 'ADMIN'` → logout + redirect to `/admin/login`
4. On any error → redirect to `/admin/login`

### Employee Guard

- Similar pattern but checks `role === 'EMPLOYEE'`
- Also calls `checkEmployeeIsActive(phone)` to ensure the employee hasn't been deactivated

### Service Functions for Auth

| Function | Description |
|----------|-------------|
| `login(email, password)` | Supabase `signInWithPassword` |
| `validateSession()` | Returns `User` or `null` |
| `getUserProfile(userId)` | Fetches from `profiles` table |
| `logout()` | Supabase `signOut` |
| `checkEmployeeIsActive(phone)` | Checks `employees.active` flag |

### Session Expiry Handling

`AdminHomeScreen` subscribes to `supabase.auth.onAuthStateChange`. If `SIGNED_OUT` fires without a manual logout action, it shows a "Session Expired" popup and redirects.

---

## 6. Module Breakdown — Admin App

Each module follows the same pattern:
- `pages/[Module]/routes.tsx` — defines sub-routes
- `pages/[Module]/pages/` — contains screen `.tsx` files
- `admin/hooks/use[Feature].ts` — data fetching and state for each screen
- `admin/validators/` — validation logic (pure functions, no UI)

---

### 6.1 Orders Module

**Routes:** `/admin/orders/*`

**Screens:**
| Screen | Path | Purpose |
|--------|------|---------|
| `OrderManagementScreen` | `/admin/orders` | Multi-tab list: Today / Undelivered / Delivered / Unpaid |
| `CreateOrderScreen` | `/admin/orders/create` | Create a new order with customer + loadmen |
| `OrderDetailsScreen` | `/admin/orders/:orderId` | View/edit order, record payments |

**Key Hooks:**
- `useOrders` — fetches paginated orders per tab
- hook in `OrderDetailsScreen` — fetches single order, updates delivery + payments

**DB Tables used:** `orders`, `customers`, `order_loadmen` (join), `employees`, `customer_payments`, `accounts`

**Service Functions:**
- `getTodayDeliveryOrdersWithPagination(page)`
- `getUndeliveredOrders(page)`
- `getDeliveredOrders(page)`
- `getUnpaidOrders(page)`
- `getOrderWithLoadmen(orderId)` — returns order + loadmen array
- `createOrder(input)` — inserts order, links loadmen, records cash entry
- `updateOrderWithLoadmen(orderId, input)` — updates order + loadmen
- `deleteOrder(orderId)`
- `createCustomerPayment(input)` — records payment, updates account balance
- `deleteCustomerPayment(paymentId)`

**Data Flow for Create Order:**
```
CreateOrderScreen
  → user fills form (customer search, bricks, price, loadmen)
  → hook calls createOrder(input)
    → middleware inserts into `orders`
    → inserts into `order_loadmen`
    → if amount_paid > 0: inserts cash_in entry
    → updates account balance
```

**Business Logic:**
- Loading type: `LOADING_UNLOADING` | `LOADING_ONLY` | `CUSTOMER_SELF`
- Loading/unloading price per brick comes from `app_settings` key `LOADING_AND_UNLOADING_PRICE_PER_BRICK`
- Payment status is derived: `NOT_PAID`, `PARTIALLY_PAID`, `FULLY_PAID`

---

### 6.2 Production Statistics Module

**Route:** `/admin/production`

**Screen:** `ProductionStatisticsScreen`

**Purpose:** View all production entries (paginated), with date-range filter. Shows bricks produced, rounds, raw material usage.

**Service Functions:**
- `getProductionEntries()` — all entries
- `getProductionEntriesByDateRange(startDate, endDate, page)`
- `getProductionEntriesFromToday(page)` — used in Employee App

**DB Table:** `production_entries`

**Columns:** `id`, `production_date`, `round`, `bricks`, `wet_ash_kg`, `marble_powder_kg`, `crusher_powder_kg`, `fly_ash_kg`, `cement_bags`, `created_at`

---

### 6.3 Inventory & Procurement Module

**Routes:** `/admin/inventory/*`

**Screens:**
| Screen | Purpose |
|--------|---------|
| `InventoryManagementScreen` | Stock levels + procurement tab |
| `RawMaterialStockScreen` | Per-material stock detail |
| `UnapprovedProcurementsScreen` | Review and approve/reject procurement requests submitted by employees |

**Workflow:**
1. Employee submits a material purchase via Employee App → creates a `procurement_requests` record (unapproved)
2. Admin sees badge count of unapproved procurements on dashboard
3. Admin reviews → approves (stock is updated) or rejects

**Service Functions:**
- `getInventoryStock(materialId?)` — current stock levels
- `getUnapprovedProcurements()` — pending requests
- `getUnapprovedProcurementCount()` — badge number
- `approveProcurement(id, input)` — approve and update stock
- `getProcurements()` — all historical procurements
- `getInventoryStockForMaterial(materialId)`
- `reduceInventoryStock(wetAshKg, marblePowderKg, crusherPowderKg, flyAshKg, cementBags, round)` — triggered on production entry; raw materials (wet ash, marble, crusher, fly ash) are multiplied by `round` before deducting from stock; cement is deducted as-is (converted from bags to KG: 1 bag = 50 kg)
- `getProcurementsByDateRange(startDate, endDate)`
- `getAdjustments()` / `createAdjustment(input)` — manual stock corrections

**DB Tables:** `materials`, `procurement_requests`, `inventory_stock`, `adjustments`

---

### 6.4 Customers Module

**Routes:** `/admin/customers/*`

**Screens:**
| Screen | Purpose |
|--------|---------|
| `CustomerManagementScreen` | Customer directory with search, financial totals |
| `CustomerDetailsScreen` | Profile, order history, payment history |

**Service Functions:**
- `getCustomersWithFinancials(page, search)` — customers + balance due
- `getCustomerSummaryTotals()` — total receivables across all customers
- `getCustomerFinancialById(customerId)` — single customer financials
- `getCustomerOrdersWithSettlement(customerId, page)` — orders + payment status
- `createCustomer(input)` / `updateCustomer(id, input)` — CRUD
- `searchCustomers(searchTerm)` — used in order creation
- `getCustomerOrdersForExport(customerId)` / `getCustomerPaymentsForExport(customerId)`
- `createCustomerPayment(input)` / `deleteCustomerPayment(paymentId)`
- `getCustomerPayments(customerId, page)`

**DB Tables:** `customers`, `orders`, `customer_payments`, `accounts`

> ⚠️ **Gotcha — totals vs. paginated lists:** `CustomerDetailsScreen`'s "Total Sales (Delivered)" and "Outstanding Amount (Delivered)" cards must be sourced from `customer.totalSales` / `customer.unpaidAmount` (from `getCustomerFinancialById`, backed by the `customer_financials` view — see [10.2 Views](#102-views)), **not** by summing the `orders` array in component state. `orders` is paginated via `getCustomerOrdersWithSettlement` (20/page, "Load More"), so summing it only reflects whatever pages have been fetched so far and under-reports until every page is loaded. This exact bug shipped once (totals appeared to "fix themselves" after clicking Load More to the end) — always use the financials-view totals for whole-customer aggregates, and only use the `orders` array for rendering the order list itself.

---

### 6.5 Accounts Module (Expenses)

**Routes:** `/admin/accounts/*`

**Screens:**
| Screen | Purpose |
|--------|---------|
| `AccountsManagementScreen` | List all expenses with type/subtype filters |
| `CreateExpenseScreen` | Add a new expense entry |
| `CreateExpenseSubtypeScreen` | Add new expense subtype under a type |
| `EditExpenseScreen` | Edit/delete an existing expense |
| `CreateExpenseTypePopup` | Quick modal to create a new expense type |

**Hierarchy:** `expense_types` → `expense_subtypes` → `expenses`

**Service Functions:**
- `getExpenseTypes()` — list all types
- `createExpenseType(name)` — create a new type
- `getExpenseSubtypes(typeId)` — subtypes under a type
- `createExpenseSubtype(typeId, name)` — create subtype
- `createExpense(payload)` — creates expense + records cash_out entry
- `getExpensesByDateRange(startDate, endDate)` — date-filtered list
- `getExpenseById(expenseId)` — single expense
- `deleteExpense(expenseId)` — delete + reverse cash_out

**DB Tables:** `expense_types`, `expense_subtypes`, `expenses`, `cash_entries` (or equivalent cash_out)

---

### 6.6 Cash Flow & Cash Ledger ⭐

**Routes:** `/admin/cash/*`

This is the most self-contained, reusable module. It has two screens:

**Screens:**
| Screen | Path | Purpose |
|--------|------|---------|
| `CashFlowScreen` | `/admin/cash` | Summary cards + daily ledger table + transfer button |
| `SwitchBalanceScreen` | `/admin/cash/transfer` | Transfer balance between accounts and log transfers |
| `CashLedgerScreen` | `/admin/cash/ledger/:date` | All transactions for a specific day |

---

#### CashFlowScreen Data Flow

```
CashFlowScreen
  └── useCashFlow()
        ├── getAccounts()           → accounts[] (cash + bank)
        ├── getFinancialSummary()   → { total_receivables, total_vendor_payables,
        │                              total_loan_outstanding, total_salary_payable }
        ├── getDailyCashSummary(page, 20)
        │     └── RPC: get_daily_cash_summary(p_page, p_page_size)
        │           → { data: [{date, cash_in, cash_out}], total_days, has_more }
        ├── getAccountTransfers(page) → account_transfers[]
        ├── createAccountTransfer(input) → decrement_account_balance + increment_account_balance + INSERT INTO account_transfers
        └── createAccount(input)    → new bank account
```

**What is shown on CashFlowScreen:**
1. **Cash balance** — balance of the hardcoded `CASH_ACCOUNT_ID`
2. **Bank account cards** — all other accounts from `accounts` table
3. **Outstanding Receivables** — total unpaid by customers
4. **Outstanding Vendor Payables** — total owed to vendors
5. **Outstanding Salary** — total unpaid salary
6. **Outstanding Loan Amount** — total outstanding loan balance
7. **Daily Ledger Table** — paginated list of dates with cash_in/cash_out totals

**Starting date for Daily Ledger:**
- Controlled by the `APP_START_DATE` key in the `app_settings` table
- The PostgreSQL RPC `get_daily_cash_summary` uses this internally to determine the oldest date to include
- Frontend reads `getAppStartDate()` / `getAppStartYear()` for other date pickers

---

#### CashLedgerScreen Data Flow

```
CashLedgerScreen (date = YYYY-MM-DD from URL param)
  └── useCashLedger(date)
        └── getCashLedgerForDate(date)
              └── RPC: get_cash_ledger_for_date(p_date)
                    → {
                        cash_in_entries: CashInEntry[],
                        cash_out_entries: CashOutEntry[],
                        cash_in_by_account: AccountAggregate[],
                        cash_out_by_account: AccountAggregate[],
                        total_cash_in: number,
                        total_cash_out: number
                      }
```

**Cash In Sources (source_type values):**
- `ORDER_PAYMENT` — customer payment
- `LOAN_DISBURSEMENT` — money received from a loan
- `WITHDRAWAL` — owner withdrawal (reversal? check RPC)

**Cash Out Sources (payment_type values):**
- `EXPENSE` — general business expense
- `VENDOR_PAYMENT` — payment to a vendor
- `SALARY_PAYMENT` — employee salary disbursement
- `LOAN_REPAYMENT` — paying back a loan

**How Cash Entries are Created:**
Cash is **never manually created** for these flows. Every financial transaction in other modules automatically creates a cash entry as a side effect:
- `createCustomerPayment()` → cash_in entry
- `createExpense()` → cash_out entry
- `createVendorPayment()` → cash_out entry
- `createSalaryLedgerEntry(FULL_SETTLEMENT / PARTIAL_SETTLEMENT)` → cash_out entry
- `createLoanWithDisbursementAndCashEntry()` → cash_in entry
- `createLoanLedgerTransaction(REPAYMENT)` → cash_out entry

**Withdrawals:**
- A separate `withdrawals` table records owner cash withdrawals
- Service: `getWithdrawals(page)`, `createWithdrawal(input)`, `getTotalWithdrawalsAmount()`

**Account Balance:**
- Every `accounts` row has a `balance` column
- Balance is updated atomically with every cash_in / cash_out via RPC or trigger in Postgres
- `CASH_ACCOUNT_ID` = `"04f194f4-af1f-4ac0-98be-a5b7f81b449f"` — hardcoded constant

---

### 6.7 Loans Module

**Routes:** `/admin/loans/*`

**Screens:**
| Screen | Purpose |
|--------|---------|
| `LoanManagementScreen` | List all loans with outstanding balances |
| `CreateLoanScreen` | Create a new loan with disbursement |
| `LoanLedgerScreen` | Transaction history for one loan |
| `AddLoanTransactionScreen` | Add repayment or interest entry |

**Loan Types:** `OWNER` | `BANK` | `SHORT_TERM`
**Loan Status:** `ACTIVE` | `CLOSED`
**Transaction Types:** `DISBURSEMENT` | `REPAYMENT` | `INTEREST`

**Service Functions:**
- `getLoans()` — all loans
- `getLoanById(loanId)`
- `createLoanWithDisbursementAndCashEntry(input)` — creates loan + disbursement ledger entry + cash_in entry atomically
- `getLoanLedger(loanId, page)` — paginated transactions for a loan
- `createLoanLedgerTransaction(input)` — repayment or interest entry + cash_out/update balance
- `getLoanDisbursementsByDateRange(startDate, endDate)` — for metrics
- `getLoanInterestByDateRange(startDate, endDate)` — for metrics

**DB Tables:** `loans`, `loan_ledger`

---

### 6.8 Employees Module

**Routes:** `/admin/employees/*`

**Screens:**
| Screen | Purpose |
|--------|---------|
| `EmployeeManagementScreen` | Active/Inactive employee list |
| `CreateEmployeeScreen` | Add new employee |
| `EditEmployeeScreen` | Edit employee details |
| `RoleSalarySetupScreen` | Active/Inactive roles list |
| `CreateRoleScreen` | Define a new role |
| `EditRoleScreen` | Modify role |
| `AttendanceScreen` | Daily attendance marking (bulk) |
| `AttendanceViewScreen` | View attendance for a month |
| `SalaryLedgerScreen` | All employees with running balance |
| `SalaryLedgerDetailScreen` | Individual employee transaction history |
| `AddPaymentScreen` | Record salary payment / advance / settlement |
| `CalculateSalaryScreen` | Generate monthly salary for fixed employees |

**Employee Categories:**
- `DAILY` — paid per day based on attendance × daily rate
- `FIXED` — fixed monthly salary, generated via `generateSalaryRPC`
- `LOADMEN` — paid per delivery based on loading type

**`no_loading_salary` Flag (on `roles` table):**
- A boolean flag (`DEFAULT false`) that can be set on any role of category `DAILY` or `FIXED`.
- When `true`, employees in that role are **excluded** from `SALARY_AUTO_ENTRY` creation on delivery submission.
- They still appear in the loadmen picker on the delivery screen and are counted in the total headcount for per-person salary division — their share is simply not credited to anyone.
- Salary for these employees comes exclusively through attendance-based calculation.
- Configurable in **Admin → Role & Salary Setup → Create/Edit Role** via the "No Loading / Unloading Wages" checkbox (hidden for `Loadmen` category).
- Displayed as an amber **"No Loading Wages"** badge in `RoleSalarySetupScreen`.
- **DB Migration:** `ALTER TABLE roles ADD COLUMN no_loading_salary boolean NOT NULL DEFAULT false;`

**Salary Ledger Entry Types:**
`ADVANCE` | `WEEKLY` | `EMERGENCY` | `DAILY` | `PARTIAL_SETTLEMENT` | `FULL_SETTLEMENT` | `SALARY_AUTO_ENTRY` | `DEDUCTION` | `AUTO`

**Service Functions:**
- `getActiveEmployees(page)` / `getInactiveEmployees(page)`
- `createEmployee(input)` / `updateEmployee(id, input)` / `updateEmployeeStatus(id, active)`
- `getEmployeeById(id)` — full detail with role
- `getRoles()` / `getActiveRoles(page)` / `getInactiveRoles(page)`
- `createRole(input)` / `updateRole(id, input)` / `updateRoleStatus(id, active)`
- `getEmployeesForAttendance()` — list for daily attendance
- `getAttendanceForDate(date)` / `getAttendanceForMonth(employeeId, month)`
- `saveAttendance(records[])` — batch upsert attendance
- `searchEmployees(query, page)` — for salary ledger search
- `getEmployeeLedger(employeeId, page)` — paginated transaction history
- `createSalaryLedgerEntry(input)` — creates ledger entry + cash_out if payment
- `checkSalaryAlreadyGenerated(month)` — prevents duplicate salary generation
- `getSalaryEmployees(month)` — attendance-based data for salary calc
- `generateSalaryRPC(month, employees[])` — bulk salary generation RPC
- `getSalaryAutoEntriesByDateRange(startDate, endDate)` — for metrics

**DB Tables:** `employees`, `roles`, `attendance`, `salary_ledger`, `salary_batches`

---

### 6.9 Vendors Module

**Routes:** `/admin/vendors/*`

**Screens:**
| Screen | Purpose |
|--------|---------|
| `VendorManagementScreen` | Vendor directory with search |
| `CreateVendorScreen` | Add new vendor with material links |
| `EditVendorScreen` | Edit vendor + material associations |
| `VendorLedgerScreen` | Transaction history: procurements + payments |
| `VendorPaymentScreen` | Record a payment to a vendor |
| `VendorLedgerExport` | PDF/CSV export of ledger |

**Service Functions:**
- `searchVendors(query, page)` / `getVendorByIdWithMaterials(id)`
- `createVendorWithMaterials(input)` / `updateVendorWithMaterials(id, input)`
- `getVendorFinancials(vendorId)` — total procurement vs. paid amount
- `getVendorProcurements(vendorId, page)` / `getVendorPayments(vendorId, page)`
- `createVendorPayment(input)` — records payment + cash_out entry
- `deleteVendorPayment(paymentId)`
- `getVendorProcurementsForExport(vendorId)` / `getVendorPaymentsForExport(vendorId)`

**DB Tables:** `vendors`, `vendor_materials` (join), `materials`, `procurement_requests`, `vendor_payments`

---

### 6.10 Metrics Module

**Route:** `/admin/metrics`

**Screen:** `MetricsScreen`

Single screen with charts. Uses `recharts` to display:
- Revenue vs. Expenses by date range
- Order counts
- Production trends
- Loan disbursements and interest

Reads from multiple date-range service functions with year/month filters driven by `getAppStartYear()`.

---

### 6.11 Settings Module

**Route:** `/admin/settings`

**Screen:** `SettingsManagementScreen`

- Reads all rows from `app_settings` table
- Admin can edit any setting value in-place
- Validated before save
- Currently managed settings:
  - `APP_START_DATE` — the date the app went live (`YYYY-MM-DD`)
  - `LOADING_AND_UNLOADING_PRICE_PER_BRICK` — decimal rate (e.g., `0.334`)

---

## 7. Employee App Modules

**All routes:** `/employee/*`

**Screens:**
| Screen | Purpose |
|--------|---------|
| `LoginScreen` | Phone + password login |
| `HomeScreen` | Four action buttons |
| `MaterialPurchaseEntry` | Submit a material purchase request |
| `ProductionEntry` | Log daily production |
| `OrdersScreen` | View today's delivery orders |
| `DeliveryEntry` | Mark an order as delivered + assign loadmen |

**Hooks:** `useMaterialPurchase`, `useProduction`, `useOrders`, `useDelivery`, `useLoadMen`

**Key difference from Admin:** Employee App has its own `services/` folder with simplified wrappers. However most calls still go through the same Supabase tables.

**DB interaction:**
- `createProcurement(input)` → creates `procurement_requests` (unapproved)
- `createProductionEntry(input)` → creates `production_entries` + deducts `inventory_stock`
- `getTodayDeliveryOrders()` → reads `orders`
- `updateOrderWithLoadmen(orderId, input)` → marks delivered + assigns loadmen

---

## 8. Architecture Pattern — Hook-Based Data Flow

Every screen follows this exact pattern:

```
Screen Component (.tsx)
  │
  ├── imports hook: useXxx()
  │     ├── useState — local state (data, loading, errors, modals)
  │     ├── useEffect — fires fetch on mount
  │     ├── useCallback — stable fetch functions
  │     └── calls middleware.service functions
  │
  ├── Renders UI using state values from hook
  ├── Calls hook action functions on user interaction
  └── Shows <Popup /> for success/error feedback
```

**No global state manager (no Redux/Zustand/Context).** Each screen is fully self-contained. Data is re-fetched on mount. Pagination uses a `page` number + `hasMore` boolean.

**Pagination pattern:**
```typescript
const PAGE_SIZE = 20;
// page 0 → rows 0-19
// page 1 → rows 20-39
// "Load More" button increments page and appends to array
```

---

## 9. Service Layer — middleware.service.ts

**Single file** at `src/services/middleware.service.ts` (~3874 lines). Contains **every** Supabase interaction.

### Grouped Function Reference

#### App Settings
| Function | DB Operation |
|----------|-------------|
| `getAppSettings()` | SELECT * FROM app_settings |
| `updateAppSetting(key, value)` | UPDATE app_settings WHERE key = ? |
| `getAppStartYear()` | SELECT value FROM app_settings WHERE key = 'APP_START_DATE' |
| `getAppStartDate()` | SELECT value FROM app_settings WHERE key = 'APP_START_DATE' |

#### Authentication
| Function | DB Operation |
|----------|-------------|
| `login(email, password)` | supabase.auth.signInWithPassword |
| `validateSession()` | supabase.auth.getUser |
| `getUserProfile(userId)` | SELECT * FROM profiles WHERE id = ? |
| `logout()` | supabase.auth.signOut |
| `checkEmployeeIsActive(phone)` | SELECT active FROM employees WHERE phone = ? |

#### Accounts & Cash
| Function | DB Operation |
|----------|-------------|
| `getAccounts()` | SELECT * FROM accounts |
| `createAccount(input)` | INSERT INTO accounts |
| `getCashAccount()` | SELECT * FROM accounts WHERE id = CASH_ACCOUNT_ID |
| `getAccountsForPayments()` | SELECT id, account_number FROM accounts |
| `getFinancialSummary()` | RPC: get_financial_summary |
| `getDailyCashSummary(page, pageSize)` | RPC: get_daily_cash_summary |
| `getCashLedgerForDate(date)` | RPC: get_cash_ledger_for_date |
| `getWithdrawals(page)` | SELECT * FROM withdrawals |
| `createWithdrawal(input)` | INSERT INTO withdrawals |
| `getAccountTransfers(page)` | SELECT * FROM account_transfers |
| `createAccountTransfer(input)` | decrement_account_balance + increment_account_balance + INSERT INTO account_transfers |
| `getTotalWithdrawalsAmount()` | SELECT SUM(amount) FROM withdrawals |

#### Orders
| Function | DB Operation |
|----------|-------------|
| `createOrder(input)` | Multi-step: INSERT orders + order_loadmen + cash_entry |
| `getTodayDeliveryOrdersWithPagination(page)` | SELECT orders WHERE delivery_date = today |
| `getUndeliveredOrders(page)` | SELECT orders WHERE delivered = false |
| `getDeliveredOrders(page)` | SELECT orders WHERE delivered = true |
| `getUnpaidOrders(page)` | SELECT orders WHERE payment_status != FULLY_PAID |
| `getOrderWithLoadmen(orderId)` | SELECT order + JOIN order_loadmen + employees |
| `updateOrderWithLoadmen(orderId, input)` | UPDATE order + delete/re-insert loadmen |
| `deleteOrder(orderId)` | DELETE orders WHERE id = ? |
| `getOrdersByDateRange(startDate, endDate)` | SELECT orders WHERE delivery_date BETWEEN |

#### Customers
| Function | DB Operation |
|----------|-------------|
| `getCustomersWithFinancials(page, search)` | RPC or JOIN: customers + payment summary |
| `getCustomerSummaryTotals()` | Aggregation query |
| `getCustomerFinancialById(customerId)` | Customer + orders + payments aggregate |
| `createCustomer(input)` | INSERT INTO customers |
| `updateCustomer(id, input)` | UPDATE customers |
| `searchCustomers(searchTerm)` | SELECT WHERE name ILIKE or phone ILIKE |
| `getCustomerOrdersWithSettlement(customerId, page)` | Orders + payment per order |
| `createCustomerPayment(input)` | INSERT customer_payments + UPDATE account balance |
| `deleteCustomerPayment(paymentId)` | DELETE + reverse account balance |
| `getCustomerPayments(customerId, page)` | SELECT customer_payments paginated |

#### Loans
| Function | DB Operation |
|----------|-------------|
| `getLoans()` | SELECT * FROM loans |
| `getLoanById(loanId)` | SELECT loan by id |
| `createLoanWithDisbursementAndCashEntry(input)` | INSERT loan + loan_ledger + cash_in entry |
| `getLoanLedger(loanId, page)` | SELECT loan_ledger WHERE loan_id = ? |
| `createLoanLedgerTransaction(input)` | INSERT loan_ledger + update loan.outstanding_balance |
| `getLoanDisbursementsByDateRange(startDate, endDate)` | SELECT DISBURSEMENT entries |
| `getLoanInterestByDateRange(startDate, endDate)` | SELECT INTEREST entries |

#### Employees
| Function | DB Operation |
|----------|-------------|
| `getActiveEmployees(page)` | SELECT employees WHERE active = true |
| `getInactiveEmployees(page)` | SELECT employees WHERE active = false |
| `createEmployee(input)` | INSERT INTO employees |
| `updateEmployee(id, input)` | UPDATE employees |
| `getEmployeeById(id)` | SELECT employee + role JOIN |
| `updateEmployeeStatus(id, active)` | UPDATE employees.active |
| `getEmployeesForAttendance()` | SELECT employees + roles WHERE active = true |
| `getAttendanceForDate(date)` | SELECT attendance WHERE date = ? |
| `getAttendanceForMonth(employeeId, month)` | SELECT attendance WHERE employee + month |
| `saveAttendance(records[])` | UPSERT attendance[] |
| `searchEmployees(query, page)` | SELECT employees WHERE name/phone ILIKE |
| `getEmployeeLedger(employeeId, page)` | RPC: get_employee_ledger |
| `createSalaryLedgerEntry(input)` | INSERT salary_ledger + cash_out if payment |
| `checkSalaryAlreadyGenerated(month)` | SELECT salary_batches WHERE month = ? |
| `getSalaryEmployees(month)` | RPC: get_fixed_salary_employees_for_month |
| `generateSalaryRPC(month, employees[])` | RPC: generate_salary |
| `getSalaryAutoEntriesByDateRange(startDate, endDate)` | SELECT salary_ledger WHERE type = AUTO |

#### Roles
| Function | DB Operation |
|----------|-------------|
| `getRoles()` | SELECT id, name, category, no_loading_salary FROM roles WHERE active |
| `getActiveRoles(page)` | SELECT roles + no_loading_salary WHERE active = true (paginated) |
| `getInactiveRoles(page)` | SELECT roles + no_loading_salary WHERE active = false (paginated) |
| `createRole(input)` | INSERT INTO roles (includes no_loading_salary) |
| `updateRole(id, input)` | UPDATE roles (includes no_loading_salary) |
| `getRoleById(id)` | SELECT role by id (includes no_loading_salary) |
| `updateRoleStatus(id, active)` | UPDATE roles.active |

> **Note:** `getAllEmployees()` also selects `no_loading_salary` via the `roles!inner(...)` join so the delivery hook can filter eligible loadmen.

#### Vendors
| Function | DB Operation |
|----------|-------------|
| `searchVendors(query, page)` | SELECT vendors WHERE name ILIKE |
| `getVendorByIdWithMaterials(id)` | SELECT vendor + vendor_materials + materials |
| `createVendorWithMaterials(input)` | INSERT vendor + vendor_materials |
| `updateVendorWithMaterials(id, input)` | UPDATE vendor + delete/re-insert vendor_materials |
| `getVendorFinancials(vendorId)` | Aggregate: total procured vs. total paid |
| `getVendorProcurements(vendorId, page)` | SELECT procurement_requests WHERE vendor_id |
| `getVendorPayments(vendorId, page)` | SELECT vendor_payments WHERE vendor_id |
| `createVendorPayment(input)` | INSERT vendor_payments + cash_out entry |
| `deleteVendorPayment(paymentId)` | DELETE + reverse cash |

#### Expenses
| Function | DB Operation |
|----------|-------------|
| `getExpenseTypes()` | SELECT * FROM expense_types |
| `createExpenseType(name)` | INSERT INTO expense_types |
| `getExpenseSubtypes(typeId)` | SELECT subtypes WHERE type_id = ? |
| `createExpenseSubtype(typeId, name)` | INSERT INTO expense_subtypes |
| `createExpense(payload)` | INSERT expense + cash_out entry |
| `getExpensesByDateRange(startDate, endDate)` | SELECT expenses WHERE date BETWEEN |
| `getExpenseById(expenseId)` | SELECT expense + type + subtype |
| `deleteExpense(expenseId)` | DELETE + reverse cash_out |
| `getPaperExpensesByDateRange(startDate, endDate)` | SELECT paper-type expenses |

#### Inventory & Production
| Function | DB Operation |
|----------|-------------|
| `getInventoryStock(materialId?)` | SELECT inventory_stock |
| `getInventoryStockForMaterial(materialId)` | SELECT single material stock |
| `getProcurements()` | SELECT all procurement_requests |
| `getProcurementsByDateRange(startDate, endDate)` | Filtered procurements |
| `getUnapprovedProcurements()` | SELECT procurement_requests WHERE approved = false |
| `getUnapprovedProcurementCount()` | COUNT unapproved |
| `approveProcurement(id, input)` | UPDATE approved + UPDATE inventory_stock |
| `getProductionEntries()` | SELECT * FROM production_entries |
| `getProductionEntriesByDateRange(startDate, endDate, page)` | Filtered |
| `createProductionEntry(input)` | INSERT production_entries + deduct inventory_stock (raw materials × round) |
| `getProductInventory()` | SELECT finished goods inventory |
| `updateProductInventory(quantity)` | UPDATE finished goods (add) |
| `deductProductInventory(quantity)` | UPDATE finished goods (subtract) |
| `reduceInventoryStock(wetAshKg, marblePowderKg, crusherPowderKg, flyAshKg, cementBags, round)` | UPDATE inventory_stock — raw materials multiplied by `round`; cement converted bags→KG (×50) |
| `getAdjustments()` | SELECT * FROM adjustments |
| `createAdjustment(input)` | INSERT adjustments + UPDATE inventory_stock |

---

## 10. Database Tables (Supabase)

> **Note:** Fetch the exact SQL schemas from your Supabase dashboard → Table Editor → each table → SQL definition. The table names and key columns are listed below. 

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User roles | `id (FK auth.users)`, `phone`, `role (ADMIN\|EMPLOYEE)` |
| `app_settings` | App configuration | `key`, `value`, `description` |

### Financial / Cash Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `accounts` | Bank accounts + cash account | `id`, `account_number`, `opening_balance`, `balance` |
| `cash_entries` *(or similar)* | Double-entry cash log | `source_type`, `payment_type`, `amount`, `account_id`, `date` |
| `withdrawals` | Owner withdrawals | `id`, `date`, `amount`, `account_id`, `notes` |

### Business Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `customers` | Customer directory | `id`, `name`, `phone`, `address`, `gst_number` |
| `orders` | Sales orders | `id`, `customer_id`, `order_date`, `delivery_date`, `brick_quantity`, `price_per_brick`, `final_price`, `payment_status`, `delivered`, `loading_type`, `amount_paid` |
| `order_loadmen` | Order ↔ Employee (many-to-many) | `order_id`, `employee_id` |
| `customer_payments` | Customer payment records | `id`, `customer_id`, `payment_date`, `amount`, `mode`, `receiver_account_id` |

### Inventory / Production Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `materials` | Raw material catalog | `id`, `name`, `unit` |
| `procurement_requests` | Material purchase requests | `id`, `material_id`, `vendor_id`, `quantity`, `rate_per_unit`, `total_price`, `date`, `approved` |
| `inventory_stock` | Current stock per material | `material_id`, `quantity` |
| `production_entries` | Daily production log | `id`, `production_date`, `round`, `bricks`, `wet_ash_kg`, `fly_ash_kg`, `cement_bags`, etc. |
| `adjustments` | Manual stock corrections | `id`, `material_id`, `quantity_delta`, `reason`, `date` |
| `product_inventory` | Finished goods stock | (single row or material-based) |

### Employee Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `employees` | Employee directory | `id`, `name`, `phone`, `role_id`, `aadhar`, `blood_group`, `active`, `deduction_amount` |
| `roles` | Salary roles | `id`, `name`, `category (DAILY\|FIXED\|LOADMEN)`, `salary_value`, `minimum_requirement`, `active` |
| `attendance` | Daily attendance | `employee_id`, `date`, `status (PRESENT\|ABSENT\|HALF_DAY\|LEAVE)` |
| `salary_ledger` | Employee payment ledger | `id`, `employee_id`, `entry_type`, `amount`, `running_balance`, `payment_mode`, `notes`, `payment_at` |
| `salary_batches` | Monthly salary generation records | `id`, `month`, `generated_at` |

### Vendor Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `vendors` | Vendor directory | `id`, `name`, `phone`, `address`, `gst_number`, `notes` |
| `vendor_materials` | Vendor ↔ Material (many-to-many) | `vendor_id`, `material_id` |
| `vendor_payments` | Vendor payment records | `id`, `vendor_id`, `amount`, `payment_date`, `mode`, `account_id` |

### Loan Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `loans` | Loan master records | `id`, `lender_name`, `loan_type`, `principal_amount`, `interest_rate`, `outstanding_balance`, `status`, `start_date` |
| `loan_ledger` | Loan transactions | `id`, `loan_id`, `transaction_type`, `amount`, `running_balance`, `payment_mode`, `transaction_date` |

### Expense Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `expense_types` | Expense categories | `id`, `name` |
| `expense_subtypes` | Sub-categories | `id`, `type_id`, `name` |
| `expenses` | Expense entries | `id`, `type_id`, `subtype_id`, `amount`, `date`, `account_id`, `notes` |

## 10.1 Table Schema

## Accounts
create table public.accounts (
  id uuid not null default gen_random_uuid (),
  account_number text not null,
  opening_balance numeric null default 0,
  created_at timestamp with time zone null default now(),
  balance numeric not null default 0,
  constraint accounts_pkey primary key (id)
) TABLESPACE pg_default;

## App Settings 
create table public.app_settings (
  id uuid not null default gen_random_uuid (),
  key character varying(255) not null,
  value text not null,
  description text null,
  updated_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  constraint app_settings_pkey primary key (id),
  constraint app_settings_key_key unique (key)
) TABLESPACE pg_default;

create index IF not exists idx_app_settings_key on public.app_settings using btree (key) TABLESPACE pg_default;

create trigger trigger_app_settings_updated_at BEFORE
update on app_settings for EACH row
execute FUNCTION update_app_settings_updated_at ();

## Accounts
create table public.attendance (
  employee_id uuid not null,
  date date not null,
  status public.attendance_status not null,
  constraint attendance_pkey primary key (employee_id, date),
  constraint attendance_employee_id_fkey foreign KEY (employee_id) references employees (id)
) TABLESPACE pg_default;

create index IF not exists idx_attendance_employee_date on public.attendance using btree (employee_id, date) TABLESPACE pg_default;

## Cash Ledger Days
create table public.cash_ledger_days (
  id uuid not null default gen_random_uuid (),
  ledger_date date not null,
  status public.cash_day_status null default 'OPEN'::cash_day_status,
  opening_balance numeric not null,
  closing_balance numeric null,
  created_at timestamp with time zone null default now(),
  constraint cash_ledger_days_pkey primary key (id),
  constraint cash_ledger_days_ledger_date_key unique (ledger_date)
) TABLESPACE pg_default;

## Cash Ledger Entries
create table public.cash_ledger_entries (
  id uuid not null default gen_random_uuid (),
  ledger_day_id uuid null,
  direction public.cash_direction not null,
  source_type public.cash_in_source null,
  payment_type public.cash_out_type null,
  account_id uuid null,
  amount numeric not null,
  reason text null,
  created_at timestamp with time zone null default now(),
  constraint cash_ledger_entries_pkey primary key (id),
  constraint cash_ledger_entries_account_id_fkey foreign KEY (account_id) references accounts (id),
  constraint cash_ledger_entries_ledger_day_id_fkey foreign KEY (ledger_day_id) references cash_ledger_days (id)
) TABLESPACE pg_default;

## Customer Payments
create table public.customer_payments (
  id uuid not null default gen_random_uuid (),
  customer_id uuid null,
  order_id uuid null,
  payment_date date not null,
  amount numeric not null,
  mode public.payment_mode not null,
  created_at timestamp with time zone null default now(),
  receiver_account_id uuid null,
  sender_account_no text null,
  constraint customer_payments_pkey primary key (id),
  constraint customer_payments_customer_id_fkey foreign KEY (customer_id) references customers (id),
  constraint customer_payments_order_id_fkey foreign KEY (order_id) references orders (id),
  constraint customer_payments_receiver_account_id_fkey foreign KEY (receiver_account_id) references accounts (id)
) TABLESPACE pg_default;

## Customer
create table public.customers (
  id uuid not null default gen_random_uuid (),
  name text not null,
  phone character varying(10) not null,
  gst_number character varying(15) null,
  address text null,
  created_at timestamp with time zone null default now(),
  constraint customers_pkey primary key (id),
  constraint customers_phone_key unique (phone)
) TABLESPACE pg_default;

## Employee
create table public.employees (
  id uuid not null default gen_random_uuid (),
  name text not null,
  phone character varying(10) not null,
  alternate_phone character varying(10) null,
  blood_group text null,
  aadhar character varying(12) null,
  permanent_address text null,
  local_address text null,
  role_id uuid null,
  emergency_contact_name text null,
  emergency_contact_phone character varying(10) null,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  deduction_amount numeric null,
  constraint employees_pkey primary key (id),
  constraint employees_phone_key unique (phone),
  constraint employees_role_id_fkey foreign KEY (role_id) references roles (id)
) TABLESPACE pg_default;

create index IF not exists idx_employee_name on public.employees using btree (name) TABLESPACE pg_default;

## Expense Subtypes
create table public.expense_subtypes (
  id uuid not null default gen_random_uuid (),
  type_id uuid null,
  name text not null,
  constraint expense_subtypes_pkey primary key (id),
  constraint expense_subtypes_type_id_name_key unique (type_id, name),
  constraint expense_subtypes_type_id_fkey foreign KEY (type_id) references expense_types (id)
) TABLESPACE pg_default;

## Expense Type
create table public.expense_types (
  id uuid not null default gen_random_uuid (),
  name text not null,
  constraint expense_types_pkey primary key (id),
  constraint expense_types_name_key unique (name)
) TABLESPACE pg_default;

## Expense
create table public.expenses (
  id uuid not null default gen_random_uuid (),
  expense_date date not null,
  type_id uuid null,
  subtype_id uuid null,
  amount numeric not null,
  payment_mode public.payment_mode not null,
  sender_account_id uuid null,
  comments text null,
  created_at timestamp with time zone null default now(),
  constraint expenses_pkey primary key (id),
  constraint expenses_sender_account_id_fkey foreign KEY (sender_account_id) references accounts (id),
  constraint expenses_subtype_id_fkey foreign KEY (subtype_id) references expense_subtypes (id),
  constraint expenses_type_id_fkey foreign KEY (type_id) references expense_types (id)
) TABLESPACE pg_default;

## Inventory Adjustment
create table public.inventory_adjustments (
  id uuid not null default gen_random_uuid (),
  adjustment_date date not null,
  actual_bricks integer null,
  actual_wet_ash_kg numeric null,
  actual_marble_powder_kg numeric null,
  actual_crusher_powder_kg numeric null,
  actual_fly_ash_kg numeric null,
  actual_cement_bags numeric null,
  adjusted_bricks integer null,
  adjusted_wet_ash_kg numeric null,
  adjusted_marble_powder_kg numeric null,
  adjusted_crusher_powder_kg numeric null,
  adjusted_fly_ash_kg numeric null,
  adjusted_cement_bags numeric null,
  reason text null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint inventory_adjustments_pkey primary key (id),
  constraint inventory_adjustments_created_by_fkey foreign KEY (created_by) references profiles (id)
) TABLESPACE pg_default;

## Inventory Stock
create table public.inventory_stock (
  material_id uuid not null,
  quantity numeric not null,
  updated_at timestamp with time zone null default now(),
  constraint inventory_stock_pkey primary key (material_id),
  constraint inventory_stock_material_id_fkey foreign KEY (material_id) references materials (id)
) TABLESPACE pg_default;

## Loan Ledger
create table public.loan_ledger (
  id uuid not null default gen_random_uuid (),
  loan_id uuid null,
  transaction_type public.loan_transaction_type not null,
  amount numeric not null,
  running_balance numeric not null,
  payment_mode public.payment_mode not null,
  sender_account_id uuid null,
  receiver_account_info text null,
  transaction_date date not null,
  notes text null,
  created_at timestamp with time zone null default now(),
  constraint loan_ledger_pkey primary key (id),
  constraint loan_ledger_loan_id_fkey foreign KEY (loan_id) references loans (id),
  constraint loan_ledger_sender_account_id_fkey foreign KEY (sender_account_id) references accounts (id)
) TABLESPACE pg_default;

## Loan
create table public.loans (
  id uuid not null default gen_random_uuid (),
  lender_name text not null,
  loan_type public.loan_type not null,
  principal_amount numeric not null,
  interest_rate numeric null,
  outstanding_balance numeric not null,
  disbursement_account_id uuid null,
  start_date date not null,
  status public.loan_status null default 'ACTIVE'::loan_status,
  notes text null,
  created_at timestamp with time zone null default now(),
  constraint loans_pkey primary key (id),
  constraint loans_disbursement_account_id_fkey foreign KEY (disbursement_account_id) references accounts (id)
) TABLESPACE pg_default;

## Materials
create table public.materials (
  id uuid not null default gen_random_uuid (),
  name text not null,
  unit text not null,
  constraint materials_pkey primary key (id)
) TABLESPACE pg_default;

## Order Loadmen
create table public.order_loadmen (
  order_id uuid not null,
  employee_id uuid not null,
  constraint order_loadmen_pkey primary key (order_id, employee_id),
  constraint order_loadmen_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE,
  constraint order_loadmen_order_id_fkey foreign KEY (order_id) references orders (id) on delete CASCADE
) TABLESPACE pg_default;

## Orders
create table public.orders (
  id uuid not null default gen_random_uuid (),
  customer_id uuid null,
  order_date date not null,
  delivery_date date not null,
  brick_quantity integer not null,
  price_per_brick numeric null,
  paper_price numeric null,
  final_price numeric not null,
  location text null,
  payment_status public.payment_status null default 'NOT_PAID'::payment_status,
  amount_paid numeric null default 0,
  gst_number character varying(15) null,
  dc_number text null,
  delivered boolean null default false,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  time text null,
  loading_type text null,
  constraint orders_pkey primary key (id),
  constraint orders_created_by_fkey foreign KEY (created_by) references profiles (id),
  constraint orders_customer_id_fkey foreign KEY (customer_id) references customers (id),
  constraint orders_loading_type_check check (
    (
      loading_type = any (
        array[
          'LOADING_ONLY'::text,
          'LOADING_UNLOADING'::text,
          'CUSTOMER_SELF'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

## Procurements
create table public.procurements (
  id uuid not null default gen_random_uuid (),
  material_id uuid null,
  vendor_id uuid null,
  quantity numeric not null,
  rate_per_unit numeric not null,
  total_price numeric not null,
  date date not null,
  approved boolean null default false,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  payment_status text null default 'NOT_PAID'::text,
  total_paid numeric null default 0,
  constraint procurements_pkey primary key (id),
  constraint procurements_created_by_fkey foreign KEY (created_by) references profiles (id),
  constraint procurements_material_id_fkey foreign KEY (material_id) references materials (id),
  constraint procurements_vendor_id_fkey foreign KEY (vendor_id) references vendors (id)
) TABLESPACE pg_default;

## Product Inventory
create table public.product_inventory (
  id uuid not null default gen_random_uuid (),
  product_type text not null default 'BRICKS'::text,
  quantity integer not null default 0,
  updated_at timestamp with time zone null default now(),
  constraint product_inventory_pkey primary key (id)
) TABLESPACE pg_default;

## Production Entries
create table public.production_entries (
  id uuid not null default gen_random_uuid (),
  production_date date not null,
  bricks integer not null,
  round integer not null,
  wet_ash_kg numeric null,
  marble_powder_kg numeric null,
  crusher_powder_kg numeric null,
  fly_ash_kg numeric null,
  cement_bags numeric null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint production_entries_pkey primary key (id),
  constraint production_entries_created_by_fkey foreign KEY (created_by) references profiles (id)
) TABLESPACE pg_default;

## Profiles
create table public.profiles (
  id uuid not null,
  phone character varying(10) not null,
  role text not null,
  created_at timestamp with time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_phone_key unique (phone),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint profiles_role_check check (
    (
      role = any (array['ADMIN'::text, 'EMPLOYEE'::text])
    )
  )
) TABLESPACE pg_default;

## Roles
create table public.roles (
  id uuid not null default gen_random_uuid (),
  name text not null,
  category public.employee_category not null,
  salary_value numeric not null,
  active boolean null default true,
  minimum_requirement text null,
  constraint roles_pkey primary key (id)
) TABLESPACE pg_default;

## Salary Batch Iteams
create table public.salary_batch_items (
  id uuid not null default gen_random_uuid (),
  batch_id uuid null,
  employee_id uuid null,
  present_days integer null default 0,
  absent_days integer null default 0,
  leave_days integer null default 0,
  half_days integer null default 0,
  base_salary numeric not null,
  final_salary numeric not null,
  created_at timestamp with time zone null default now(),
  constraint salary_batch_items_pkey primary key (id),
  constraint salary_batch_items_batch_id_employee_id_key unique (batch_id, employee_id),
  constraint salary_batch_items_batch_id_fkey foreign KEY (batch_id) references salary_batches (id) on delete CASCADE,
  constraint salary_batch_items_employee_id_fkey foreign KEY (employee_id) references employees (id)
) TABLESPACE pg_default;

## Salary Batches
create table public.salary_batches (
  id uuid not null default gen_random_uuid (),
  month date not null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  status text null default 'DRAFT'::text,
  constraint salary_batches_pkey primary key (id),
  constraint salary_batches_month_key unique (month),
  constraint salary_batches_status_check check (
    (
      status = any (array['DRAFT'::text, 'GENERATED'::text])
    )
  )
) TABLESPACE pg_default;

## Salary Ledger
create table public.salary_ledger (
  id uuid not null default gen_random_uuid (),
  employee_id uuid null,
  entry_type public.salary_entry_type not null,
  amount numeric not null,
  running_balance numeric not null,
  payment_mode public.payment_mode null,
  sender_account_id uuid null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  receiver_account text null,
  salary_batch_id uuid null,
  payment_at timestamp with time zone null default now(),
  constraint salary_ledger_pkey primary key (id),
  constraint salary_ledger_employee_id_fkey foreign KEY (employee_id) references employees (id),
  constraint salary_ledger_sender_account_id_fkey foreign KEY (sender_account_id) references accounts (id)
) TABLESPACE pg_default;

create index IF not exists idx_salary_ledger_employee_payment_at on public.salary_ledger using btree (employee_id, payment_at desc) TABLESPACE pg_default;

create index IF not exists idx_salary_ledger_employee_created on public.salary_ledger using btree (employee_id, created_at desc) TABLESPACE pg_default;

## Vendor Materials 
create table public.vendor_materials (
  vendor_id uuid not null,
  material_id uuid not null,
  constraint vendor_materials_pkey primary key (vendor_id, material_id),
  constraint vendor_materials_material_id_fkey foreign KEY (material_id) references materials (id),
  constraint vendor_materials_vendor_id_fkey foreign KEY (vendor_id) references vendors (id)
) TABLESPACE pg_default;

## Vendor Payments
create table public.vendor_payments (
  id uuid not null default gen_random_uuid (),
  vendor_id uuid not null,
  payment_date date not null,
  amount numeric not null,
  mode text not null,
  sender_account_id uuid null,
  receiver_account_info text null,
  created_at timestamp with time zone null default now(),
  constraint vendor_payments_pkey primary key (id),
  constraint vendor_payments_sender_account_id_fkey foreign KEY (sender_account_id) references accounts (id),
  constraint vendor_payments_vendor_id_fkey foreign KEY (vendor_id) references vendors (id),
  constraint vendor_payments_mode_check check (
    (
      mode = any (
        array[
          'CASH'::text,
          'UPI'::text,
          'BANK'::text,
          'CHEQUE'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

## Vendors
create table public.vendors (
  id uuid not null default gen_random_uuid (),
  name text not null,
  phone character varying(10) null,
  alternate_phone character varying(10) null,
  gst_number character varying(15) null,
  address text null,
  notes text null,
  created_at timestamp with time zone null default now(),
  constraint vendors_pkey primary key (id)
) TABLESPACE pg_default;

## Withdrawals
create table public.withdrawals (
  id bigint generated by default as identity not null,
  date date null,
  amount numeric null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  account_id uuid not null,
  constraint withdrawals_pkey primary key (id),
  constraint withdrawals_account_id_fkey foreign KEY (account_id) references accounts (id)
) TABLESPACE pg_default;

## 10.2 Views

## Total Withdrawals View
create or replace view total_withdrawals_view as
select coalesce(sum(amount), 0) as total_withdrawals
from withdrawals;

## Order Running Totals
create view order_running_totals as
select
  o.id as order_id,
  o.customer_id,
  o.order_date,
  o.created_at,
  o.final_price,
  sum(o.final_price) over (
    partition by o.customer_id
    order by o.order_date, o.created_at
    rows between unbounded preceding and current row
  ) as cumulative_order_total
from orders o;

## Payment Running Totals
create view payment_running_totals as
select
  p.customer_id,
  sum(p.amount) as total_paid
from customer_payments p
group by p.customer_id;

## Customer Financials

> `total_sales` / `outstanding_amount` here are aggregated server-side over **all** delivered orders for the customer — this is the correct source for any "whole customer" total (used correctly by `CustomerManagementScreen`'s Unpaid Amount, and by `CustomerDetailsScreen` via `getCustomerFinancialById`). Do not recompute these totals client-side by summing a paginated orders list (see [6.4 Customers Module](#64-customers-module) gotcha).

create or replace view customer_financials as
select
  c.id as customer_id,
  c.name,
  c.phone,
  c.address,

  coalesce(o.total_sales, 0) as total_sales,

  -- 🔥 total_paid now from orders (SINGLE SOURCE OF TRUTH)
  coalesce(o.total_paid_from_orders, 0) as total_paid,

  coalesce(o.total_sales, 0) 
  - coalesce(o.total_paid_from_orders, 0) 
  as outstanding_amount

from customers c

left join (
  select
    customer_id,
    sum(final_price) as total_sales,
    sum(coalesce(amount_paid, 0)) as total_paid_from_orders
  from orders
  WHERE delivered = true 
  group by customer_id
) o on o.customer_id = c.id;

## Customer Order Settlements
create or replace view customer_order_settlement as
select
  o.id as order_id,
  o.customer_id,
  o.order_date,
  o.delivery_date,
  o.brick_quantity,
  o.final_price,
  o.gst_number,
  o.dc_number,


  coalesce(o.amount_paid, 0) as total_paid,
  (o.final_price - coalesce(o.amount_paid, 0)) as remaining_balance,

  case
    when coalesce(o.amount_paid, 0) = 0 then 'NOT_PAID'
    when coalesce(o.amount_paid, 0) >= o.final_price then 'FULLY_PAID'
    else 'PARTIALLY_PAID'
  end as payment_status,
  o.delivered
from orders o;


## Vendor Procurement Settlement
create or replace view vendor_procurement_settlement as
select
  p.id as procurement_id,
  p.vendor_id,
  p.date,
  p.total_price,
  p.total_paid,
  (p.total_price - coalesce(p.total_paid,0)) as remaining_balance,
  p.payment_status
from procurements p;

## Vendor Financials
create or replace view vendor_financials as
select
  v.id as vendor_id,
  v.name,
  coalesce(sum(p.total_price),0) as total_purchase,
  coalesce(sum(p.total_paid),0) as total_paid,
  coalesce(sum(p.total_price),0) - coalesce(sum(p.total_paid),0) as outstanding_balance
from vendors v
left join procurements p on p.vendor_id = v.id and p.approved = true
group by v.id, v.name;

## Employee With Balance
create or replace view employee_with_balance as
select
  e.id,
  e.name,
  e.phone,
  r.name as role_name,
  r.category,
  coalesce(sl.running_balance, 0) as running_balance,
  e.active
from employees e
left join roles r
  on r.id = e.role_id
left join lateral (
  select running_balance
  from salary_ledger
  where employee_id = e.id
  order by created_at desc
  limit 1
) sl on true;

## Customer Payment View
create or replace view public.customer_payments_view as
select
  p.id,
  p.customer_id,
  p.order_id,
  p.payment_date,
  p.amount,
  p.mode,
  p.sender_account_no,
  a.account_number as receiver_account,
  p.created_at
from customer_payments p
left join accounts a
  on a.id = p.receiver_account_id
order by p.payment_date desc;

---

## 11. Supabase RPC Functions

> **Note:** Get the full SQL for each function from Supabase dashboard → Database → Functions.

| RPC Name | Called By | Parameters | Returns | Purpose |
|----------|-----------|-----------|---------|---------|
| `get_daily_cash_summary` | `getDailyCashSummary` | `p_page int`, `p_page_size int` | `DailyCashSummaryResponse` | Paginated daily totals of cash_in/cash_out from APP_START_DATE to today |
| `get_cash_ledger_for_date` | `getCashLedgerForDate` | `p_date date` | `CashLedgerForDate` | All cash_in + cash_out entries for one specific day with account aggregation |
| `get_financial_summary` | `getFinancialSummary` | none | `FinancialSummary` | Aggregate outstanding: receivables, vendor payables, loans, salary |
| `get_employee_ledger` | `getEmployeeLedger` | `p_employee_id uuid`, `p_page int` | `EmployeeLedgerResponse` | Paginated salary ledger for one employee + employee info |
| `get_fixed_salary_employees_for_month` | `getSalaryEmployees` | `p_month text` | `SalaryEmployee[]` | FIXED category employees with attendance counts for salary calculation |
| `generate_salary` | `generateSalaryRPC` | `p_month text`, `p_employees json` | void/result | Bulk inserts salary_ledger entries for all FIXED employees for a month |

## 11.1 Functions

## Get Employee Ledger 

create or replace function get_employee_ledger(
  p_employee_id uuid,
  p_is_ascending boolean,
  p_from_date timestamptz default null,
  p_to_date timestamptz default null,
  p_page integer default 0,
  p_page_size integer default 20
)
returns json
language plpgsql
as $$
declare
  v_offset integer;
  v_employee json;
  v_transactions json;
  v_total bigint;
begin

  v_offset := p_page * p_page_size;

  /* -------------------------------------------------------------
     EMPLOYEE + ROLE + RUNNING BALANCE (BASED ON payment_at)
  --------------------------------------------------------------*/
  select json_build_object(
    'id', e.id,
    'name', e.name,
    'phone', e.phone,
    'role_name', r.name,
    'role_category', r.category,
    'running_balance',
      coalesce(
        (
          select running_balance
          from salary_ledger
          where employee_id = p_employee_id
          order by created_at desc
          limit 1
        ),
        0
      )
  )
  into v_employee
  from employees e
  left join roles r on r.id = e.role_id
  where e.id = p_employee_id;

  /* -------------------------------------------------------------
     TOTAL COUNT (FILTER BY payment_at)
  --------------------------------------------------------------*/
  select count(*)
  into v_total
  from salary_ledger
  where employee_id = p_employee_id
    and (p_from_date is null or payment_at >= p_from_date)
    and (p_to_date is null or payment_at <= p_to_date);

  /* -------------------------------------------------------------
     PAGINATED TRANSACTIONS (payment_at everywhere)
  --------------------------------------------------------------*/
  select json_agg(t)
  into v_transactions
  from (
    select
      id,
      entry_type,
      amount,
      payment_mode,
      sender_account_id,
      receiver_account,
      notes,
      payment_at
    from salary_ledger
    where employee_id = p_employee_id
      and (p_from_date is null or payment_at >= p_from_date)
      and (p_to_date is null or payment_at <= p_to_date)
    order by
      case when p_is_ascending then payment_at end asc,
      case when not p_is_ascending then payment_at end desc
    offset v_offset
    limit p_page_size
  ) t;

  return json_build_object(
    'employee', v_employee,
    'transactions', coalesce(v_transactions, '[]'::json),
    'total_count', v_total
  );

end;

## Reverse Customer Payment
CREATE OR REPLACE FUNCTION reverse_customer_payment(
  p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_id UUID;
  v_amount numeric;
  v_receiver_account_id UUID;
  v_remaining numeric;
  o RECORD;
  p RECORD;
BEGIN
  -- 1. Get the payment details
  SELECT customer_id, amount, receiver_account_id
  INTO v_customer_id, v_amount, v_receiver_account_id
  FROM customer_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  -- 2. Decrement the receiver account balance
  IF v_receiver_account_id IS NOT NULL THEN
    UPDATE accounts
    SET balance = balance - v_amount
    WHERE id = v_receiver_account_id;
  END IF;

  -- 3. Delete the payment record
  DELETE FROM customer_payments
  WHERE id = p_payment_id;

  -- 4. Reset ALL orders for this customer
  UPDATE orders
  SET amount_paid = 0,
      payment_status = 'NOT_PAID'::payment_status
  WHERE customer_id = v_customer_id
    AND delivered = true;

  -- 5. Re-apply all remaining payments in FIFO order
  FOR p IN
    SELECT id, amount
    FROM customer_payments
    WHERE customer_id = v_customer_id
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    v_remaining := p.amount;

    FOR o IN
      SELECT id, final_price, COALESCE(amount_paid, 0) AS paid
      FROM orders
      WHERE customer_id = v_customer_id
        AND delivered = true
        AND final_price > COALESCE(amount_paid, 0)
      ORDER BY order_date ASC
    LOOP
      EXIT WHEN v_remaining <= 0;

      IF v_remaining >= (o.final_price - o.paid) THEN
        UPDATE orders
        SET amount_paid = final_price
        WHERE id = o.id;

        v_remaining := v_remaining - (o.final_price - o.paid);
      ELSE
        UPDATE orders
        SET amount_paid = o.paid + v_remaining
        WHERE id = o.id;

        v_remaining := 0;
      END IF;
    END LOOP;
  END LOOP;

  -- 6. Recalculate payment_status for all customer orders
  UPDATE orders
  SET payment_status =
    CASE
      WHEN COALESCE(amount_paid, 0) = 0
        THEN 'NOT_PAID'::payment_status
      WHEN amount_paid < final_price
        THEN 'PARTIALLY_PAID'::payment_status
      ELSE
        'FULLY_PAID'::payment_status
    END
  WHERE customer_id = v_customer_id
    AND delivered = true;
END;

## Reverse Vendor Payment
CREATE OR REPLACE FUNCTION reverse_vendor_payment(
  p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_vendor_id UUID;
  v_amount NUMERIC;
  v_sender_account_id UUID;
  v_settlement RECORD;
  v_new_paid NUMERIC;
  v_total_price NUMERIC;
  v_new_status TEXT;
BEGIN
  -- 1. Get the payment details
  SELECT vendor_id, amount, sender_account_id
  INTO v_vendor_id, v_amount, v_sender_account_id
  FROM vendor_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor payment not found: %', p_payment_id;
  END IF;

  -- 2. Reverse each settlement linked to this payment
  FOR v_settlement IN
    SELECT procurement_id, applied_amount
    FROM vendor_procurement_settlements
    WHERE vendor_payment_id = p_payment_id
  LOOP
    -- Reduce total_paid on the procurement
    UPDATE procurements
    SET total_paid = GREATEST(COALESCE(total_paid, 0) - v_settlement.applied_amount, 0)
    WHERE id = v_settlement.procurement_id;

    -- Recalculate payment_status for that procurement
    SELECT COALESCE(total_paid, 0), total_price
    INTO v_new_paid, v_total_price
    FROM procurements
    WHERE id = v_settlement.procurement_id;

    IF v_new_paid <= 0 THEN
      v_new_status := 'NOT_PAID';
    ELSIF v_new_paid >= v_total_price THEN
      v_new_status := 'PAID';
    ELSE
      v_new_status := 'PARTIALLY_PAID';
    END IF;

    UPDATE procurements
    SET payment_status = v_new_status
    WHERE id = v_settlement.procurement_id;
  END LOOP;

  -- 3. Delete all settlement records for this payment
  DELETE FROM vendor_procurement_settlements
  WHERE vendor_payment_id = p_payment_id;

  -- 4. Add back (increment) the sender account balance
  IF v_sender_account_id IS NOT NULL THEN
    UPDATE accounts
    SET balance = balance + v_amount
    WHERE id = v_sender_account_id;
  END IF;

  -- 5. Delete the payment record
  DELETE FROM vendor_payments
  WHERE id = p_payment_id;
END;

## Get Financial Summary 
create or replace function get_financial_summary()
returns json
language sql
as $$
select json_build_object(

  /* -------------------------------------------------------------
     RECEIVABLES (Customers)
  --------------------------------------------------------------*/
  'total_receivables',
    coalesce((
      select sum(outstanding_amount)
      from customer_financials
    ), 0),

  /* -------------------------------------------------------------
     VENDOR PAYABLES
  --------------------------------------------------------------*/
  'total_vendor_payables',
    coalesce((
      select sum(outstanding_balance)
      from vendor_financials
    ), 0),

  /* -------------------------------------------------------------
     LOAN OUTSTANDING
  --------------------------------------------------------------*/
  'total_loan_outstanding',
    coalesce((
      select sum(outstanding_balance)
      from loans
      where status = 'ACTIVE'
    ), 0),

  /* -------------------------------------------------------------
     SALARY PAYABLE (IMPORTANT)
     Only latest balance per employee
     Only positive balances
  --------------------------------------------------------------*/
  'total_salary_payable',
    coalesce((
      select sum(balance)
      from (
        select
          coalesce((
            select running_balance
            from salary_ledger sl
            where sl.employee_id = e.id
            order by sl.created_at desc
            limit 1
          ), 0) as balance
        from employees e
      ) t
      where balance > 0
    ), 0)

);

## Get Daily Cash Summary
CREATE OR REPLACE FUNCTION get_daily_cash_summary(
  p_page INT DEFAULT 0,
  p_page_size INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_min_date DATE := '2026-04-14'::DATE;
  v_today DATE := (timezone('Asia/Kolkata', now()))::date;
  v_total_days INT;
  v_result JSON;
BEGIN
  -- Date range calculation
  v_end_date := v_today - (p_page * p_page_size);
  v_start_date := GREATEST(v_end_date - (p_page_size - 1), v_min_date);

  -- Total days
  v_total_days := v_today - v_min_date + 1;

  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(day_row ORDER BY day_row->>'date' DESC)
      FROM (
        SELECT json_build_object(
          'date', d.dt::TEXT,
          'cash_in', COALESCE(ci.total, 0),
          'cash_out', COALESCE(co.total, 0)
        ) AS day_row
        FROM generate_series(v_start_date, v_end_date, '1 day'::INTERVAL) AS d(dt)

        -- CASH IN
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM (
            SELECT amount
            FROM loan_ledger
            WHERE transaction_type = 'DISBURSEMENT'
              AND transaction_date = d.dt

            UNION ALL

            SELECT amount
            FROM customer_payments
            WHERE payment_date = d.dt
          ) sub_in
        ) ci ON TRUE

        -- CASH OUT
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM (
            -- Expenses
            SELECT amount
            FROM expenses
            WHERE expense_date = d.dt

            UNION ALL

            -- ✅ FIXED: convert created_at → IST before DATE
            SELECT amount
            FROM salary_ledger
            WHERE (payment_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = d.dt
              AND entry_type NOT IN ('AUTO', 'SALARY_AUTO_ENTRY')

            UNION ALL

            -- Vendor Payments
            SELECT amount
            FROM vendor_payments
            WHERE payment_date = d.dt

            UNION ALL

            -- Loan Repayments + Interest
            SELECT amount
            FROM loan_ledger
            WHERE transaction_type IN ('REPAYMENT', 'INTEREST')
              AND transaction_date = d.dt
          ) sub_out
        ) co ON TRUE

      ) wrapped
    ), '[]'::JSON),

    'total_days', v_total_days,
    'has_more', ((p_page + 1) * p_page_size) < v_total_days
  ) INTO v_result;

  RETURN v_result;
END;


## Get Cash Ledger for Date
CREATE OR REPLACE FUNCTION get_cash_ledger_for_date(
  p_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    -- ═══ CASH IN ENTRIES ═══
    'cash_in_entries', COALESCE((
      SELECT json_agg(entry ORDER BY entry->>'created_at' DESC)
      FROM (
        -- Loan Disbursements
        SELECT json_build_object(
          'id', ll.id,
          'source_type', 'Loan Disbursement',
          'description', l.lender_name || ' (' || l.loan_type || ')',
          'amount', ll.amount,
          'receiver_account_id', ll.sender_account_id,
          'receiver_account_number', COALESCE(a.account_number, 'Unknown'),
          'payment_mode', ll.payment_mode,
          'notes', ll.notes,
          'created_at', ll.created_at
        ) AS entry
        FROM loan_ledger ll
        JOIN loans l ON l.id = ll.loan_id
        LEFT JOIN accounts a ON a.id = ll.sender_account_id
        WHERE ll.transaction_type = 'DISBURSEMENT'
          AND ll.transaction_date = p_date

        UNION ALL

        -- Customer Payments
        SELECT json_build_object(
          'id', cp.id,
          'source_type', 'Customer Payment',
          'description', c.name || ' (' || c.phone || ')',
          'amount', cp.amount,
          'receiver_account_id', cp.receiver_account_id,
          'receiver_account_number', COALESCE(a.account_number, 'Unknown'),
          'payment_mode', cp.mode,
          'notes', NULL,
          'created_at', cp.created_at
        ) AS entry
        FROM customer_payments cp
        JOIN customers c ON c.id = cp.customer_id
        LEFT JOIN accounts a ON a.id = cp.receiver_account_id
        WHERE cp.payment_date = p_date
      ) wrapped
    ), '[]'::JSON),

    -- ═══ CASH OUT ENTRIES ═══
    'cash_out_entries', COALESCE((
      SELECT json_agg(entry ORDER BY entry->>'created_at' DESC)
      FROM (
        -- Expenses
        SELECT json_build_object(
          'id', e.id,
          'payment_type', 'Expense',
          'description', COALESCE(et.name, 'Unknown') || ' - ' || COALESCE(es.name, ''),
          'amount', e.amount,
          'sender_account_id', e.sender_account_id,
          'sender_account_number', COALESCE(a.account_number, 'Cash'),
          'payment_mode', e.payment_mode,
          'notes', e.comments,
          'created_at', e.created_at
        ) AS entry
        FROM expenses e
        LEFT JOIN expense_types et ON et.id = e.type_id
        LEFT JOIN expense_subtypes es ON es.id = e.subtype_id
        LEFT JOIN accounts a ON a.id = e.sender_account_id
        WHERE e.expense_date = p_date

        UNION ALL

        -- Salary Payments (UPDATED)
        SELECT json_build_object(
          'id', sl.id,
          'payment_type', 'Salary Payment',
          'description', emp.name || ' (' || sl.entry_type || ')',
          'amount', sl.amount,
          'sender_account_id', sl.sender_account_id,
          'sender_account_number', COALESCE(a.account_number, 'Cash'),
          'payment_mode', sl.payment_mode,
          'notes', sl.notes,
          'created_at', sl.payment_at
        ) AS entry
        FROM salary_ledger sl
        JOIN employees emp ON emp.id = sl.employee_id
        LEFT JOIN accounts a ON a.id = sl.sender_account_id
        WHERE sl.payment_at::DATE = p_date
          AND sl.entry_type NOT IN ('AUTO', 'SALARY_AUTO_ENTRY')

        UNION ALL

        -- Vendor Payments
        SELECT json_build_object(
          'id', vp.id,
          'payment_type', 'Vendor Payment',
          'description', v.name,
          'amount', vp.amount,
          'sender_account_id', vp.sender_account_id,
          'sender_account_number', COALESCE(a.account_number, 'Cash'),
          'payment_mode', vp.mode,
          'notes', NULL,
          'created_at', vp.created_at
        ) AS entry
        FROM vendor_payments vp
        JOIN vendors v ON v.id = vp.vendor_id
        LEFT JOIN accounts a ON a.id = vp.sender_account_id
        WHERE vp.payment_date = p_date

        UNION ALL

        -- Loan Repayments + Interest
        SELECT json_build_object(
          'id', ll.id,
          'payment_type', CASE
            WHEN ll.transaction_type = 'REPAYMENT' THEN 'Loan Repayment'
            ELSE 'Loan Interest'
          END,
          'description', l.lender_name || ' (' || l.loan_type || ')',
          'amount', ll.amount,
          'sender_account_id', ll.sender_account_id,
          'sender_account_number', COALESCE(a.account_number, 'Cash'),
          'payment_mode', ll.payment_mode,
          'notes', ll.notes,
          'created_at', ll.created_at
        ) AS entry
        FROM loan_ledger ll
        JOIN loans l ON l.id = ll.loan_id
        LEFT JOIN accounts a ON a.id = ll.sender_account_id
        WHERE ll.transaction_type IN ('REPAYMENT', 'INTEREST')
          AND ll.transaction_date = p_date
      ) wrapped
    ), '[]'::JSON),

    -- ═══ CASH IN AGGREGATED BY ACCOUNT ═══
    'cash_in_by_account', COALESCE((
      SELECT json_agg(
        json_build_object(
          'account_id', sub.receiver_account_id,
          'account_number', sub.account_number,
          'total', sub.total
        )
      )
      FROM (
        SELECT
          agg.receiver_account_id,
          COALESCE(a.account_number, 'Unknown') AS account_number,
          SUM(agg.amount) AS total
        FROM (
          SELECT sender_account_id AS receiver_account_id, amount
          FROM loan_ledger
          WHERE transaction_type = 'DISBURSEMENT'
            AND transaction_date = p_date

          UNION ALL

          SELECT receiver_account_id, amount
          FROM customer_payments
          WHERE payment_date = p_date
        ) agg
        LEFT JOIN accounts a ON a.id = agg.receiver_account_id
        GROUP BY agg.receiver_account_id, a.account_number
      ) sub
    ), '[]'::JSON),

    -- ═══ CASH OUT AGGREGATED BY ACCOUNT (UPDATED) ═══
    'cash_out_by_account', COALESCE((
      SELECT json_agg(
        json_build_object(
          'account_id', sub.sender_account_id,
          'account_number', sub.account_number,
          'total', sub.total
        )
      )
      FROM (
        SELECT
          agg.sender_account_id,
          COALESCE(a.account_number, 'Cash') AS account_number,
          SUM(agg.amount) AS total
        FROM (
          -- Expenses
          SELECT sender_account_id, amount
          FROM expenses
          WHERE expense_date = p_date

          UNION ALL

          -- Salary Payments (UPDATED)
          SELECT sender_account_id, amount
          FROM salary_ledger
          WHERE payment_at::DATE = p_date
            AND entry_type NOT IN ('AUTO', 'SALARY_AUTO_ENTRY')

          UNION ALL

          -- Vendor Payments
          SELECT sender_account_id, amount
          FROM vendor_payments
          WHERE payment_date = p_date

          UNION ALL

          -- Loan Repayments + Interest
          SELECT sender_account_id, amount
          FROM loan_ledger
          WHERE transaction_type IN ('REPAYMENT', 'INTEREST')
            AND transaction_date = p_date
        ) agg
        LEFT JOIN accounts a ON a.id = agg.sender_account_id
        GROUP BY agg.sender_account_id, a.account_number
      ) sub
    ), '[]'::JSON),

    -- ═══ TOTALS (UPDATED) ═══
    'total_cash_in', COALESCE((
      SELECT SUM(amount) FROM (
        SELECT amount FROM loan_ledger
        WHERE transaction_type = 'DISBURSEMENT' AND transaction_date = p_date
        UNION ALL
        SELECT amount FROM customer_payments
        WHERE payment_date = p_date
      ) t
    ), 0),

    'total_cash_out', COALESCE((
      SELECT SUM(amount) FROM (
        SELECT amount FROM expenses WHERE expense_date = p_date

        UNION ALL

        -- Salary Payments (UPDATED)
        SELECT amount FROM salary_ledger
        WHERE payment_at::DATE = p_date
          AND entry_type NOT IN ('AUTO', 'SALARY_AUTO_ENTRY')

        UNION ALL

        SELECT amount FROM vendor_payments WHERE payment_date = p_date

        UNION ALL

        SELECT amount FROM loan_ledger
        WHERE transaction_type IN ('REPAYMENT', 'INTEREST')
          AND transaction_date = p_date
      ) t
    ), 0)

  ) INTO v_result;

  RETURN v_result;
END;


## Get fixed salary employees for month
create or replace function get_fixed_salary_employees_for_month(
  p_month date
)
returns json
language sql
as $$
with date_range as (
  select
    (date_trunc('month', p_month - interval '1 month'))::date as start_date,
    (date_trunc('month', p_month) - interval '1 day')::date as end_date
),

employees_filtered as (
  select
    e.id,
    e.name,
    e.phone,
    r.salary_value as base_salary
  from employees e
  join roles r on r.id = e.role_id
  where r.category = 'FIXED'
    and e.active = true
),

attendance_summary as (
  select
    a.employee_id,
    count(*) filter (where a.status = 'PRESENT') as present_days,
    count(*) filter (where a.status = 'ABSENT') as absent_days,
    count(*) filter (where a.status = 'LEAVE') as leave_days,
    count(*) filter (where a.status = 'HALF_DAY') as half_days
  from attendance a
  cross join date_range d
  where a.date >= d.start_date
    and a.date <= d.end_date
  group by a.employee_id
)

select json_agg(
  json_build_object(
    'employee_id', e.id,
    'name', e.name,
    'phone', e.phone,
    'present_days', coalesce(a.present_days,0),
    'absent_days', coalesce(a.absent_days,0),
    'leave_days', coalesce(a.leave_days,0),
    'half_days', coalesce(a.half_days,0),
    'base_salary', e.base_salary
  )
)
from employees_filtered e
left join attendance_summary a
  on a.employee_id = e.id;


## Apply Customer Payment FIFO
CREATE OR REPLACE FUNCTION apply_customer_payment_fifo(
  p_customer_id uuid,
  p_payment_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  remaining_amount numeric := p_amount;
  o RECORD;
BEGIN
  -- Apply FIFO payments
  FOR o IN
    SELECT
      id,
      final_price,
      COALESCE(amount_paid, 0) AS paid
    FROM orders
    WHERE customer_id = p_customer_id
      AND delivered = true
      AND final_price > COALESCE(amount_paid, 0)
    ORDER BY order_date ASC
  LOOP
    EXIT WHEN remaining_amount <= 0;

    IF remaining_amount >= (o.final_price - o.paid) THEN
      UPDATE orders
      SET amount_paid = final_price
      WHERE id = o.id;

      remaining_amount := remaining_amount - (o.final_price - o.paid);
    ELSE
      UPDATE orders
      SET amount_paid = o.paid + remaining_amount
      WHERE id = o.id;

      remaining_amount := 0;
    END IF;
  END LOOP;

  -- 🔥 Recalculate payment_status (ENUM SAFE)
  UPDATE orders
  SET payment_status =
    CASE
      WHEN COALESCE(amount_paid, 0) = 0
        THEN 'NOT_PAID'::payment_status
      WHEN amount_paid < final_price
        THEN 'PARTIALLY_PAID'::payment_status
      ELSE
        'FULLY_PAID'::payment_status
    END
  WHERE customer_id = p_customer_id
  AND delivered = true;                     
END;


## Increment Account Balance 
create or replace function increment_account_balance(
  p_account_id uuid,
  p_amount numeric
) returns void
language plpgsql
as $$
begin
  update accounts
  set balance = balance + p_amount
  where id = p_account_id;
end;

## Decrement Account Balance
create or replace function decrement_account_balance(
  p_account_id uuid,
  p_amount numeric
)
returns void
language plpgsql
as $$
declare
  current_balance numeric;
begin
  -- 1️⃣ Lock the account row (prevents race conditions)
  select balance
  into current_balance
  from accounts
  where id = p_account_id
  for update;

  -- 2️⃣ If account not found
  if current_balance is null then
    raise exception 'Account not found';
  end if;

  -- 3️⃣ Validate sufficient balance
  if current_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  -- 4️⃣ Deduct amount
  update accounts
  set balance = balance - p_amount
  where id = p_account_id;

end;

## Apply Vendor Payment FIFO
create or replace function apply_vendor_payment_fifo(
  p_vendor_id uuid,
  p_payment_id uuid,
  p_amount numeric
)
returns void
language plpgsql
as $$
declare
  v_remaining numeric := p_amount;
  v_proc record;
  v_balance numeric;
  v_apply numeric;
begin
  for v_proc in
    select *
    from procurements
    where vendor_id = p_vendor_id
      and payment_status in ('NOT_PAID','PARTIALLY_PAID')
      and approved = true
    order by date asc
  loop
    exit when v_remaining <= 0;

    v_balance := v_proc.total_price - coalesce(v_proc.total_paid, 0);

    if v_balance <= 0 then
      continue;
    end if;

    v_apply := least(v_balance, v_remaining);

    -- Insert settlement
    insert into vendor_procurement_settlements(
      procurement_id,
      vendor_payment_id,
      applied_amount
    )
    values (
      v_proc.id,
      p_payment_id,
      v_apply
    );

    -- Update procurement
    update procurements
    set total_paid = coalesce(total_paid,0) + v_apply,
        payment_status =
          case
            when (coalesce(total_paid,0) + v_apply) >= total_price
              then 'PAID'
            else 'PARTIALLY_PAID'
          end
    where id = v_proc.id;

    v_remaining := v_remaining - v_apply;
  end loop;
end;

## Generate Salary Batch
create or replace function generate_salary_batch(
  p_month date,
  p_items json
)
returns json
language plpgsql
as $$
declare
  v_batch_id uuid;
  v_item json;
  v_employee_id uuid;
  v_final_salary numeric;
  v_current_balance numeric;
  v_new_balance numeric;
begin

  /* -------------------------------------------------------------
     1. PREVENT DUPLICATE MONTH
  --------------------------------------------------------------*/
  if exists (
    select 1 from salary_batches where month = p_month
  ) then
    raise exception 'Salary already generated for this month';
  end if;

  /* -------------------------------------------------------------
     2. CREATE BATCH
  --------------------------------------------------------------*/
  insert into salary_batches (month, status)
  values (p_month, 'GENERATED')
  returning id into v_batch_id;

  /* -------------------------------------------------------------
     3. LOOP ITEMS
  --------------------------------------------------------------*/
  for v_item in select * from json_array_elements(p_items)
  loop

    v_employee_id := (v_item->>'employee_id')::uuid;
    v_final_salary := (v_item->>'final_salary')::numeric;

    /* 3.1 Insert batch item */
    insert into salary_batch_items (
      batch_id,
      employee_id,
      present_days,
      absent_days,
      leave_days,
      half_days,
      base_salary,
      final_salary
    )
    values (
      v_batch_id,
      v_employee_id,
      coalesce((v_item->>'present_days')::int,0),
      coalesce((v_item->>'absent_days')::int,0),
      coalesce((v_item->>'leave_days')::int,0),
      coalesce((v_item->>'half_days')::int,0),
      (v_item->>'base_salary')::numeric,
      v_final_salary
    );

    /* ---------------------------------------------------------
       3.2 GET CURRENT RUNNING BALANCE
    ----------------------------------------------------------*/
    select running_balance
    into v_current_balance
    from salary_ledger
    where employee_id = v_employee_id
    order by created_at desc
    limit 1;

    v_current_balance := coalesce(v_current_balance, 0);

    /* ---------------------------------------------------------
       3.3 CALCULATE NEW BALANCE
    ----------------------------------------------------------*/
    v_new_balance := v_current_balance + v_final_salary;

    /* ---------------------------------------------------------
       3.4 INSERT SALARY LEDGER ENTRY
    ----------------------------------------------------------*/
    insert into salary_ledger (
      employee_id,
      entry_type,
      amount,
      running_balance,
      payment_mode,
      sender_account_id,
      receiver_account,
      notes,
      salary_batch_id
    )
    values (
      v_employee_id,
      'SALARY_AUTO_ENTRY',
      v_final_salary,
      v_new_balance,
      null,
      null,
      null,
      'Salary generated for ' || p_month,
      v_batch_id
    );

  end loop;

  /* -------------------------------------------------------------
     4. RETURN RESPONSE
  --------------------------------------------------------------*/
  return json_build_object(
    'batch_id', v_batch_id,
    'message', 'Salary generated successfully'
  );

end;

---

## Update App Settings Updated at
create trigger trigger_app_settings_updated_at BEFORE
update on app_settings for EACH row
execute FUNCTION update_app_settings_updated_at ();

## 12. Shared Types Reference

All types are defined in `src/services/types.ts`. Key enums:

```typescript
type UserRole = "ADMIN" | "EMPLOYEE";
type EmployeeCategory = "DAILY" | "FIXED" | "LOADMEN";
type LoanType = "OWNER" | "BANK" | "SHORT_TERM";
type LoanStatus = "ACTIVE" | "CLOSED";
type LoanTransactionType = "DISBURSEMENT" | "REPAYMENT" | "INTEREST";
type PaymentMode = "CASH" | "BANK" | "UPI" | "CHEQUE";
type PaymentStatus = "NOT_PAID" | "PARTIALLY_PAID" | "FULLY_PAID";
type LoadingType = "LOADING_UNLOADING" | "LOADING_ONLY" | "CUSTOMER_SELF";
type AttendanceStatus = "Present" | "Absent" | "Half Day" | "Leave";
// DB-side: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE"
type SalaryLedgerEntryType =
  | "ADVANCE" | "WEEKLY" | "EMERGENCY" | "DAILY"
  | "PARTIAL_SETTLEMENT" | "FULL_SETTLEMENT"
  | "SALARY_AUTO_ENTRY" | "DEDUCTION" | "AUTO";
```

---

## 13. Shared UI Components

### `src/components/Popup.tsx`

A reusable modal for success/error feedback. Used on every screen.

```tsx
<Popup
  title="Success"
  message="Record saved"
  onClose={() => setShowSuccessPopup(false)}
  type="success"   // or "error" (default)
/>
```

### `src/components/ui/`

Full Radix UI component library. Includes: Button, Input, Dialog, Tabs, Select, Accordion, Badge, Card, etc.

### Pagination Pattern

Every paginated list uses:
```typescript
const [page, setPage] = useState(0);
const [hasMore, setHasMore] = useState(false);
// Load More button:
<button onClick={() => setPage(prev => prev + 1)}>Load More</button>
```

---

## 14. App Settings System

**Table:** `app_settings`

| Key | Value Example | Used In |
|-----|---------------|---------|
| `APP_START_DATE` | `2026-04-14` | All date range filters, daily cash ledger start date |
| `LOADING_AND_UNLOADING_PRICE_PER_BRICK` | `0.334` | Loadmen salary calculation per order |

**How to add a new setting:**
1. Run SQL: `INSERT INTO app_settings (key, value, description) VALUES (...)`
2. The Settings screen auto-displays all rows — no code change needed for display
3. Read it in service layer: `getAppSettings()` or a specific `getXxx()` helper

---

## 15. Reuse Guide — Extracting Modules for a New Client

### Goal: Use Cash Flow + Accounts modules for a new client

---

### What you MUST keep (core infrastructure)

These are dependencies for everything else:

| File/Folder | Why needed |
|-------------|-----------|
| `src/lib/supabaseClient.ts` | DB connection |
| `src/services/types.ts` | All TypeScript types |
| `src/services/middleware.service.ts` | All DB calls (can be trimmed) |
| `src/utils/reusables.ts` | Pagination helpers |
| `src/components/Popup.tsx` | Shared UI feedback |
| `src/components/ui/` | Radix UI components |
| `src/admin/components/AdminGuard.tsx` | Auth protection |

---

### Modules you can reuse DIRECTLY (low coupling)

| Module | Files to copy | DB Tables needed | RPCs needed |
|--------|--------------|-----------------|------------|
| **Cash Flow** | `admin/pages/cash/` + `admin/hooks/useCashFlow.ts` + `admin/hooks/useCashLedger.ts` *(if exists)* | `accounts`, `withdrawals`, `account_transfers`, cash_entries table | `get_daily_cash_summary`, `get_cash_ledger_for_date`, `get_financial_summary`, `increment_account_balance`, `decrement_account_balance` |
| **Accounts (Expenses)** | `admin/pages/accounts/` + related hooks | `expense_types`, `expense_subtypes`, `expenses` | None (direct table queries) |
| **Vendors** | `admin/pages/vendors/` + vendor hooks | `vendors`, `vendor_materials`, `materials`, `vendor_payments` | None |
| **Loans** | `admin/pages/loans/` + loan hooks | `loans`, `loan_ledger`, `accounts` | None |
| **App Settings** | `admin/pages/settings/` + `useAppSettings.ts` | `app_settings` | None |

---

### Modules with HIGH coupling (business-specific, harder to reuse)

| Module | Coupling reason |
|--------|----------------|
| Orders | Tightly coupled to bricks/loadmen/delivery business logic |
| Production Statistics | Brick-manufacturing specific (fly_ash, cement_bags columns) |
| Inventory | Tied to materials/production deductions |
| Employees (salary calc) | Salary logic is complex and business-specific |

---

### Steps to create a new client app using these modules

1. **Create new Vite + React + TypeScript project**

2. **Copy infrastructure files:**
   - `src/lib/supabaseClient.ts` → update env vars
   - `src/services/types.ts` → keep only types for modules you use
   - `src/services/middleware.service.ts` → trim to only functions you need
   - `src/utils/reusables.ts`
   - `src/components/Popup.tsx`
   - `src/components/ui/`

3. **Create new Supabase project** for the new client and run these SQL migrations:
   - `app_settings_table.sql`
   - `app_start_date_setting.sql`
   - Tables: `accounts`, `withdrawals`, and the cash entries table (get SQL from Supabase)
   - RPCs: `get_daily_cash_summary`, `get_cash_ledger_for_date`, `get_financial_summary` (get SQL from Supabase)
   - For expenses: `expense_types`, `expense_subtypes`, `expenses`
   - `profiles` table (for auth)

4. **Update `CASH_ACCOUNT_ID` constant** in `middleware.service.ts` — this is the UUID of the cash account row in the new client's `accounts` table

5. **Copy module pages + hooks** for the modules you want

6. **Build a new HomeScreen** that links to only the modules the new client needs

7. **Set up Auth** — keep `AdminGuard.tsx` + login screen

8. **Update `APP_START_DATE`** in the new client's `app_settings` table to the new client's go-live date

---

### What to ask Supabase for (SQL to collect)

Go to Supabase → Database → Tables / Functions and export SQL for:

**Tables (export CREATE TABLE SQL):**
- [ ] `profiles`
- [ ] `app_settings`
- [ ] `accounts`
- [ ] `withdrawals`
- [ ] `expense_types`
- [ ] `expense_subtypes`
- [ ] `expenses`
- [ ] `vendors`
- [ ] `vendor_materials`
- [ ] `materials`
- [ ] `vendor_payments`
- [ ] `loans`
- [ ] `loan_ledger`
- [ ] `customers`
- [ ] `customer_payments`
- [ ] `orders`
- [ ] `order_loadmen`
- [ ] `employees`
- [ ] `roles`
- [ ] `attendance`
- [ ] `salary_ledger`
- [ ] `salary_batches`
- [ ] `procurement_requests`
- [ ] `inventory_stock`
- [ ] `production_entries`
- [ ] `adjustments`
- [ ] `product_inventory`
- [ ] The cash entries / cash_in / cash_out table (check actual name)

**RPC Functions (export SQL):**
- [ ] `get_daily_cash_summary`
- [ ] `get_cash_ledger_for_date`
- [ ] `get_financial_summary`
- [ ] `get_employee_ledger`
- [ ] `get_fixed_salary_employees_for_month`
- [ ] `generate_salary`
- [ ] `update_app_settings_updated_at` (trigger function)
- [ ] Any triggers on accounts balance updates

---

## 16. Environment Variables

The app requires two environment variables (set in `.env` / Vercel dashboard):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-anon-key
```

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Supabase anon/public key (safe for browser)
- Row Level Security (RLS) in Supabase controls what authenticated users can access

---

## 17. Build & Deployment

**Local dev:**
```bash
npm install
npm run dev     # Vite dev server
```

**Production build:**
```bash
npm run build   # outputs to /build
```

**Deployed on Vercel.** The `vercel.json` rewrites all routes to `index.html` for SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

*Document generated: 25 April 2026*
*Branch: feature/One_Page_Attendance_view*
*Codebase: ArkaApp by arkatechteam-lang*
