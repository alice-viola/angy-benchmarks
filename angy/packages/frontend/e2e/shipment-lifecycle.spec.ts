import { test, expect, type Page } from '@playwright/test';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const VEHICLE_ID = '00000000-0000-0000-0000-000000000010';
const DRIVER_ID = '00000000-0000-0000-0000-000000000020';

const mockUser = {
  id: USER_ID,
  tenant_id: TENANT_ID,
  email: 'dispatcher@test.com',
  role: 'dispatcher',
  first_name: 'Test',
  last_name: 'Dispatcher',
};

const mockTenant = {
  id: TENANT_ID,
  name: 'Test Tenant',
  slug: 'test-tenant',
  plan: 'pro',
};

function makeShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000100',
    tenant_id: TENANT_ID,
    reference_code: null,
    status: 'draft',
    priority: 'normal',
    customer_name: 'Test Customer',
    origin_address: '123 Origin St, New York, NY',
    origin_lat: 40.7128,
    origin_lng: -74.006,
    dest_address: '456 Dest Ave, Los Angeles, CA',
    dest_lat: 34.0522,
    dest_lng: -118.2437,
    scheduled_pickup_at: null,
    scheduled_delivery_at: null,
    cargo_description: 'Test cargo',
    cargo_weight_kg: 500,
    cargo_volume_m3: 5,
    cargo_type: 'general',
    requires_temp_control: false,
    temp_min_c: null,
    temp_max_c: null,
    assigned_driver_id: null,
    assigned_vehicle_id: null,
    assigned_driver: null,
    assigned_vehicle: null,
    pod_signature_url: null,
    pod_photo_urls: [],
    pod_notes: null,
    failure_reason: null,
    cancellation_reason: null,
    events: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeEvent(from: string, to: string, action: string) {
  return {
    id: crypto.randomUUID(),
    shipment_id: '00000000-0000-0000-0000-000000000100',
    from_state: from,
    to_state: to,
    action,
    notes: null,
    performed_by: USER_ID,
    performed_by_user: { first_name: 'Test', last_name: 'Dispatcher' },
    created_at: new Date().toISOString(),
  };
}

