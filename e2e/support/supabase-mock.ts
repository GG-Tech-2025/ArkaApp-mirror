import type { Page, Request, Route } from '@playwright/test';
import { FAKE_SUPABASE_URL } from '../../playwright.config';

export const TEST_USER = {
  id: '3336d88b-8445-4405-a99a-2e65312ba18f',
  email: 'employee@brickybox.test',
  password: 'correct-password',
  phone: '9000000001',
};

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
  /** Make loading one order (the delivery screen) fail. */
  orderFails?: boolean;
  /** Make completing a delivery fail with a server error. */
  deliveryFails?: boolean;
  /** The LOADING_AND_UNLOADING_PRICE_PER_BRICK app setting: a value, or "missing". */
  pricePerBrick?: string | 'missing';
  /** Make the sign-out endpoint fail with a server error. */
  logoutFails?: boolean;
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
  /** The query strings of every request that listed orders (to check the filters used). */
  orderListQueries: string[];
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
function accessToken(): string {
  const payload = {
    sub: TEST_USER.id,
    role: 'authenticated',
    aud: 'authenticated',
    exp: FAR_FUTURE,
    organization_id: ORGANIZATION_ID,
    default_branch_id: BRANCH_ID,
    is_super_admin: false,
  };
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.signature`;
}

const authUser = () => ({
  id: TEST_USER.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: TEST_USER.email,
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
  const { role = 'EMPLOYEE', activeEmployee = true, procurementFails = false, listsFail = false, productionFails = false, orders = ORDERS, ordersFail = false, orderFails = false, deliveryFails = false, pricePerBrick = '2', logoutFails = false } = options;
  const mock: SupabaseMock = { requests: [], signInAttempts: [], unexpected: [], procurements: [], productionEntries: [], orderListQueries: [], deliveries: [] };

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    mock.requests.push(`${request.method()} ${pathname}`);

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    if (pathname === '/auth/v1/token') {
      const attempt = request.postDataJSON() as { email: string; password: string };
      mock.signInAttempts.push({ email: attempt.email, password: attempt.password });
      if (attempt.email !== TEST_USER.email || attempt.password !== TEST_USER.password) {
        return json(route, 400, {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        });
      }
      return json(route, 200, {
        access_token: accessToken(),
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: FAR_FUTURE,
        refresh_token: 'refresh-token',
        user: authUser(),
      });
    }
    if (pathname === '/auth/v1/user') return json(route, 200, authUser());
    if (pathname === '/auth/v1/logout') {
      if (logoutFails) return json(route, 500, { msg: 'Internal error' });
      return route.fulfill({ status: 204, headers: CORS });
    }

    if (pathname === '/rest/v1/profiles') {
      return rows(route, request, [
        {
          id: TEST_USER.id,
          phone: TEST_USER.phone,
          role,
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
          status: 'ACTIVE',
          renewal_date: null,
          last_payment_date: null,
        },
      ]);
    }
    if (pathname === '/rest/v1/organizations') {
      return rows(route, request, [{ name: 'Bricky box', status: 'ACTIVE' }]);
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
        const found = [...orders, DELIVERED_ORDER, PART_PAID_NO_AMOUNT_ORDER].find((o) => o.id === id);
        return found ? rows(route, request, [found]) : json(route, 406, { message: 'not found' });
      }
      mock.orderListQueries.push(request.url().split('?')[1] ?? '');
      if (ordersFail) return json(route, 500, { message: 'orders failed' });
      return rows(route, request, orders);
    }
    if (pathname === '/rest/v1/rpc/get_delivery_staff') return json(route, 200, LOADMEN);
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
      if (deliveryFails) return json(route, 500, { message: 'rpc failed' });
      mock.deliveries.push({
        fn: pathname.split('/').pop() as string,
        args: request.postDataJSON() as Record<string, unknown>,
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
