# App Settings Module

## Overview
The App Settings module provides administrators with the ability to configure and manage application-wide settings. This module follows the same design standards and patterns used throughout the ArkaApp admin application.

## Module Structure

```
src/admin/
├── pages/
│   └── settings/
│       ├── routes.tsx                    # Settings module routing
│       └── pages/
│           └── SettingsManagementScreen.tsx  # Main settings UI
├── hooks/
│   └── useAppSettings.ts                 # Custom hook for settings CRUD
└── validators/
    └── updateSetting.validator.ts        # Validation logic for settings updates
```

## Database Table

The module works with the `app_settings` table in Supabase:

```sql
CREATE TABLE "public"."app_settings" (
  "id" UUID PRIMARY KEY,
  "key" VARCHAR UNIQUE NOT NULL,
  "value" VARCHAR NOT NULL,
  "description" TEXT,
  "updated_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE
);
```

### Initial Data

```sql
INSERT INTO "public"."app_settings" (
  "id", 
  "key", 
  "value", 
  "description", 
  "updated_at", 
  "created_at"
) VALUES (
  'd4557f1b-dac6-44c0-abd5-23d998c9a05d', 
  'LOADING_AND_UNLOADING_PRICE_PER_BRICK', 
  '0.334', 
  'Rate per brick for loading/unloading work (₹). Applied equally to all employees doing loading work. Full rate for Loading & Unloading, half rate for Loading Only.', 
  '2026-04-21 03:42:55.712639+00', 
  '2026-04-21 03:42:55.712639+00'
);
```

## Features

### 1. Settings Dashboard
- **Location**: `/admin/settings`
- **Purpose**: View and manage all application settings
- **Features**:
  - List all settings with descriptions
  - Inline editing with validation
  - Real-time updates
  - Last updated timestamp display

### 2. Edit Settings
- Click "Edit" button next to any setting
- Inline form appears with current value
- Validation includes:
  - Required field check
  - Numeric validation
  - Non-negative number validation
- Save or Cancel options

### 3. Navigation
- Added to Admin Home Screen as "App Settings" card
- Gray gradient color scheme (from-gray-500 to-gray-600)
- Settings icon (gear icon)
- Accessible from `/admin/settings`

## Components

### SettingsManagementScreen
Main UI component that displays all settings and handles editing.

**Key Features**:
- Back navigation to admin home
- Settings list with card-based layout
- Inline editing functionality
- Success/Error popup notifications
- Responsive design

### useAppSettings Hook
Custom React hook for managing settings data.

**API**:
```typescript
{
  settings: AppSetting[];      // Array of all settings
  loading: boolean;             // Loading state
  error: string | null;         // Error message if any
  showError: boolean;           // Whether to show error popup
  closeError: () => void;       // Close error popup
  updateSetting: (key: string, value: string) => Promise<void>;
  refetchSettings: () => Promise<void>;
}
```

### Validator
Validates setting updates before submission.

**Rules**:
- Value must not be empty
- Value must be a valid number
- Value must be >= 0

## Routing

### Main Admin Routes
```typescript
// src/admin/routes.tsx
<Route path="settings/*" element={<SettingsRoutes />} />
```

### Settings Routes
```typescript
// src/admin/pages/settings/routes.tsx
<Route index element={<SettingsManagementScreen />} />
```

## Usage

### Adding New Settings

To add a new setting to the application:

1. **Insert into Database**:
```sql
INSERT INTO "public"."app_settings" (
  "id", 
  "key", 
  "value", 
  "description", 
  "updated_at", 
  "created_at"
) VALUES (
  gen_random_uuid(), 
  'YOUR_SETTING_KEY', 
  'default_value', 
  'Description of what this setting does', 
  NOW(), 
  NOW()
);
```

2. **Use in Code**:
```typescript
import { useAppSettings } from '@/admin/hooks/useAppSettings';

const { settings } = useAppSettings();
const loadingPrice = settings.find(
  s => s.key === 'LOADING_AND_UNLOADING_PRICE_PER_BRICK'
)?.value;
```

### Updating Settings Programmatically

```typescript
const { updateSetting } = useAppSettings();

await updateSetting('LOADING_AND_UNLOADING_PRICE_PER_BRICK', '0.35');
```

## Design Patterns

This module follows the established patterns in ArkaApp:

1. **Routing**: Nested routes with a main routes file
2. **Hooks**: Custom hooks for data fetching and management
3. **Validation**: Separate validator files for business logic
4. **UI Components**: Consistent card-based layouts
5. **Navigation**: useAdminNavigation hook for navigation
6. **Error Handling**: Popup components for user feedback
7. **Responsive Design**: Mobile and desktop optimized

## Future Enhancements

Potential additions to the module:

1. **Setting Types**: Support for different input types (text, number, boolean, dropdown)
2. **Setting Groups**: Organize settings into categories
3. **Audit Log**: Track who changed what and when
4. **Validation Rules**: Custom validation per setting type
5. **Import/Export**: Backup and restore settings
6. **Default Values**: Reset to default functionality
7. **Search**: Filter settings by name or key

## Testing

To test the module:

1. Navigate to `/admin/settings`
2. Verify all settings are displayed
3. Click "Edit" on a setting
4. Try invalid values (negative, non-numeric, empty)
5. Try valid values
6. Verify success/error popups
7. Check that changes persist on page refresh

## Dependencies

- React Router DOM (navigation)
- Lucide React (icons)
- Supabase (database)
- Existing app components (Popup, useAdminNavigation)

## Notes

- Settings are sorted alphabetically by key
- All monetary values use ₹ symbol
- Timestamps are displayed in Indian locale format
- The module uses the same color scheme and styling as other admin modules
