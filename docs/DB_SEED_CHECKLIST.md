# 🗄️ Database Seed Checklist — Backdating Data from April 1st

> **Context**: The client wants to start using the app but needs to enter historical data from April 1, 2026 onwards. Some data can be entered via the app UI, but certain items must be seeded directly into the Supabase database.

---

## 📋 SECTION 1: Data That MUST Be Entered Directly in DB

These items cannot be entered through the app UI with historical dates, or represent opening/carry-forward balances.

### 1.1 🏦 Accounts (Bank / Cash Accounts)

**Table:** `accounts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Auto-generated |
| `account_number` | text | Account name/number (e.g., "Cash", "HDFC XXXX1234") |
| `opening_balance` | numeric | Balance as of April 1st |
| `balance` | numeric | Set same as `opening_balance` initially |
| `created_at` | timestamptz | Set to `2026-04-01T00:00:00+05:30` |

> ⚠️ **IMPORTANT**: One account MUST have `account_number = 'Cash'` — the app uses `ilike('Cash')` to find the cash account. The hardcoded `CASH_ACCOUNT_ID` constant in the code (`04f194f4-af1f-4ac0-98be-a5b7f81b449f`) must match the actual Cash account UUID in the DB.

```sql
-- Example
INSERT INTO accounts (account_number, opening_balance, balance, created_at)
VALUES
  ('Cash', 50000, 50000, '2026-04-01T00:00:00+05:30'),
  ('HDFC XXXX1234', 200000, 200000, '2026-04-01T00:00:00+05:30');
```

---

### 1.2 👥 Customers with Outstanding Amounts

Customers can be created via the app, but **outstanding balances from before April 1st** must be handled via DB.

**Step 1 — Create Customers**

**Table:** `customers`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Auto-generated |
| `name` | text | Customer name |
| `phone` | text | 10-digit phone |
| `address` | text | Address |
| `gst_number` | text (nullable) | GST if applicable |
| `created_at` | timestamptz | Backdate to `2026-04-01` |

**Step 2 — Seed Outstanding Balance**

The view `customer_financials` calculates outstanding as: `total order value (delivered) - total payments received`.

To carry forward an outstanding amount, you need to create a **dummy delivered order** representing the historical outstanding:

**Table:** `orders`

| Column | Type | Value |
|--------|------|-------|
| `customer_id` | uuid | FK to customers |
| `order_date` | date | `2026-03-31` (or any date before April 1) |
| `delivery_date` | date | `2026-03-31` |
| `brick_quantity` | int | 0 or actual historical value |
| `price_per_brick` | numeric | null |
| `paper_price` | numeric | null |
| `final_price` | numeric | **The outstanding amount** |
| `location` | text | `'Carry Forward Balance'` |
| `payment_status` | text | `'NOT_PAID'` |
| `amount_paid` | numeric | 0 |
| `delivered` | boolean | `true` |
| `created_by` | uuid | Admin user ID |
| `created_at` | timestamptz | `2026-03-31T00:00:00+05:30` |

```sql
-- Example: Customer has ₹50,000 outstanding from before April 1
INSERT INTO orders (customer_id, order_date, delivery_date, brick_quantity, final_price, location, payment_status, amount_paid, delivered, created_by, created_at)
VALUES
  ('<customer_uuid>', '2026-03-31', '2026-03-31', 0, 50000, 'Carry Forward Balance', 'NOT_PAID', 0, true, '<admin_uuid>', '2026-03-31T00:00:00+05:30');
```

---

### 1.3 👷 Employee Outstanding Salary

**Step 1 — Create Roles** (can be done via app UI)

**Table:** `roles`

| Column | Type | Notes |
|--------|------|-------|
| `name` | text | Role name |
| `category` | enum | `DAILY` / `FIXED` / `LOADMEN` |
| `salary_value` | numeric | Daily rate or monthly salary |
| `minimum_requirement` | numeric (nullable) | Min bricks for DAILY |
| `active` | boolean | `true` |

**Step 2 — Create Employees** (can be done via app UI)

**Table:** `employees`

**Step 3 — Seed Outstanding Salary Balance (DB Only)**

To carry forward salary owed to an employee, insert an opening balance entry in `salary_ledger`:

**Table:** `salary_ledger`

| Column | Type | Value |
|--------|------|-------|
| `employee_id` | uuid | FK to employees |
| `entry_type` | text | `'SALARY_AUTO_ENTRY'` |
| `amount` | numeric | Outstanding salary amount |
| `running_balance` | numeric | Same as amount (first entry) |
| `payment_mode` | text | `null` |
| `sender_account_id` | uuid | `null` |
| `receiver_account` | text | `null` |
| `notes` | text | `'Opening balance carry forward'` |
| `created_at` | timestamptz | `2026-03-31T23:59:59+05:30` |

```sql
-- Example: Employee is owed ₹15,000 from before April 1
INSERT INTO salary_ledger (employee_id, entry_type, amount, running_balance, payment_mode, sender_account_id, receiver_account, notes, created_at)
VALUES
  ('<employee_uuid>', 'SALARY_AUTO_ENTRY', 15000, 15000, null, null, null, 'Opening balance carry forward', '2026-03-31T23:59:59+05:30');
