# 🗑️ Database Deletion & Reversal Guide

> **Purpose**: When data needs to be removed or corrected manually from the database, this guide covers every entity, its dependencies, and the exact steps to safely delete or alter records without leaving orphan data or broken balances.

---

## ⚠️ General Rules

1. **Always take a DB backup before manual deletions.**
2. **Disable RLS temporarily** if you get permission errors on direct SQL.
3. **Order matters** — delete child records before parent records (foreign key constraints).
4. **Recalculate running balances** after deleting ledger entries.
5. **Check views** — views like `customer_financials`, `vendor_financials`, `employee_with_balance`, `customer_order_settlement` are auto-computed; they update when underlying tables change.

---

## 1. 🛒 Delete an Order

### Tables Affected:
| Table | Action |
|-------|--------|
| `order_loadmen` | Delete all loadmen rows for this order |
| `order_payment_settlements` | Delete settlement rows (if FIFO was applied) |
| `orders` | Delete the order row |
| `product_inventory` | Restore bricks if order was delivered |

### Steps:

```sql
-- 1. Get the order details first
SELECT id, customer_id, brick_quantity, delivered, final_price, amount_paid, payment_status
FROM orders WHERE id = '<order_id>';

-- 2. Delete loadmen assignments
DELETE FROM order_loadmen WHERE order_id = '<order_id>';

-- 3. Delete payment settlements (if any customer payments were applied to this order)
DELETE FROM order_payment_settlements WHERE order_id = '<order_id>';

-- 4. If the order was DELIVERED, restore bricks to product_inventory
UPDATE product_inventory
SET quantity = quantity + <brick_quantity>,
    updated_at = NOW()
WHERE product_type = 'BRICKS';

-- 5. Delete the order
DELETE FROM orders WHERE id = '<order_id>';
```

> ⚠️ After deleting an order with payments settled against it, you may need to re-run FIFO settlement for the customer's remaining orders. Check `customer_order_settlement` view.

---

## 2. 💳 Delete a Customer Payment

### Option A: Use the App's Built-in Delete (Recommended)
The app has `deleteCustomerPayment()` which calls the `reverse_customer_payment` RPC. This:
- Reverses FIFO settlements
- Restores account balance
- Deletes the payment row

### Option B: Manual DB Deletion

### Tables Affected:
| Table | Action |
|-------|--------|
| `order_payment_settlements` | Delete settlements linked to this payment |
| `customer_payments` | Delete the payment row |
| `accounts` | Restore account balance |
| `orders` | Recalculate `amount_paid` and `payment_status` |

```sql
-- 1. Get payment details
SELECT id, customer_id, amount, receiver_account_id
FROM customer_payments WHERE id = '<payment_id>';

-- 2. Delete settlements linked to this payment
DELETE FROM order_payment_settlements WHERE payment_id = '<payment_id>';

-- 3. Restore account balance
UPDATE accounts
SET balance = balance - <payment_amount>
WHERE id = '<receiver_account_id>';

-- 4. Delete the payment
DELETE FROM customer_payments WHERE id = '<payment_id>';

-- 5. Recalculate payment_status on affected orders
-- (Check customer_order_settlement view to see which orders need updating)
-- For each affected order:
UPDATE orders
SET amount_paid = COALESCE((
    SELECT SUM(settled_amount) FROM order_payment_settlements WHERE order_id = orders.id
), 0),
payment_status = CASE
    WHEN COALESCE((SELECT SUM(settled_amount) FROM order_payment_settlements WHERE order_id = orders.id), 0) = 0 THEN 'NOT_PAID'
    WHEN COALESCE((SELECT SUM(settled_amount) FROM order_payment_settlements WHERE order_id = orders.id), 0) >= orders.final_price THEN 'FULLY_PAID'
    ELSE 'PARTIALLY_PAID'
END
WHERE customer_id = '<customer_id>' AND delivered = true;
```

---

## 3. 👤 Delete a Customer

### Tables Affected (in deletion order):
| Table | Action |
|-------|--------|
| `order_payment_settlements` | Delete all settlements for customer's orders |
| `order_loadmen` | Delete loadmen for customer's orders |
| `customer_payments` | Delete all payments |
| `orders` | Delete all orders |
| `customers` | Delete the customer |
| `accounts` | Restore balances from payments |
| `product_inventory` | Restore bricks from delivered orders |

