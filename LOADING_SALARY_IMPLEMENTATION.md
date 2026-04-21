# Loading/Unloading Salary Enhancement - Implementation Plan

## Overview
This document tracks the implementation of per-brick salary calculation for loading/unloading work.

## Current Status: Phase 1 - UI Changes (Safe for Production)

### ✅ Completed
- [x] Created `src/utils/loadmenSalary.ts` utility
- [x] Updated `src/services/types.ts` with new types
- [x] Updated `src/employee/hooks/useDelivery.ts` - New salary calculation
- [x] Updated `src/services/middleware.service.ts` - getLoadmen() returns ALL employees
- [x] Updated `src/admin/validators/createRole.validator.ts` - Skip Loadmen salary validation
- [x] Updated `src/admin/hooks/useCreateRole.ts` - Set salary_value=0 for Loadmen
- [x] Updated `src/admin/hooks/useEditRole.ts` - Set salary_value=0 for Loadmen
- [x] Updated `src/admin/pages/employees/pages/CreateRoleScreen.tsx` - Hide salary field
- [x] Updated `src/admin/pages/employees/pages/EditRoleScreen.tsx` - Hide salary field

### 🔄 In Progress - Next Steps

#### Manual Updates Required (See ORDER_SCREENS_UPDATE_GUIDE.md)
- [ ] `src/admin/pages/orders/pages/CreateOrderScreen.tsx` - Add loading type selector + show all employees
- [ ] `src/admin/pages/orders/pages/OrderDetailsScreen.tsx` - Add loading type selector + show all employees

### ⏳ Phase 2 - Database Migration (To Do Later)
- [ ] Run database migration script on production
- [ ] Verify `app_settings` table created
- [ ] Verify `loading_type` column added to orders
- [ ] Create Settings screen for per-brick rate management

## Implementation Strategy

### Phase 1: UI Only (Current - Safe to deploy)
1. All UI changes work with existing DB structure
2. `loading_type` defaults to 'LOADING_UNLOADING' in code
3. Per-brick rate hardcoded temporarily (e.g., 0.50)
4. Loadmen roles can still have salary_value in DB (UI just hides it)

### Phase 2: Database Migration (After UI tested)
1. Run migration on production during low-traffic period
2. Add `app_settings` table
3. Add `loading_type` column to orders
4. Update existing Loadmen roles
5. Deploy Settings screen

## Key Changes Summary

### Salary Calculation Logic
**Old:** Fixed rate per delivery from `roles.salary_value`
```typescript
// Each loadman gets: roles.salary_value
amount = loadman.roles.salary_value
```

**New:** Per-brick calculation with equal division
```typescript
// All selected employees (Loadmen + Others) share equally
totalAmount = perBrickRate × brickQuantity × multiplier
amountPerPerson = totalAmount / numberOfEmployees
```

### Loading Types
1. **LOADING_UNLOADING** - Full rate (100%)
2. **LOADING_ONLY** - Half rate (50%)  
3. **CUSTOMER_SELF** - No salary calculation

### Employee Selection
**Old:** Only Loadmen category employees shown
**New:** ALL active employees shown with badges:
- 🟢 "Loadman" badge for Loadmen category
- 🔵 "+ Extra Pay" badge for other categories

## Testing Checklist

### Test Scenarios
- [ ] **Scenario 1:** 5000 bricks, 3 Loadmen, Loading & Unloading
  - Expected: ₹0.50 × 5000 ÷ 3 = ₹833.33 each
  
- [ ] **Scenario 2:** 5000 bricks, 2 Drivers, Loading Only
  - Expected: (₹0.50 × 5000 × 0.5) ÷ 2 = ₹625 each
  
- [ ] **Scenario 3:** 5000 bricks, 2 Loadmen + 1 Driver, Loading & Unloading
  - Expected: ₹0.50 × 5000 ÷ 3 = ₹833.33 each (all equal)
  
- [ ] **Scenario 4:** Customer Self Loading
  - Expected: No employees selectable, no salary calculation

### Salary Ledger Verification
- [ ] Loadmen entries: Category check, note says "Loadmen work"
- [ ] Non-Loadmen entries: Category check, note says "Additional loading work"
- [ ] Amount calculation matches expected formula
- [ ] Non-Loadmen also get regular attendance salary separately

## Rollback Plan

If issues occur, can revert to old logic:
1. Restore old `useDelivery.ts` (use git history)
2. Restore old `getLoadmen()` to filter by category
3. Existing DB structure unchanged, so safe

## Notes

- **Current Per-Brick Rate:** Hardcoded as ₹0.50 (will be configurable after Phase 2)
- **Backward Compatibility:** Loading type defaults to 'LOADING_UNLOADING' if not set
- **Loadmen Role Salary:** Can keep existing salary_value in DB for now, UI just hides it
- **Production Safety:** All Phase 1 changes are non-breaking

## Contact & Support

If issues arise during implementation, check:
1. Console logs for calculation details
2. Salary ledger entries match expected amounts  
3. All employees show in order creation (not just Loadmen)
4. Role creation still works for all categories
