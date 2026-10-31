import type { Page, Request, Route } from '@playwright/test';
import { FAKE_SUPABASE_URL } from '../../playwright.config';

export const TEST_USER = {
  id: '3336d88b-8445-4405-a99a-2e65312ba18f',
  email: 'employee@brickybox.test',
  password: 'correct-password',
  phone: '9000000001',
};

export const ADMIN_USER = {
  id: '075ab29e-f651-49de-a7a5-3e81dcec2df3',
  email: 'admin@brickybox.test',
  password: 'correct-password',
  phone: '9000000002',
};

type Identity = typeof TEST_USER;

const ORGANIZATION_ID = '1048da2b-af68-4174-b187-828e6ef156ac';
const BRANCH_ID = '082e04bb-2a76-40b2-bce4-28630e32eeaa';

export interface MockOptions {
  /** profiles.role for the signed-in user. */
  role?: 'EMPLOYEE' | 'ADMIN';
  /** What am_i_active_employee answers; false is a deactivated employee. */
  activeEmployee?: boolean;
  /** Make saving a material purchase fail with a server error. */
  procurementFails?: boolean;
  /** Make the materials and vendors lists fail to load. */
  listsFail?: boolean;
  /** Make recording a production entry fail with a server error. */
  productionFails?: boolean;
  /** The undelivered orders the Orders screen lists; defaults to ORDERS. */
  orders?: Array<Record<string, unknown>>;
  /** Make the orders list fail to load. */
  ordersFail?: boolean;
  /** Make updating an order from the admin Order Management screen fail with a server error. */
  orderUpdateFails?: boolean;
  /** Make loading one order (the delivery screen) fail. */
  orderFails?: boolean;
  /** Make completing a delivery fail with a server error. */
  deliveryFails?: boolean;
  /** The LOADING_AND_UNLOADING_PRICE_PER_BRICK app setting: a value, or "missing". */
  pricePerBrick?: string | 'missing';
  /** Make the sign-out endpoint fail with a server error. */
  logoutFails?: boolean;
  /** Make the delivery staff list fail to load. */
  staffFails?: boolean;
  /** Who is already signed in on this page (default employee); signing in switches it. */
  signedInAs?: 'employee' | 'admin';
  /** Employees on the admin Employee Management screens; defaults to EMPLOYEES. */
  employees?: Array<Record<string, unknown>>;
  /** Roles on the admin role screens; defaults to ROLES. */
  roles?: Array<Record<string, unknown>>;
  /** Make every admin save (create or update of an employee or role) fail with a server error. */
  adminSavesFail?: boolean;
  /** Make the employee and role lists fail to load. */
  adminListsFail?: boolean;
  /** Attendance records (employee_id, date, status); defaults to ATTENDANCE. */
  attendance?: Array<Record<string, unknown>>;
  /** Salary ledger lines; defaults to LEDGER. */
  ledger?: Array<Record<string, unknown>>;
  /** The date the app went live (YYYY-MM-DD); the attendance overview starts here. */
  appStartDate?: string;
  /** A month (YYYY-MM-01) whose salary has already been generated. */
  salaryGenerated?: string;
  /** Make saving attendance, generating salary, or saving a ledger entry fail with a server error. */
  attendanceSaveFails?: boolean;
  salaryGenerateFails?: boolean;
  ledgerSaveFails?: boolean;
  /** The active branch's renewal date (YYYY-MM-DD), to show the renewal banner. */
  renewalDate?: string | null;
  /** Status of the active branch and of the organization. */
  branchStatus?: 'ACTIVE' | 'PAUSED';
  organizationStatus?: 'ACTIVE' | 'SUSPENDED';
  /** Hold the answer to completing a delivery for this many milliseconds. */
  deliveryDelayMs?: number;
}

function order(overrides: Record<string, unknown>) {
  return {
    customer_id: 'cust-1',
    order_date: '2026-10-10',
    delivery_date: '2026-10-15',
    price_per_brick: 8,
    paper_price: 0,
    payment_status: 'NOT_PAID',
    loading_type: 'LOADING_UNLOADING',
    amount_paid: 0,
    gst_number: null,
    dc_number: null,
    delivered: false,
    created_by: 'user-1',
    created_at: '2026-10-10T08:00:00Z',
    time: null,
    order_loadmen: [],
    ...overrides,
  };
}