/** Navigate within the SPA without a full page reload */
async function navigateTo(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test.describe('Shipment Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Track shipment state across API calls
    let shipment = makeShipment();
    const events: ReturnType<typeof makeEvent>[] = [];

    // Track login state for auth/me mock
    let loggedIn = false;

    // Catch-all for any unhandled API calls — registered FIRST so specific mocks take priority
    await page.route('**/api/v1/**', (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { totalItems: 0, page: 1, pageSize: 20, totalPages: 0 } }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
      }
    });

    // Mock all API endpoints
    // Return 403 (not 401) so the axios refresh interceptor doesn't kick in and cause a redirect loop
    await page.route('**/api/v1/auth/me', (route) => {
      if (loggedIn) {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'mock-token', user: mockUser, tenant: mockTenant }) });
      } else {
        route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'NO_SESSION' } }) });
      }
    });

    await page.route('**/api/v1/auth/refresh', (route) => {
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'NO_SESSION' } }) });
    });

    await page.route('**/api/v1/auth/login', (route) => {
      loggedIn = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'mock-token', user: mockUser, tenant: mockTenant }),
      });
    });

    await page.route('**/api/v1/shipments', (route) => {
      const req = route.request();
      if (req.method() === 'POST' && !req.url().includes('/actions')) {
        shipment = makeShipment({ status: 'draft' });
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: shipment }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { totalItems: 0, page: 1, pageSize: 20, totalPages: 0 } }) });
      }
    });

    await page.route('**/api/v1/shipments/*/actions', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const action = body.action;
      const prevState = shipment.status;
      const stateMap: Record<string, string> = {
        confirm: 'confirmed',
        assign: 'assigned',
        pickup: 'in_transit',
        deliver: 'delivered',
        complete: 'completed',
        fail: 'failed',
        cancel: 'cancelled',
      };
      const newState = stateMap[action] || shipment.status;
      events.push(makeEvent(prevState, newState, action));
      shipment = {
        ...shipment,
        status: newState,
        events: [...events],
        reference_code: newState === 'confirmed' && !shipment.reference_code
          ? `SHP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-00001`
          : shipment.reference_code,
        assigned_vehicle_id: action === 'assign' ? VEHICLE_ID : shipment.assigned_vehicle_id,
        assigned_driver_id: action === 'assign' ? DRIVER_ID : shipment.assigned_driver_id,
        assigned_vehicle: action === 'assign' ? { id: VEHICLE_ID, registration: 'XYZ-9999' } : shipment.assigned_vehicle,
        assigned_driver: action === 'assign' ? { id: DRIVER_ID, first_name: 'John', last_name: 'Driver' } : shipment.assigned_driver,
      };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: shipment }) });
    });

    await page.route(/\/api\/v1\/shipments\/[0-9a-f-]+$/, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ...shipment, events } }) });
      } else {
        route.continue();
      }
    });

    await page.route('**/api/v1/vehicles*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: VEHICLE_ID, registration: 'XYZ-9999', status: 'available' }], meta: { totalItems: 1, page: 1, pageSize: 20, totalPages: 1 } }),
      });
    });

    await page.route('**/api/v1/drivers*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: DRIVER_ID, first_name: 'John', last_name: 'Driver', status: 'available' }], meta: { totalItems: 1, page: 1, pageSize: 20, totalPages: 1 } }),
      });
    });

    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|shipments)/);
  });

  test('full shipment lifecycle: draft → confirmed → assigned → in_transit → delivered → completed', async ({ page }) => {
    // 1. Navigate to new shipment form (SPA navigation to avoid full reload)
    await navigateTo(page, '/shipments/new');
    await expect(page.locator('h1:has-text("Create Shipment")')).toBeVisible();

    // Fill form (matching actual ShipmentForm field order and labels)
    await page.getByLabel('Reference Code').fill('SHP-TEST');
    await page.getByLabel('Customer Name').fill('Test Customer');

    // Origin
    const originFieldset = page.locator('fieldset', { has: page.getByText('Origin') });
    await originFieldset.getByLabel('Address').fill('123 Origin St, New York, NY');
    await originFieldset.getByLabel('Latitude').fill('40.7128');
    await originFieldset.getByLabel('Longitude').fill('-74.006');

    // Destination
    const destFieldset = page.locator('fieldset', { has: page.getByText('Destination') });
    await destFieldset.getByLabel('Address').fill('456 Dest Ave, Los Angeles, CA');
    await destFieldset.getByLabel('Latitude').fill('34.0522');
    await destFieldset.getByLabel('Longitude').fill('-118.2437');

    // Cargo
    await page.getByLabel('Weight (kg)').fill('500');
    await page.getByLabel('Volume (m³)').fill('5');

    // Submit
    await page.click('button[type="submit"]');

    // Verify redirect to shipment detail
    await page.waitForURL(/\/shipments\/[a-f0-9-]+/);
    // StatusBadge renders as a span.rounded-full.text-xs with formatted state text
    const statusBadge = page.locator('.rounded-full.text-xs');
    await expect(statusBadge).toContainText('Draft');

    // 2. Confirm
    await page.click('button:has-text("Confirm")');
    // ConfirmDialog appears — click Confirm in dialog
    await page.locator('.fixed button:has-text("Confirm")').click();
    await expect(statusBadge).toContainText('Confirmed', { timeout: 5000 });

    // Verify reference_code appears
    await expect(page.locator('text=SHP-')).toBeVisible();

    // 3. Assign
    await page.click('button:has-text("Assign")');
    // Wait for assign dialog
    const assignDialog = page.locator('.fixed.inset-0').filter({ hasText: 'Assign Shipment' });
    await expect(assignDialog).toBeVisible();

    // Select vehicle and driver
    const vehicleSelect = assignDialog.locator('select').first();
    await vehicleSelect.selectOption({ index: 1 });
    const driverSelect = assignDialog.locator('select').last();
    await driverSelect.selectOption({ index: 1 });

    // Click Assign button in dialog
    await assignDialog.locator('button:has-text("Assign")').click();
    await expect(statusBadge).toContainText('Assigned', { timeout: 5000 });

    // 4. Pickup → in_transit
    await page.click('button:has-text("Pickup")');
    await page.locator('.fixed button:has-text("Confirm")').click();
    await expect(statusBadge).toContainText('In Transit', { timeout: 5000 });

    // 5. Deliver
    await page.click('button:has-text("Deliver")');
    const deliverDialog = page.locator('.fixed.inset-0').filter({ hasText: 'Mark as Delivered' });
    await expect(deliverDialog).toBeVisible();
    await deliverDialog.locator('button:has-text("Deliver")').click();
    await expect(statusBadge).toContainText('Delivered', { timeout: 5000 });

    // 6. Complete
    await page.click('button:has-text("Complete")');
    await page.locator('.fixed button:has-text("Confirm")').click();
    await expect(statusBadge).toContainText('Completed', { timeout: 5000 });
  });
});