```

> The `employee_with_balance` view reads the latest `running_balance` to show outstanding, so this entry becomes the starting point.

---

### 1.4 📦 Inventory Stock (Raw Materials)

**Table:** `inventory_stock`

| Column | Type | Notes |
|--------|------|-------|
| `material_id` | uuid | FK to `materials` |
| `quantity` | numeric | Current stock **in KG** |
| `updated_at` | timestamptz | `2026-04-01T00:00:00+05:30` |

> **Unit Conversions**: The app stores everything in KG internally.
> - Cement: 1 bag = 50 kg
> - Crusher Powder: 1 unit = 4500 kg  
> - Wet Ash / Marble Powder / Fly Ash: 1 ton = 1000 kg

First, check existing materials:
```sql
SELECT id, name, unit FROM materials ORDER BY name;
```

Then seed stock:
```sql
INSERT INTO inventory_stock (material_id, quantity, updated_at)
VALUES
  ('<wet_ash_id>', 50000, '2026-04-01T00:00:00+05:30'),       -- 50 tons
  ('<marble_powder_id>', 20000, '2026-04-01T00:00:00+05:30'),  -- 20 tons
  ('<crusher_powder_id>', 45000, '2026-04-01T00:00:00+05:30'), -- 10 units
  ('<fly_ash_id>', 30000, '2026-04-01T00:00:00+05:30'),        -- 30 tons
  ('<cement_id>', 5000, '2026-04-01T00:00:00+05:30');           -- 100 bags
```

---

### 1.5 🧱 Product Inventory (Bricks Ready Stock)

**Table:** `product_inventory`

| Column | Type | Value |
|--------|------|-------|
| `product_type` | text | `'BRICKS'` |
| `quantity` | int | Number of bricks in stock |
| `updated_at` | timestamptz | `2026-04-01T00:00:00+05:30` |

```sql
INSERT INTO product_inventory (product_type, quantity, updated_at)
VALUES ('BRICKS', 100000, '2026-04-01T00:00:00+05:30');
```

---

### 1.6 🏢 Vendor Outstanding Amounts

**Step 1 — Create Vendors** (can be done via app)

**Step 2 — Seed Outstanding via Dummy Procurement**

The `vendor_financials` view calculates outstanding as: `total procurement value (approved) - total payments`.

To carry forward vendor outstanding:

**Table:** `procurements`

| Column | Type | Value |
|--------|------|-------|
| `material_id` | uuid | Any valid material FK |
| `vendor_id` | uuid | FK to vendors |
| `quantity` | numeric | 0 |
| `rate_per_unit` | numeric | 0 |
| `total_price` | numeric | **The outstanding amount** |
| `total_paid` | numeric | 0 |
| `payment_status` | text | `'NOT_PAID'` |
| `date` | date | `2026-03-31` |
| `approved` | boolean | `true` |
| `created_by` | uuid | Admin user ID |
| `created_at` | timestamptz | `2026-03-31T00:00:00+05:30` |

```sql
-- Example: Vendor is owed ₹75,000
INSERT INTO procurements (material_id, vendor_id, quantity, rate_per_unit, total_price, total_paid, payment_status, date, approved, created_by, created_at)
VALUES
  ('<material_uuid>', '<vendor_uuid>', 0, 0, 75000, 0, 'NOT_PAID', '2026-03-31', true, '<admin_uuid>', '2026-03-31T00:00:00+05:30');
```

---

### 1.7 💰 Loans (Existing Loans)

**Table:** `loans`

| Column | Type | Value |
|--------|------|-------|
| `lender_name` | text | Lender name |
| `loan_type` | enum | `OWNER` / `BANK` / `SHORT_TERM` |
| `principal_amount` | numeric | Original loan amount |
| `interest_rate` | numeric (nullable) | Annual interest rate |
| `outstanding_balance` | numeric | **Current outstanding as of April 1** |
| `disbursement_account_id` | uuid (nullable) | Account where loan was received |
| `start_date` | date | Original loan start date |
| `status` | enum | `ACTIVE` |
| `notes` | text | Notes |
| `created_at` | timestamptz | Backdate |

**Also add a DISBURSEMENT entry in `loan_ledger`:**

```sql
-- 1. Create the loan
INSERT INTO loans (lender_name, loan_type, principal_amount, interest_rate, outstanding_balance, disbursement_account_id, start_date, status, notes, created_at)
VALUES ('SBI', 'BANK', 500000, 12.5, 350000, '<account_uuid>', '2025-06-01', 'ACTIVE', 'Carry forward loan', '2025-06-01T00:00:00+05:30')
RETURNING id;