```sql
-- 1. Get all order IDs for this customer
SELECT id, brick_quantity, delivered FROM orders WHERE customer_id = '<customer_id>';

-- 2. Delete order payment settlements
DELETE FROM order_payment_settlements
WHERE order_id IN (SELECT id FROM orders WHERE customer_id = '<customer_id>');

-- 3. Delete order loadmen
DELETE FROM order_loadmen
WHERE order_id IN (SELECT id FROM orders WHERE customer_id = '<customer_id>');

-- 4. Restore account balances from customer payments
-- (Get total per account first)
SELECT receiver_account_id, SUM(amount) as total
FROM customer_payments
WHERE customer_id = '<customer_id>'
GROUP BY receiver_account_id;

-- For each account:
UPDATE accounts SET balance = balance - <total> WHERE id = '<account_id>';

-- 5. Delete customer payments
DELETE FROM customer_payments WHERE customer_id = '<customer_id>';

-- 6. Restore bricks from delivered orders
UPDATE product_inventory
SET quantity = quantity + (
    SELECT COALESCE(SUM(brick_quantity), 0)
    FROM orders
    WHERE customer_id = '<customer_id>' AND delivered = true
),
updated_at = NOW()
WHERE product_type = 'BRICKS';

-- 7. Delete orders
DELETE FROM orders WHERE customer_id = '<customer_id>';

-- 8. Delete customer
DELETE FROM customers WHERE id = '<customer_id>';
```

---

## 4. 👷 Delete an Employee

### Tables Affected:
| Table | Action |
|-------|--------|
| `salary_ledger` | Delete all salary ledger entries |
| `attendance` | Delete all attendance records |
| `order_loadmen` | Delete loadman assignments |
| `employees` | Delete the employee |

> ⚠️ **Preferred approach**: Instead of deleting, **deactivate** the employee: `UPDATE employees SET active = false WHERE id = '<id>'`. The app supports active/inactive views.

```sql
-- If you must delete completely:

-- 1. Restore account balances from salary payments
SELECT sender_account_id, SUM(amount) as total
FROM salary_ledger
WHERE employee_id = '<employee_id>'
  AND entry_type NOT IN ('SALARY_AUTO_ENTRY', 'AUTO')
  AND sender_account_id IS NOT NULL
GROUP BY sender_account_id;

-- For each account:
UPDATE accounts SET balance = balance + <total> WHERE id = '<account_id>';

-- 2. Delete salary ledger entries
DELETE FROM salary_ledger WHERE employee_id = '<employee_id>';

-- 3. Delete attendance records
DELETE FROM attendance WHERE employee_id = '<employee_id>';

-- 4. Remove from order loadmen
DELETE FROM order_loadmen WHERE employee_id = '<employee_id>';

-- 5. Delete employee
DELETE FROM employees WHERE id = '<employee_id>';
```

---

## 5. 🏗️ Delete a Vendor

### Tables Affected:
| Table | Action |
|-------|--------|
| `vendor_payment_settlements` | Delete payment settlements |
| `vendor_payments` | Delete payments (restore account balances) |
| `procurements` | Delete all procurements (restore inventory if approved) |
| `vendor_materials` | Delete material mappings |
| `vendors` | Delete the vendor |

```sql
-- 1. Restore account balances from vendor payments
SELECT sender_account_id, SUM(amount) as total
FROM vendor_payments
WHERE vendor_id = '<vendor_id>'
GROUP BY sender_account_id;

-- For each account:
UPDATE accounts SET balance = balance + <total> WHERE id = '<account_id>';

-- 2. Delete vendor payment settlements
DELETE FROM vendor_payment_settlements
WHERE payment_id IN (SELECT id FROM vendor_payments WHERE vendor_id = '<vendor_id>');

-- 3. Delete vendor payments
DELETE FROM vendor_payments WHERE vendor_id = '<vendor_id>';

-- 4. Reverse inventory additions from approved procurements
-- Get total KG added per material from approved procurements
SELECT p.material_id, m.name,
       SUM(CASE
           WHEN LOWER(m.name) LIKE '%cement%' THEN p.quantity * 50
           WHEN LOWER(m.name) LIKE '%crusher%' THEN p.quantity * 4500
           ELSE p.quantity * 1000
       END) as total_kg_added
FROM procurements p
JOIN materials m ON m.id = p.material_id
WHERE p.vendor_id = '<vendor_id>' AND p.approved = true
GROUP BY p.material_id, m.name;

-- For each material:
UPDATE inventory_stock
SET quantity = quantity - <total_kg_added>,
    updated_at = NOW()
WHERE material_id = '<material_id>';

-- 5. Delete procurements
DELETE FROM procurements WHERE vendor_id = '<vendor_id>';

-- 6. Delete vendor-material mappings
DELETE FROM vendor_materials WHERE vendor_id = '<vendor_id>';

-- 7. Delete vendor
DELETE FROM vendors WHERE id = '<vendor_id>';
```