export const ORDERS = [
  order({
    id: 'ord-1001',
    brick_quantity: 5000,
    final_price: 40000,
    location: '12 MG Road, Coimbatore',
    customers: { name: 'Rajesh Kumar', phone: '9876543210' },
  }),
  order({
    id: 'ord-1002',
    brick_quantity: 3000,
    final_price: 24000,
    location: '45 Brigade Road, Erode',
    gst_number: '33ABCDE1234F1Z5',
    customers: { name: 'Priya Sharma', phone: '9876543211' },
  }),
];

/** Served only when asked for by id, as the read-only view of an order already delivered. */
export const DELIVERED_ORDER = order({
  id: 'ord-0999',
  brick_quantity: 2000,
  final_price: 16000,
  location: '9 Market Street, Salem',
  payment_status: 'FULLY_PAID',
  amount_paid: 16000,
  dc_number: 'DC-77',
  time: '10:00 AM',
  loading_type: 'LOADING_ONLY',
  delivered: true,
  order_loadmen: [{ employee_id: 'emp-ravi' }],
  customers: { name: 'Anita Rao', phone: '9876543299' },
});

/** Served only when asked for by id: part-paid, but with no amount recorded as paid. */
export const PART_PAID_NO_AMOUNT_ORDER = order({
  id: 'ord-0777',
  brick_quantity: 4000,
  final_price: 32000,
  location: '3 Lake View, Tiruppur',
  payment_status: 'PARTIALLY_PAID',
  amount_paid: 0,
  customers: { name: 'Meena Iyer', phone: '9876543288' },
});

/** Orders served only by id, each set up for one scenario on the delivery screen. */
export const FULLY_PAID_ORDER = order({
  id: 'ord-0888',
  brick_quantity: 3000,
  final_price: 24000,
  location: '8 Park Lane, Karur',
  payment_status: 'FULLY_PAID',
  amount_paid: 24000,
  customers: { name: 'Suresh Babu', phone: '9876543277' },
});

export const PART_PAID_ORDER = order({
  id: 'ord-0889',
  brick_quantity: 3000,
  final_price: 24000,
  location: '9 Park Lane, Karur',
  payment_status: 'PARTIALLY_PAID',
  amount_paid: 9000,
  customers: { name: 'Lakshmi Devi', phone: '9876543266' },
});

/** Already has delivery details and an assigned load man, but is not yet delivered. */
export const PREFILLED_ORDER = order({
  id: 'ord-0555',
  brick_quantity: 2500,
  final_price: 20000,
  location: '5 Temple Street, Madurai',
  time: '02:00 PM',
  dc_number: 'DC-5',
  loading_type: 'LOADING_ONLY',
  order_loadmen: [{ employee_id: 'emp-kumar' }],
  customers: { name: 'Karthik Raja', phone: '9876543255' },
});

export const NO_QUANTITY_ORDER = order({
  id: 'ord-0666',
  brick_quantity: 0,
  final_price: 0,
  location: '6 Mill Road, Theni',
  customers: { name: 'Divya Nair', phone: '9876543244' },
});

export const ROLES = [
  { id: 'role-loader', name: 'Loader', category: 'LOADMEN', salary_value: 12.5, minimum_requirement: null, no_loading_salary: false, active: true },
  { id: 'role-mason', name: 'Mason', category: 'DAILY', salary_value: 650, minimum_requirement: null, no_loading_salary: false, active: true },
  { id: 'role-supervisor', name: 'Supervisor', category: 'FIXED', salary_value: 25000, minimum_requirement: null, no_loading_salary: true, active: true },
  { id: 'role-old', name: 'Old Role', category: 'DAILY', salary_value: 400, minimum_requirement: null, no_loading_salary: false, active: false },
];

const employee = (n: number, name: string, roleId: string, active = true) => ({
  id: `emp-${n}`,
  name,
  phone: `90000000${String(10 + n).padStart(2, '0')}`,
  alternate_phone: null,
  blood_group: 'O+',
  aadhar: `12345678901${n}`,
  permanent_address: `${n} Main Road, Salem`,
  local_address: null,
  role_id: roleId,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  deduction_amount: roleId === 'role-supervisor' ? 250 : null,
  active,
  // newest first, as the screen lists them
  created_at: new Date(Date.UTC(2026, 9, 10 - n)).toISOString(),
});