-- 2. Create opening ledger entry
INSERT INTO loan_ledger (loan_id, transaction_type, amount, running_balance, payment_mode, sender_account_id, transaction_date, notes)
VALUES ('<loan_id>', 'DISBURSEMENT', 500000, 350000, 'BANK', '<account_uuid>', '2025-06-01', 'Opening balance carry forward');
```

> ⚠️ Do NOT increment the account balance for historical loans — the `opening_balance` of the account already accounts for this.

---

## 📋 SECTION 2: Data That CAN Be Entered via App UI

These items can be entered through the app normally after the DB seed:

| Data | Screen | Notes |
|------|--------|-------|
| **Roles** | Admin → Employees → Role Setup → Create Role | Create all roles first |
| **Employees** | Admin → Employees → Create Employee | After roles exist |
| **Vendors** | Admin → Vendors → Create Vendor | With material mapping |
| **Customers** | Admin → Customers (via order creation or customer modal) | Basic info only via app |
| **Materials** | N/A | Pre-seeded in `materials` table, usually static |
| **Expense Types & Subtypes** | Admin → Accounts → Create Expense | Created inline during expense creation |
| **Attendance** | Admin → Employees → Attendance | Date can be selected |
| **Production Entries** | Employee App → Production | Date selectable |
| **Procurements** | Employee App → Material Purchase | Date selectable, then admin approves |
| **Orders** | Admin → Orders → Create Order | See note below ⚠️ |
| **Expenses** | Admin → Accounts → Create Expense | Date selectable |

---

## ⚠️ SECTION 3: Can the Client Create an Order Today and Mark It Delivered on a Previous Date?

### Current App Behavior:

1. **Order Creation** (`CreateOrderScreen`):
   - `order_date` is **auto-set to today** (`new Date().toISOString().split('T')[0]`) and displayed as **read-only**. The client cannot change the order date.
   - `delivery_date` is a date picker — the client CAN pick a past date.

2. **Order Details / Delivery** (`OrderDetailsScreen`):
   - The `delivery_date` field is editable on undelivered orders.
   - The `delivered` flag is set when loadmen are assigned and the order is updated.
   - Once delivered, the order becomes **read-only**.

3. **Data Implications of Backdating Delivery**:
   - The `customer_financials` view uses `delivery_date` for filtering delivered orders.
   - `Accounts Income` screen filters by `delivery_date` — so a backdated delivery will show in the correct period.
   - `product_inventory` is deducted at delivery time using current stock — backdating the date doesn't change the stock deduction timing.

### ✅ Answer: **Partially Yes, with Caveats**

| Aspect | Works? | Notes |
|--------|--------|-------|
| Create order with past delivery date | ✅ Yes | delivery_date is a free date picker |
| Order shows in correct date range for reports | ✅ Yes | Filtered by delivery_date |
| order_date reflects actual creation | ⚠️ No | order_date is always "today", not editable |
| Product inventory deducted correctly | ⚠️ Timing | Bricks deducted from current stock at delivery time, not the backdated date |
| Customer outstanding updated | ✅ Yes | Calculated from delivered orders regardless of dates |
| Cash flow / accounts accurate for that date | ⚠️ No | Payments on order (amount_paid) don't flow through cash ledger automatically — only explicit customer payments do |

### Recommendation for Historical Orders:

For orders that were **already delivered before April 1st**, insert them directly in DB with both `order_date`, `delivery_date`, and `delivered = true` set to historical dates. For the outstanding, follow Section 1.2.

For orders **placed before April 1st but delivering after**, create them in DB with historical `order_date`, future `delivery_date`, and `delivered = false`.

---

## 📋 SECTION 4: Seed Execution Order

Execute in this exact order to satisfy foreign key constraints:

| Step | Table | Method |
|------|-------|--------|
| 1 | `materials` | Check if pre-seeded; add if missing |
| 2 | `accounts` | SQL insert (including Cash account) |
| 3 | `roles` | App UI or SQL |
| 4 | `employees` | App UI or SQL |
| 5 | `salary_ledger` | SQL (opening balances only) |
| 6 | `vendors` | App UI or SQL |
| 7 | `vendor_materials` | SQL if vendors created via SQL |
| 8 | `customers` | App UI or SQL |
| 9 | `orders` | SQL (historical/outstanding carry forward) |
| 10 | `procurements` | SQL (vendor outstanding carry forward) |
| 11 | `inventory_stock` | SQL (raw material opening stock) |
| 12 | `product_inventory` | SQL (bricks opening stock) |
| 13 | `loans` + `loan_ledger` | SQL (existing loans) |
| 14 | `expense_types` + `expense_subtypes` | App UI or SQL |
| 15 | `attendance` | App UI (backdate daily from April 1) |

---

## ✅ Post-Seed Verification Checklist

After seeding, verify these in the app:

- [ ] Cash account shows correct balance
- [ ] Bank accounts show correct balances
- [ ] Customer Management → each customer shows correct outstanding
- [ ] Vendor Ledger → each vendor shows correct outstanding
- [ ] Inventory Management → raw materials show correct KG values
- [ ] Inventory Management → bricks count matches
- [ ] Salary Ledger → each employee shows correct running balance
- [ ] Loan Management → each loan shows correct outstanding balance
- [ ] Accounts screen → Financial Summary shows correct totals
- [ ] Cash Flow screen → shows entries from April 1 onwards
- [ ] Metrics screen → reports show data from April 1 onwards