---

## 6. 💳 Delete a Vendor Payment

### Option A: Use App's Built-in Delete (Recommended)
The app has `deleteVendorPayment()` which calls `reverse_vendor_payment` RPC.

### Option B: Manual Deletion

```sql
-- 1. Get payment details
SELECT id, vendor_id, amount, sender_account_id
FROM vendor_payments WHERE id = '<payment_id>';

-- 2. Delete payment settlements
DELETE FROM vendor_payment_settlements WHERE payment_id = '<payment_id>';

-- 3. Restore account balance
UPDATE accounts
SET balance = balance + <payment_amount>
WHERE id = '<sender_account_id>';

-- 4. Delete payment
DELETE FROM vendor_payments WHERE id = '<payment_id>';

-- 5. Recalculate procurement payment status for this vendor
-- (Check vendor_financials view to verify)
```

---

## 7. 📦 Delete a Procurement

### Tables Affected:
| Table | Action |
|-------|--------|
| `vendor_payment_settlements` | Delete settlements linked to this procurement |
| `procurements` | Delete the procurement |
| `inventory_stock` | Reverse stock addition if it was approved |

```sql
-- 1. Get procurement details
SELECT id, material_id, quantity, approved, total_price, vendor_id
FROM procurements WHERE id = '<procurement_id>';

-- Also get the material name for conversion:
SELECT name FROM materials WHERE id = '<material_id>';

-- 2. If APPROVED, reverse inventory stock addition
-- Convert quantity back to KG based on material type:
--   Cement: quantity * 50
--   Crusher: quantity * 4500
--   Others (Wet Ash, Marble, Fly Ash): quantity * 1000
UPDATE inventory_stock
SET quantity = quantity - <quantity_in_kg>,
    updated_at = NOW()
WHERE material_id = '<material_id>';

-- 3. Delete payment settlements for this procurement
DELETE FROM vendor_payment_settlements WHERE procurement_id = '<procurement_id>';

-- 4. Delete the procurement
DELETE FROM procurements WHERE id = '<procurement_id>';
```

---

## 8. 🏭 Delete a Production Entry

### Tables Affected:
| Table | Action |
|-------|--------|
| `production_entries` | Delete the entry |
| `product_inventory` | Reverse bricks addition |
| `inventory_stock` | Reverse raw material deductions |

```sql
-- 1. Get the production entry
SELECT id, bricks, wet_ash_kg, marble_powder_kg, crusher_powder_kg, fly_ash_kg, cement_bags
FROM production_entries WHERE id = '<entry_id>';

-- 2. Reverse bricks from product_inventory
UPDATE product_inventory
SET quantity = quantity - <bricks>,
    updated_at = NOW()
WHERE product_type = 'BRICKS';

-- 3. Restore raw materials to inventory_stock
-- Get material IDs
SELECT id, name FROM materials;

-- Restore each material (cement_bags converted: bags * 50 = kg)
UPDATE inventory_stock SET quantity = quantity + <wet_ash_kg> WHERE material_id = '<wet_ash_material_id>';
UPDATE inventory_stock SET quantity = quantity + <marble_powder_kg> WHERE material_id = '<marble_material_id>';
UPDATE inventory_stock SET quantity = quantity + <crusher_powder_kg> WHERE material_id = '<crusher_material_id>';
UPDATE inventory_stock SET quantity = quantity + <fly_ash_kg> WHERE material_id = '<fly_ash_material_id>';
UPDATE inventory_stock SET quantity = quantity + (<cement_bags> * 50) WHERE material_id = '<cement_material_id>';

-- 4. Delete the production entry
DELETE FROM production_entries WHERE id = '<entry_id>';
```

---

## 9. 💰 Delete a Loan

### Tables Affected:
| Table | Action |
|-------|--------|
| `loan_ledger` | Delete all ledger entries |
| `loans` | Delete the loan |
| `accounts` | Restore/reverse account balance changes |

```sql
-- 1. Get all loan ledger entries
SELECT id, transaction_type, amount, payment_mode, sender_account_id
FROM loan_ledger WHERE loan_id = '<loan_id>'
ORDER BY created_at;

-- 2. For DISBURSEMENT entries: Deduct from account (money was added during loan creation)
-- For REPAYMENT entries: Restore to account (money was deducted during repayment)
-- For INTEREST entries: Restore to account (money was deducted during interest payment)

-- Reverse disbursements (deduct from account):
UPDATE accounts SET balance = balance - <disbursement_amount>
WHERE id = '<disbursement_account_id>';

-- Reverse repayments (restore to account):
UPDATE accounts SET balance = balance + <repayment_amount>
WHERE id = '<sender_account_id>';

-- Reverse interest payments (restore to account):
UPDATE accounts SET balance = balance + <interest_amount>
WHERE id = '<sender_account_id>';

-- 3. Delete loan ledger entries
DELETE FROM loan_ledger WHERE loan_id = '<loan_id>';

-- 4. Delete the loan
DELETE FROM loans WHERE id = '<loan_id>';
```