export const EMPLOYEES = [
  employee(1, 'Ravi Kumar', 'role-loader'),
  employee(2, 'Anita Rao', 'role-supervisor'),
  employee(3, 'Mohan Das', 'role-mason'),
  employee(9, 'Old Hand', 'role-mason', false),
];

/** September attendance for the fixed-salary employee, so Calculate Salary has counts to show. */
export const ATTENDANCE = [
  ...[1, 2, 3, 4, 5].map((d) => ({ employee_id: 'emp-2', date: `2026-09-0${d}`, status: 'PRESENT' })),
  { employee_id: 'emp-2', date: '2026-09-06', status: 'ABSENT' },
  { employee_id: 'emp-2', date: '2026-09-07', status: 'LEAVE' },
  { employee_id: 'emp-2', date: '2026-09-08', status: 'HALF_DAY' },
];

const ledgerLine = (id: string, employeeId: string, type: string, amount: number, day: number, extra: Record<string, unknown> = {}) => ({
  id,
  employee_id: employeeId,
  entry_type: type,
  amount,
  payment_mode: null,
  sender_account_id: null,
  receiver_account: null,
  notes: null,
  payment_at: new Date(Date.UTC(2026, 9, day, 12, 0, 0)).toISOString(),
  ...extra,
});

/** Ravi's running balance is 5,150; the other employees have no ledger lines (a balance of 0). */
export const LEDGER = [
  ledgerLine('led-1', 'emp-1', 'SALARY_AUTO_ENTRY', 5000, 3, { notes: 'Opening wages' }),
  ledgerLine('led-2', 'emp-1', 'ADVANCE', 500, 5, { payment_mode: 'CASH', notes: 'Festival advance' }),
  ledgerLine('led-3', 'emp-1', 'SALARY_AUTO_ENTRY', 650, 8, { notes: 'Auto-entry for 2026-10-08 — Present' }),
];

export const ACCOUNTS = [
  { id: 'acc-cash', account_number: 'CASH', opening_balance: 0, balance: 3000, created_at: '2026-01-01T00:00:00Z', is_cash: true },
  { id: 'acc-bank', account_number: 'HDFC-1234', opening_balance: 0, balance: 100000, created_at: '2026-01-02T00:00:00Z', is_cash: false },
  { id: 'acc-low', account_number: 'SBI-9999', opening_balance: 0, balance: 800, created_at: '2026-01-03T00:00:00Z', is_cash: false },
];

const role = (name: string, noLoadingSalary: boolean) => ({
  id: `role-${name.toLowerCase()}`,
  name,
  category: 'DAILY',
  salary_value: 500,
  no_loading_salary: noLoadingSalary,
});

export const LOADMEN = [
  { id: 'emp-ravi', name: 'Ravi', phone: '9000000011', role_id: 'role-loader', roles: role('Loader', false) },
  { id: 'emp-kumar', name: 'Kumar', phone: '9000000012', role_id: 'role-loader', roles: role('Loader', false) },
  { id: 'emp-ram', name: 'Operator Ram', phone: '9000000013', role_id: 'role-operator', roles: role('Operator', true) },
];

export const MATERIALS = [
  { id: 'mat-cement', name: 'Cement', unit: 'bags' },
  { id: 'mat-fly-ash', name: 'Fly Ash Powder', unit: 'tons' },
  { id: 'mat-wet-ash', name: 'Wet Ash', unit: 'tons' },
];

export const VENDORS = [
  { id: 'ven-abc', name: 'ABC Suppliers' },
  { id: 'ven-xyz', name: 'XYZ Materials' },
];

