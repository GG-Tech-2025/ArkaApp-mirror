# Order Screen Updates - Detailed Guide

## Files to Update

### 1. CreateOrderScreen.tsx
### 2. OrderDetailsScreen.tsx

---

## Changes for CreateOrderScreen.tsx

### A. Update Imports (Top of file)

```typescript
// ADD these imports
import { LoadingType } from '../../../../services/types';
import { Info } from 'lucide-react';
```

### B. Update CreateOrderInput Interface (Around line 15)

**FIND:**
```typescript
export interface CreateOrderInput {
  customerId: string;
  customerName: string;
  customerPhone: string;
  brickQuantity: number;
  deliveryDate: string;
  pricePerBrick: number;
  location: string;
  finalPrice: number;
  paymentStatus: 'NOT_PAID' | 'PARTIALLY_PAID' | 'FULLY_PAID';
  amountPaid: number;
  gstNumber: string | null;
  deliveryChallanNumber: string;
  loadMen: string[];
}
```

**REPLACE WITH:**
```typescript
export interface CreateOrderInput {
  customerId: string;
  customerName: string;
  customerPhone: string;
  brickQuantity: number;
  deliveryDate: string;
  pricePerBrick: number;
  location: string;
  finalPrice: number;
  paymentStatus: 'NOT_PAID' | 'PARTIALLY_PAID' | 'FULLY_PAID';
  amountPaid: number;
  gstNumber: string | null;
  deliveryChallanNumber: string;
  loadMen: string[];
  loadingType: LoadingType; // NEW
}
```

### C. Update Initial State (Around line 50)

**FIND the useState initialization and ADD:**
```typescript
const [createOrderInput, setCreateOrderInput] = useState<CreateOrderInput>({
  customerId: '',
  customerName: '',
  customerPhone: '',
  brickQuantity: 0,
  deliveryDate: '',
  pricePerBrick: 0,
  location: '',
  finalPrice: 0,
  paymentStatus: 'NOT_PAID',
  amountPaid: 0,
  gstNumber: null,
  deliveryChallanNumber: '',
  loadMen: [],
  loadingType: 'LOADING_UNLOADING', // ADD THIS LINE
});
```

### D. Find Loadmen Section in JSX (Search for "Load Men" or "loadMen")

**BEFORE the loadmen selection, ADD this Loading Type selector:**

```tsx
{/* Loading Type Selection - NEW */}
<div>
  <label className="block text-gray-700 mb-2 font-medium">
    Loading Type <span className="text-red-600">*</span>
  </label>
  <select
    value={createOrderInput.loadingType}
    onChange={(e) => {
      const type = e.target.value as LoadingType;
      setCreateOrderInput(prev => ({
        ...prev,
        loadingType: type,
        // Clear loadmen if customer self loading
        loadMen: type === 'CUSTOMER_SELF' ? [] : prev.loadMen
      }));
    }}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="LOADING_UNLOADING">Loading & Unloading (Company)</option>
    <option value="LOADING_ONLY">Loading Only (Company)</option>
    <option value="CUSTOMER_SELF">Customer Self Loading</option>
  </select>
  
  {/* Info about rates */}
  <div className="mt-2 text-sm text-gray-600 flex items-start gap-2">
    <Info className="w-4 h-4 mt-0.5 shrink-0" />
    <div>
      {createOrderInput.loadingType === 'LOADING_UNLOADING' && (
        <span>Full rate: Per-brick rate × quantity (100%)</span>
      )}
      {createOrderInput.loadingType === 'LOADING_ONLY' && (
        <span>Half rate: Per-brick rate × quantity × 50%</span>
      )}
      {createOrderInput.loadingType === 'CUSTOMER_SELF' && (
        <span>No loading charges - Customer handles loading/unloading</span>
      )}
    </div>
  </div>
</div>
```

### E. Update Loadmen Section (Wrap with conditional)

**FIND the loadmen selection section and WRAP it:**