---

## 10. 💸 Delete a Loan Ledger Transaction

```sql
-- 1. Get the transaction
SELECT id, loan_id, transaction_type, amount, running_balance, sender_account_id
FROM loan_ledger WHERE id = '<ledger_id>';

-- 2. Reverse account impact
-- REPAYMENT or INTEREST: Restore balance to sender account
UPDATE accounts SET balance = balance + <amount>
WHERE id = '<sender_account_id>';

-- 3. Update loan outstanding balance
-- REPAYMENT: Add amount back to outstanding
UPDATE loans SET outstanding_balance = outstanding_balance + <amount>,
               status = 'ACTIVE'
WHERE id = '<loan_id>';

-- INTEREST: No change to outstanding (interest doesn't affect principal)

-- 4. Delete the ledger entry
DELETE FROM loan_ledger WHERE id = '<ledger_id>';

-- 5. Recalculate running_balance for all subsequent entries
-- (Must be done sequentially)
```

---

## 11. 💸 Delete an Expense

### Option A: Use App's Built-in Delete (Recommended)
The app has `deleteExpense()` which reverses account deduction and deletes the row.

### Option B: Manual Deletion

```sql
-- 1. Get expense details
SELECT id, amount, payment_mode, sender_account_id
FROM expenses WHERE id = '<expense_id>';

-- 2. Determine account to restore
-- If payment_mode = 'CASH': restore to Cash account
-- Otherwise: restore to sender_account_id
UPDATE accounts
SET balance = balance + <amount>
WHERE id = '<account_to_restore>';

-- 3. Delete the expense
DELETE FROM expenses WHERE id = '<expense_id>';
```

---

## 12. 👷 Delete a Salary Ledger Entry

### Tables Affected:
| Table | Action |
|-------|--------|
| `salary_ledger` | Delete the entry |
| `accounts` | Restore balance if it was a payment |

```sql
-- 1. Get the entry
SELECT id, employee_id, entry_type, amount, running_balance, payment_mode, sender_account_id
FROM salary_ledger WHERE id = '<ledger_id>';

-- 2. If entry_type is a PAYMENT type (not 'AUTO' or 'SALARY_AUTO_ENTRY'):
--    Restore account balance
--    If payment_mode = 'CASH': restore to Cash account
--    Otherwise: restore to sender_account_id
UPDATE accounts
SET balance = balance + <amount>
WHERE id = '<account_to_restore>';

-- 3. Delete the entry
DELETE FROM salary_ledger WHERE id = '<ledger_id>';

-- 4. ⚠️ CRITICAL: Recalculate running_balance for ALL subsequent entries
--    Get all entries after the deleted one, ordered by created_at
--    Recalculate sequentially:
--    - SALARY_AUTO_ENTRY/AUTO: running_balance = previous_balance + amount
--    - Payment types: running_balance = previous_balance - amount

WITH ordered AS (
    SELECT id, entry_type, amount,
           ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM salary_ledger
    WHERE employee_id = '<employee_id>'
    ORDER BY created_at
)
-- You'll need to do this programmatically or use a recursive CTE
-- to recalculate running balances sequentially.
```

---

## 13. 📅 Delete Attendance Records

```sql
-- Delete specific employee's attendance for a date
DELETE FROM attendance
WHERE employee_id = '<employee_id>'
  AND date = '2026-04-05';

-- Delete all attendance for a date
DELETE FROM attendance WHERE date = '2026-04-05';
```

> ⚠️ If salary has already been generated (`salary_batches`) for a month that includes these attendance records, you may also need to reverse the salary batch.

---

## 14. 💰 Delete/Reverse a Salary Batch