export interface SupabaseMock {
  /** Every request the page made to the fake Supabase host, as "METHOD /path". */
  requests: string[];
  /** The JSON bodies sent to the password sign-in endpoint. */
  signInAttempts: Array<{ email: string; password: string }>;
  /** Requests the mock had no answer for; a healthy flow leaves this empty. */
  unexpected: string[];
  /** The JSON bodies saved to the procurements table. */
  procurements: Array<Record<string, unknown>>;
  /** The argument objects sent to the record_production_entry function. */
  productionEntries: Array<Record<string, unknown>>;
  /** Attendance saves: the argument objects sent to save_attendance_with_salary. */
  attendanceSaves: Array<Record<string, unknown>>;
  /** Salary batches generated: the argument objects sent to generate_salary_batch. */
  salaryBatches: Array<Record<string, unknown>>;
  /** Ledger entries saved by the Add Payment screen: the argument objects sent to the database. */
  ledgerEntries: Array<Record<string, unknown>>;
  /** The live attendance, ledger and account tables. */
  attendanceTable: Array<Record<string, unknown>>;
  ledgerTable: Array<Record<string, unknown>>;
  accountTable: Array<Record<string, unknown>>;
  /** The live employee and role tables behind the admin screens, for checking what was saved. */
  employeeTable: Array<Record<string, unknown>>;
  roleTable: Array<Record<string, unknown>>;
  /** The query strings of every request that listed orders (to check the filters used). */
  orderListQueries: string[];
  /** Every order update the admin Order Management screen saved: the argument objects sent to update_order_with_loadmen. */
  orderUpdates: Array<Record<string, unknown>>;
  /** Every delivery completed: which function was called and the arguments it got. */
  deliveries: Array<{ fn: string; args: Record<string, unknown> }>;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-expose-headers': '*',
};