```tsx
{/* Load Men Selection - UPDATED to be conditional */}
{createOrderInput.loadingType !== 'CUSTOMER_SELF' && (
  <div>
    <label className="block text-gray-700 mb-2 font-medium">
      Select Employees for Loading/Unloading
      <span className="text-red-600">*</span>
    </label>

    {/* EXISTING loadmen mapping code stays here, but UPDATE each item: */}
    {loadmen.map((employee) => {
      const isLoadmenCategory = employee.roles?.category === 'LOADMEN';
      const isSelected = createOrderInput.loadMen.includes(employee.id);
      
      return (
        <label
          key={employee.id}
          className={`flex items-center gap-3 p-3 mb-2 rounded-lg border-2 cursor-pointer transition-all ${
            isSelected 
              ? 'bg-blue-50 border-blue-500' 
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              if (e.target.checked) {
                setCreateOrderInput(prev => ({
                  ...prev,
                  loadMen: [...prev.loadMen, employee.id]
                }));
              } else {
                setCreateOrderInput(prev => ({
                  ...prev,
                  loadMen: prev.loadMen.filter(id => id !== employee.id)
                }));
              }
            }}
            className="w-5 h-5 text-blue-600"
          />
          
          <div className="flex-1">
            <div className="font-medium text-gray-900">{employee.name}</div>
            <div className="text-sm text-gray-600">
              {employee.roles?.name}
              {employee.phone && (
                <span className="ml-2 text-gray-500">• {employee.phone}</span>
              )}
            </div>
          </div>
          
          {/* ADD BADGES */}
          {isLoadmenCategory ? (
            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              Loadman
            </span>
          ) : (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
              + Extra Pay
            </span>
          )}
        </label>
      );
    })}

    {/* ADD INFO MESSAGE */}
    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-sm text-blue-800">
        💡 <strong>Payment Info:</strong> All selected employees receive equal payment for loading work.
        Non-Loadmen employees get this as additional compensation beyond their regular salary.
      </p>
    </div>

    {/* Show selected count */}
    {createOrderInput.loadMen.length > 0 && (
      <p className="mt-2 text-sm text-gray-600">
        {createOrderInput.loadMen.length} employee{createOrderInput.loadMen.length > 1 ? 's' : ''} selected
      </p>
    )}
  </div>
)}
```

### F. Update Form Submission

**FIND the handleCreate or form submission function and ensure loadingType is included:**

```typescript
const orderData = {
  customer_id: createOrderInput.customerId,
  brick_quantity: createOrderInput.brickQuantity,
  delivery_date: createOrderInput.deliveryDate,
  price_per_brick: createOrderInput.pricePerBrick,
  location: createOrderInput.location,
  final_price: createOrderInput.finalPrice,
  payment_status: createOrderInput.paymentStatus,
  amount_paid: createOrderInput.amountPaid,
  gst_number: createOrderInput.gstNumber,
  dc_number: createOrderInput.deliveryChallanNumber,
  loading_type: createOrderInput.loadingType, // ADD THIS
  created_by: user?.id,
  // ...rest of fields
};
```

---

## Changes for OrderDetailsScreen.tsx

### Similar changes as CreateOrderScreen:

1. **Add imports:** LoadingType, Info
2. **Update interface:** Add `loadingType: LoadingType`
3. **Update state initialization:** Add `loadingType: 'LOADING_UNLOADING'`
4. **Load existing data:** `loadingType: order.loading_type || 'LOADING_UNLOADING'`
5. **Add Loading Type selector** (same JSX as CreateOrderScreen)
6. **Update loadmen section** (same as CreateOrderScreen, but add `disabled={order?.delivered}` if already delivered)
7. **Update form submission** to include loadingType

### Additional for OrderDetailsScreen:

**If admin can mark order as delivered from this screen, ADD salary calculation logic similar to useDelivery.ts**

---

## Validation Updates

### Update createOrder.validator.ts

```typescript
export function validateCreateOrder(input: CreateOrderInput): Record<string, string> {
  const errors: Record<string, string> = {};

  // ...existing validations...

  // NEW: Loadmen validation conditional on loading type
  if (input.loadingType !== 'CUSTOMER_SELF') {
    if (!input.loadMen || input.loadMen.length === 0) {
      errors.loadMen = 'Please select at least one employee for loading work';
    }
  }

  return errors;
}
```

---

## Testing After Changes

### Test Cases:

1. **Create New Role (Loadmen)**
   - Verify salary field is hidden
   - Verify info message is shown
   - Save and check DB: salary_value should be 0

2. **Create Order with Loading Type**
   - Select "Loading & Unloading"
   - Verify ALL employees shown (not just Loadmen)
   - Verify badges: "Loadman" vs "+ Extra Pay"
   - Select mix of Loadmen and non-Loadmen
   - Save order

3. **Deliver Order**
   - Go to employee app
   - Select order
   - Mark as delivered
   - Check console logs for salary calculation
   - Verify salary ledger entries created

4. **Check Calculation**
   - 5000 bricks, 3 employees (2 Loadmen + 1 Driver)
   - Loading & Unloading
   - Per-brick rate: ₹0.50 (hardcoded)
   - Expected: ₹0.50 × 5000 ÷ 3 = ₹833.33 each
   - Verify all 3 got same amount

5. **Customer Self Loading**
   - Create order with CUSTOMER_SELF
   - Verify loadmen section is hidden
   - Save and deliver
   - Verify NO salary entries created

---

## Notes

- **Per-brick rate currently hardcoded:** ₹0.50 in useDelivery.ts (line with `const PER_BRICK_RATE = 0.50`)
- **Loading type defaults:** 'LOADING_UNLOADING' if not set
- **All changes backward compatible:** Won't break existing functionality
- **Database not touched yet:** Safe to deploy and test UI changes first

---

## When You're Ready for Phase 2 (DB Migration):

1. Run the SQL migration script provided earlier
2. Update hardcoded `PER_BRICK_RATE` to fetch from `app_settings`
3. Create Settings screen for managing the rate
4. Update existing Loadmen role salary_value to 0

---

## Quick Reference: Files Changed So Far

✅ `src/utils/loadmenSalary.ts` - NEW
✅ `src/services/types.ts` - Updated
✅ `src/employee/hooks/useDelivery.ts` - Updated
✅ `src/services/middleware.service.ts` - Updated getLoadmen()
✅ `src/admin/validators/createRole.validator.ts` - Updated
✅ `src/admin/hooks/useCreateRole.ts` - Updated
✅ `src/admin/hooks/useEditRole.ts` - Updated
✅ `src/admin/pages/employees/pages/CreateRoleScreen.tsx` - Updated
✅ `src/admin/pages/employees/pages/EditRoleScreen.tsx` - Updated
⏳ `src/admin/pages/orders/pages/CreateOrderScreen.tsx` - TO DO
⏳ `src/admin/pages/orders/pages/OrderDetailsScreen.tsx` - TO DO