```sql
-- 1. Get the batch
SELECT id, month FROM salary_batches WHERE month = '2026-04';

-- 2. Get all salary_auto_entries created by this batch
SELECT id, employee_id, amount
FROM salary_ledger
WHERE entry_type = 'SALARY_AUTO_ENTRY'
  AND created_at >= '<batch_created_at>'
  AND notes LIKE '%salary%';

-- 3. For each entry, recalculate subsequent running balances (see Section 12)

-- 4. Delete the salary ledger entries
DELETE FROM salary_ledger
WHERE entry_type = 'SALARY_AUTO_ENTRY'
  AND employee_id IN (SELECT employee_id FROM salary_batch_items WHERE batch_id = '<batch_id>');

-- 5. Delete batch items
DELETE FROM salary_batch_items WHERE batch_id = '<batch_id>';

-- 6. Delete the batch
DELETE FROM salary_batches WHERE id = '<batch_id>';
```

---

## 15. 📊 Delete an Inventory Adjustment

```sql
-- 1. Get the adjustment
SELECT * FROM inventory_adjustments WHERE id = '<adjustment_id>';

-- 2. This is complex — the adjustment overwrote actual values.
--    You need to restore the values that existed BEFORE the adjustment.
--    The adjustment record stores `actual_*` values (what was there before)
--    and `adjusted_*` values (what it was changed to).

-- Restore bricks
UPDATE product_inventory
SET quantity = <actual_bricks>,  -- from the adjustment record
    updated_at = NOW()
WHERE product_type = 'BRICKS';

-- Restore each raw material (actual values from adjustment record)
-- Note: cement is stored in bags in adjustment, but KG in inventory_stock
UPDATE inventory_stock SET quantity = <actual_wet_ash_kg> WHERE material_id = '<wet_ash_id>';
UPDATE inventory_stock SET quantity = <actual_marble_powder_kg> WHERE material_id = '<marble_id>';
UPDATE inventory_stock SET quantity = <actual_crusher_powder_kg> WHERE material_id = '<crusher_id>';
UPDATE inventory_stock SET quantity = <actual_fly_ash_kg> WHERE material_id = '<fly_ash_id>';
UPDATE inventory_stock SET quantity = <actual_cement_bags> * 50 WHERE material_id = '<cement_id>';

-- 3. Delete the adjustment record
DELETE FROM inventory_adjustments WHERE id = '<adjustment_id>';
```

---

## 16. 🏷️ Delete a Role

> ⚠️ **Preferred approach**: Deactivate instead of delete: `UPDATE roles SET active = false WHERE id = '<id>'`

If you must delete:

```sql
-- 1. Check if any employees use this role
SELECT COUNT(*) FROM employees WHERE role_id = '<role_id>';

-- 2. If employees exist, you CANNOT delete (FK constraint).
--    Either reassign employees to a different role first, or deactivate.

-- 3. If no employees use it:
DELETE FROM roles WHERE id = '<role_id>';
```

---

## 17. Delete Expense Types / Subtypes

```sql
-- 1. Check if any expenses reference this type
SELECT COUNT(*) FROM expenses WHERE type_id = '<type_id>';

-- 2. If expenses exist, you cannot delete (reassign or delete expenses first)

-- 3. Delete subtypes first
DELETE FROM expense_subtypes WHERE type_id = '<type_id>';

-- 4. Delete type
DELETE FROM expense_types WHERE id = '<type_id>';
```

---

## 📊 Quick Reference: Entity Dependency Map

```
customers
  └── orders
        ├── order_loadmen
        └── order_payment_settlements
  └── customer_payments
        └── order_payment_settlements

vendors
  ├── vendor_materials
  ├── procurements
  │     └── vendor_payment_settlements
  └── vendor_payments
        └── vendor_payment_settlements

employees
  ├── salary_ledger
  ├── attendance
  ├── order_loadmen
  └── salary_batch_items

roles
  └── employees

materials
  ├── vendor_materials
  ├── procurements
  └── inventory_stock

loans
  └── loan_ledger

accounts
  ├── customer_payments (receiver_account_id)
  ├── vendor_payments (sender_account_id)
  ├── expenses (sender_account_id)
  ├── salary_ledger (sender_account_id)
  └── loan_ledger (sender_account_id)

expense_types
  └── expense_subtypes
        └── expenses

product_inventory (standalone - BRICKS)
inventory_adjustments (standalone - log)
salary_batches
  └── salary_batch_items
```

---

## 🔄 DB Views (Auto-Computed — No Manual Updates Needed)

| View | Computed From |
|------|---------------|
| `customer_financials` | `customers` + `orders` (delivered) + `customer_payments` |
| `customer_order_settlement` | `orders` + `order_payment_settlements` |
| `customer_payments_view` | `customer_payments` + `accounts` |
| `vendor_financials` | `vendors` + `procurements` (approved) + `vendor_payments` |
| `employee_with_balance` | `employees` + `salary_ledger` (latest running_balance) + `roles` |

> These views automatically reflect changes when underlying tables are modified. No need to update them directly.