// Year 2100: a test that fixes the browser clock must never see the session as expired.
const FAR_FUTURE = 4102444800;

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** An unsigned token carrying the tenancy claims the app reads from the session. */
function accessToken(who: Identity): string {
  const payload = {
    sub: who.id,
    role: 'authenticated',
    aud: 'authenticated',
    exp: FAR_FUTURE,
    organization_id: ORGANIZATION_ID,
    default_branch_id: BRANCH_ID,
    is_super_admin: false,
  };
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.signature`;
}

const authUser = (who: Identity) => ({
  id: who.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: who.email,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-10-27T00:00:00Z',
});

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** PostgREST answers .single()/.maybeSingle() with one object and everything else with an array. */
function rows(route: Route, request: Request, data: unknown[]) {
  const wantsObject = (request.headers()['accept'] ?? '').includes('application/vnd.pgrst.object+json');
  return json(route, 200, wantsObject ? data[0] : data);
}

/**
 * Answers every request to the app's Supabase host from memory, so end-to-end runs
 * need no real project, no network and no real credentials.
 */
export async function mockSupabase(page: Page, options: MockOptions = {}): Promise<SupabaseMock> {
  const { role = 'EMPLOYEE', activeEmployee = true, procurementFails = false, listsFail = false, productionFails = false, orders = ORDERS, ordersFail = false, orderFails = false, deliveryFails = false, pricePerBrick = '2', logoutFails = false, staffFails = false, deliveryDelayMs = 0 } = options;
  // Like the real backend: an order that has been delivered leaves the undelivered list, and
  // opening it again shows what was recorded.
  const delivered = new Map<string, Record<string, unknown>>();
  // Orders whose delivery date the admin has moved, by order id.
  const rescheduled = new Map<string, Record<string, unknown>>();
  let signedIn: Identity = options.signedInAs === 'admin' ? ADMIN_USER : TEST_USER;
  const employeeTable = (options.employees ?? EMPLOYEES).map((e) => ({ ...e }));
  const roleTable = (options.roles ?? ROLES).map((r) => ({ ...r }));
  const attendanceTable = (options.attendance ?? ATTENDANCE).map((r) => ({ ...r }));
  const ledgerTable = (options.ledger ?? LEDGER).map((r) => ({ ...r }));
  const accountTable = ACCOUNTS.map((a) => ({ ...a }));
  const generatedMonths: string[] = options.salaryGenerated ? [options.salaryGenerated] : [];
  const mock: SupabaseMock = {
    attendanceSaves: [],
    salaryBatches: [],
    ledgerEntries: [],
    attendanceTable,
    ledgerTable,
    accountTable,
    employeeTable,
    roleTable, requests: [], signInAttempts: [], unexpected: [], procurements: [], productionEntries: [], orderListQueries: [], orderUpdates: [], deliveries: [] };

  const withRole = (e: Record<string, unknown>) => {
    const r = roleTable.find((x) => x.id === e.role_id);
    return { ...e, roles: r ? { id: r.id, name: r.name, category: r.category, salary_value: r.salary_value } : null };
  };
  let nextId = 100;
  const CREDITS = new Set(['SALARY_AUTO_ENTRY', 'SALARY_MANUAL_ENTRY']);
  const balanceOf = (employeeId: unknown) =>
    ledgerTable
      .filter((l) => l.employee_id === employeeId)
      .reduce((sum, l) => sum + (CREDITS.has(String(l.entry_type)) ? Number(l.amount) : -Number(l.amount)), 0);
  const summaryOf = (e: Record<string, unknown>) => {
    const r = roleTable.find((x) => x.id === e.role_id);
    return {
      id: e.id,
      name: e.name,
      phone: e.phone,
      role_name: r?.name ?? null,
      role_category: r?.category ?? null,
      category: r?.category ?? null,
      running_balance: balanceOf(e.id),
      active: e.active,
    };
  };
  const paged = (route: Route, list: unknown[], query: URLSearchParams) => {
    const limit = query.get('limit');
    const offset = Number(query.get('offset') ?? 0);
    const page = limit ? list.slice(offset, offset + Number(limit)) : list;
    return route.fulfill({
      status: 200,
      headers: {
        ...CORS,
        'content-type': 'application/json',
        'content-range': page.length ? `${offset}-${offset + page.length - 1}/${list.length}` : `*/${list.length}`,
      },
      body: JSON.stringify(page),
    });
  };

  /** Answers the admin Employee Management and Role screens' reads and writes like PostgREST would. */
  async function adminTables(route: Route, request: Request, isEmployees: boolean) {
    const table = isEmployees ? employeeTable : roleTable;
    const query = new URL(request.url()).searchParams;
    const method = request.method();
    const eq = (key: string) => query.get(key)?.replace(/^eq\./, '');
    const id = eq('id');
    const duplicate = (row: Record<string, unknown>, ownId?: string) =>
      isEmployees
        ? table.some((x) => x.phone === row.phone && x.id !== ownId)
        : table.some((x) => String(x.name).toLowerCase() === String(row.name).toLowerCase() && x.id !== ownId);
    const dupError = () =>
      json(route, 409, {
        code: '23505',
        details: null,
        message: isEmployees
          ? 'duplicate key value violates unique constraint "employees_phone_key"'
          : 'duplicate key value violates unique constraint "roles_name_key"',
      });

    if (method === 'GET') {
      if (options.adminListsFail) return json(route, 500, { message: 'list failed' });
      if (id) {
        const found = table.find((x) => x.id === id);
        if (!found) return json(route, 406, { message: 'not found' });
        return rows(route, request, [isEmployees ? withRole(found) : found]);
      }
      let list = [...table];
      const active = eq('active');
      if (active) list = list.filter((x) => String(x.active) === active);
      const search = query.get('or')?.match(/name\.ilike\.%(.*?)%,/)?.[1]?.toLowerCase();
      if (search) {
        list = list.filter(
          (x) => String(x.name).toLowerCase().includes(search) || String(x.phone ?? '').includes(search),
        );
      }
      const excluded = query.get('roles.category')?.replace(/^neq\./, '');
      if (isEmployees && excluded) {
        list = list.filter((x) => roleTable.find((r) => r.id === x.role_id)?.category !== excluded);
      }
      if (!isEmployees || query.get('order')?.startsWith('name')) {
        list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      }
      const total = list.length;
      const limit = query.get('limit');
      const offset = Number(query.get('offset') ?? 0);
      const page = limit ? list.slice(offset, offset + Number(limit)) : list;
      const data = isEmployees ? page.map(withRole) : page;
      const wantsObject = (request.headers()['accept'] ?? '').includes('application/vnd.pgrst.object+json');
      return route.fulfill({
        status: 200,
        headers: {
          ...CORS,
          'content-type': 'application/json',
          'content-range': page.length ? `${offset}-${offset + page.length - 1}/${total}` : `*/${total}`,
        },
        body: JSON.stringify(wantsObject ? data[0] : data),
      });
    }

    if (options.adminSavesFail) return json(route, 500, { message: 'save failed' });
    const wantsBody = (request.headers()['prefer'] ?? '').includes('return=representation');
    const wantsObject = (request.headers()['accept'] ?? '').includes('application/vnd.pgrst.object+json');
    const reply = (row: Record<string, unknown>, status: number) =>
      wantsBody ? json(route, status, wantsObject ? row : [row]) : route.fulfill({ status: status === 201 ? 201 : 204, headers: CORS });

    if (method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      if (duplicate(body)) return dupError();
      const row = {
        id: `${isEmployees ? 'emp' : 'role'}-new-${nextId++}`,
        created_at: new Date().toISOString(),
        ...body,
      };
      table.unshift(row);
      return reply(row, 201);
    }
    if (method === 'PATCH' && id) {
      const body = request.postDataJSON() as Record<string, unknown>;
      const row = table.find((x) => x.id === id);
      if (!row) return json(route, 406, { message: 'not found' });
      if (duplicate({ ...row, ...body }, id)) return dupError();
      Object.assign(row, body);
      return reply(row, 200);
    }
    return json(route, 404, { message: `no answer for ${method} ${request.url()}` });
  }

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    mock.requests.push(`${request.method()} ${pathname}`);

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    if (pathname === '/auth/v1/token') {
      const attempt = request.postDataJSON() as { email: string; password: string };
      mock.signInAttempts.push({ email: attempt.email, password: attempt.password });
      const known = [TEST_USER, ADMIN_USER].find((u) => u.email === attempt.email && u.password === attempt.password);
      if (!known) {
        return json(route, 400, {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        });
      }
      signedIn = known;
      return json(route, 200, {
        access_token: accessToken(known),
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: FAR_FUTURE,
        refresh_token: 'refresh-token',
        user: authUser(known),
      });
    }
    if (pathname === '/auth/v1/user') return json(route, 200, authUser(signedIn));
    if (pathname === '/auth/v1/logout') {
      if (logoutFails) return json(route, 500, { msg: 'Internal error' });
      return route.fulfill({ status: 204, headers: CORS });
    }

    if (pathname === '/rest/v1/profiles') {
      return rows(route, request, [
        {
          id: signedIn.id,
          phone: signedIn.phone,
          role: signedIn === ADMIN_USER ? 'ADMIN' : role,
          organization_id: ORGANIZATION_ID,
          default_branch_id: BRANCH_ID,
          is_super_admin: false,
        },
      ]);
    }
    if (pathname === '/rest/v1/branches') {
      return rows(route, request, [
        {
          id: BRANCH_ID,
          name: 'T.gode',
          code: '001',
          status: options.branchStatus ?? 'ACTIVE',
          renewal_date: options.renewalDate ?? null,
          last_payment_date: null,
        },
      ]);
    }
    if (pathname === '/rest/v1/organizations') {
      return rows(route, request, [{ name: 'Bricky box', status: options.organizationStatus ?? 'ACTIVE' }]);
    }
    if (pathname === '/rest/v1/employees' || pathname === '/rest/v1/roles') {
      return adminTables(route, request, pathname.endsWith('employees'));
    }
    if (pathname === '/rest/v1/attendance') {
      const query = new URL(request.url()).searchParams;
      const all = query.getAll('date');
      let list = attendanceTable;
      for (const clause of all) {
        const [op, value] = [clause.split('.')[0], clause.slice(clause.indexOf('.') + 1)];
        list = list.filter((r) =>
          op === 'eq' ? r.date === value : op === 'gte' ? String(r.date) >= value : String(r.date) <= value,
        );
      }
      return json(route, 200, list);
    }
    if (pathname === '/rest/v1/rpc/save_attendance_with_salary') {
      if (options.attendanceSaveFails) return json(route, 500, { message: 'save failed' });
      const body = request.postDataJSON() as {
        p_date: string;
        p_attendance: Array<{ employee_id: string; status: string }>;
        p_entries: Array<Record<string, unknown>>;
      };
      mock.attendanceSaves.push(body);
      for (const r of body.p_attendance) attendanceTable.push({ employee_id: r.employee_id, date: body.p_date, status: r.status });
      for (const entry of body.p_entries) {
        ledgerTable.push({
          id: `led-att-${nextId++}`,
          payment_mode: null,
          sender_account_id: null,
          receiver_account: null,
          ...entry,
        });
      }
      return json(route, 200, null);
    }
    if (pathname === '/rest/v1/salary_batches') {
      const month = new URL(request.url()).searchParams.get('month')?.replace(/^eq\./, '');
      return json(route, 200, month && generatedMonths.includes(month) ? [{ id: 'batch-1' }] : []);
    }
    if (pathname === '/rest/v1/rpc/get_fixed_salary_employees_for_month') {
      const month = (request.postDataJSON() as { p_month: string }).p_month; // first day of the current month
      const [y, m] = month.split('-').map(Number);
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      const fixed = employeeTable.filter(
        (e) => e.active === true && roleTable.find((r) => r.id === e.role_id)?.category === 'FIXED',
      );
      return json(
        route,
        200,
        fixed.map((e) => {
          const mine = attendanceTable.filter((a) => a.employee_id === e.id && String(a.date).startsWith(prev));
          const count = (status: string) => mine.filter((a) => a.status === status).length;
          return {
            employee_id: e.id,
            name: e.name,
            phone: e.phone,
            present_days: count('PRESENT'),
            absent_days: count('ABSENT'),
            leave_days: count('LEAVE'),
            half_days: count('HALF_DAY'),
            base_salary: roleTable.find((r) => r.id === e.role_id)?.salary_value,
          };
        }),
      );
    }
    if (pathname === '/rest/v1/rpc/generate_salary_batch') {
      if (options.salaryGenerateFails) return json(route, 500, { message: 'generate failed' });
      const body = request.postDataJSON() as { p_month: string; p_items: Array<Record<string, unknown>> };
      if (generatedMonths.includes(body.p_month)) {
        return json(route, 400, { code: 'P0001', message: 'Salary already generated for this month' });
      }
      generatedMonths.push(body.p_month);
      mock.salaryBatches.push(body);
      return json(route, 200, { batch_id: 'batch-new' });
    }
    if (pathname === '/rest/v1/employee_with_balance') {
      const query = new URL(request.url()).searchParams;
      let list = employeeTable.map(summaryOf);
      const active = query.get('active')?.replace(/^eq\./, '');
      if (active) list = list.filter((e) => String(e.active) === active);
      const search = query.get('or')?.match(/name\.ilike\.%(.*?)%,/)?.[1]?.toLowerCase();
      if (search) list = list.filter((e) => String(e.name).toLowerCase().includes(search) || String(e.phone ?? '').includes(search));
      list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return paged(route, list, query);
    }
    if (pathname === '/rest/v1/rpc/get_employee_ledger') {
      const body = request.postDataJSON() as {
        p_employee_id: string;
        p_is_ascending: boolean;
        p_from_date: string | null;
        p_to_date: string | null;
        p_page: number;
        p_page_size: number;
      };
      const emp = employeeTable.find((e) => e.id === body.p_employee_id);
      if (!emp) return json(route, 400, { message: 'Employee not found' });
      let lines = ledgerTable.filter((l) => l.employee_id === body.p_employee_id);
      if (body.p_from_date) lines = lines.filter((l) => String(l.payment_at) >= `${body.p_from_date}T00:00:00`);
      if (body.p_to_date) lines = lines.filter((l) => String(l.payment_at) < `${body.p_to_date}T00:00:00`);
      lines = [...lines].sort((a, b) => String(a.payment_at).localeCompare(String(b.payment_at)));
      if (!body.p_is_ascending) lines.reverse();
      const start = body.p_page * body.p_page_size;
      return json(route, 200, {
        employee: summaryOf(emp),
        transactions: lines.slice(start, start + body.p_page_size),
        total_count: lines.length,
      });
    }
    if (pathname === '/rest/v1/accounts') return json(route, 200, accountTable);
    if (pathname === '/rest/v1/rpc/record_salary_ledger_entry') {
      if (options.ledgerSaveFails) return json(route, 500, { message: 'save failed' });
      const b = request.postDataJSON() as Record<string, unknown>;
      const amount = Number(b.p_amount);
      const source =
        b.p_entry_type === 'SALARY_MANUAL_ENTRY'
          ? null
          : b.p_payment_mode === 'CASH'
            ? accountTable.find((a) => a.is_cash)
            : accountTable.find((a) => a.id === b.p_sender_account_id);
      if (source && amount > Number(source.balance)) {
        return json(route, 400, { code: 'P0001', message: 'Insufficient balance in the selected account' });
      }
      if (source) source.balance = Number(source.balance) - amount;
      mock.ledgerEntries.push(b);
      ledgerTable.push({
        id: `led-new-${nextId++}`,
        employee_id: b.p_employee_id,
        entry_type: b.p_entry_type,
        amount,
        payment_mode: b.p_payment_mode,
        sender_account_id: b.p_sender_account_id,
        receiver_account: b.p_receiver_account,
        notes: b.p_notes,
        payment_at: b.p_payment_at ?? new Date().toISOString(),
      });
      return json(route, 200, { id: 'led-saved' });
    }
    if (pathname === '/rest/v1/materials' || pathname === '/rest/v1/vendors') {
      if (listsFail) return json(route, 500, { message: 'list failed' });
      return rows(route, request, pathname.endsWith('materials') ? MATERIALS : VENDORS);
    }
    if (pathname === '/rest/v1/procurements' && request.method() === 'POST') {
      if (procurementFails) return json(route, 500, { message: 'insert failed' });
      mock.procurements.push(request.postDataJSON() as Record<string, unknown>);
      return route.fulfill({ status: 201, headers: CORS });
    }
    if (pathname === '/rest/v1/orders') {
      const query = new URL(request.url()).searchParams;
      const id = query.get('id')?.replace('eq.', '');
      if (id) {
        if (orderFails) return json(route, 500, { message: 'order failed' });
        const found = [
          ...orders,
          DELIVERED_ORDER,
          PART_PAID_NO_AMOUNT_ORDER,
          FULLY_PAID_ORDER,
          PART_PAID_ORDER,
          PREFILLED_ORDER,
          NO_QUANTITY_ORDER,
        ].find((o) => o.id === id);
        if (!found) return json(route, 406, { message: 'not found' });
        return rows(route, request, [delivered.has(id) ? { ...found, ...delivered.get(id) } : found]);
      }
      mock.orderListQueries.push(request.url().split('?')[1] ?? '');
      if (ordersFail) return json(route, 500, { message: 'orders failed' });
      return rows(
        route,
        request,
        orders.filter((o) => !delivered.has(o.id as string)).map((o) => ({ ...o, ...rescheduled.get(o.id as string) })),
      );
    }
    if (pathname === '/rest/v1/rpc/update_order_with_loadmen') {
      if (options.orderUpdateFails) return json(route, 500, { message: 'update failed' });
      const args = request.postDataJSON() as Record<string, unknown>;
      mock.orderUpdates.push(args);
      rescheduled.set(args.p_order_id as string, args.p_update as Record<string, unknown>);
      return json(route, 200, null);
    }
    if (pathname === '/rest/v1/rpc/get_delivery_staff') {
      if (staffFails) return json(route, 500, { message: 'staff failed' });
      return json(route, 200, LOADMEN);
    }
    if (pathname === '/rest/v1/app_settings' && new URL(request.url()).searchParams.get('key') === 'eq.APP_START_DATE') {
      return rows(route, request, [{ value: options.appStartDate ?? '2026-10-01' }]);
    }
    if (pathname === '/rest/v1/app_settings') {
      return rows(
        route,
        request,
        pricePerBrick === 'missing'
          ? []
          : [{ key: 'LOADING_AND_UNLOADING_PRICE_PER_BRICK', value: pricePerBrick }],
      );
    }
    if (pathname === '/rest/v1/rpc/complete_delivery' || pathname === '/rest/v1/rpc/complete_delivery_with_wages') {
      if (deliveryDelayMs) await new Promise((resolve) => setTimeout(resolve, deliveryDelayMs));
      if (deliveryFails) return json(route, 500, { message: 'rpc failed' });
      const args = request.postDataJSON() as Record<string, unknown>;
      mock.deliveries.push({ fn: pathname.split('/').pop() as string, args });
      delivered.set(args.p_order_id as string, {
        delivered: true,
        time: args.p_time,
        brick_quantity: args.p_brick_quantity,
        location: args.p_location,
        payment_status: args.p_payment_status,
        amount_paid: args.p_amount_paid,
        gst_number: args.p_gst_number,
        dc_number: args.p_dc_number,
        loading_type: args.p_loading_type,
        order_loadmen: (args.p_loadmen as string[]).map((id) => ({ employee_id: id })),
      });
      return json(route, 200, null);
    }
    if (pathname === '/rest/v1/rpc/record_production_entry') {
      if (productionFails) return json(route, 500, { message: 'rpc failed' });
      mock.productionEntries.push(request.postDataJSON() as Record<string, unknown>);
      return json(route, 200, null);
    }
    if (pathname === '/rest/v1/rpc/am_i_active_employee') return json(route, 200, activeEmployee);

    // Anything else is a request the tests did not expect; make it visible, not silent.
    mock.unexpected.push(`${request.method()} ${pathname}`);
    return json(route, 404, { message: `e2e mock has no answer for ${request.method()} ${pathname}` });
  });

  return mock;
}
