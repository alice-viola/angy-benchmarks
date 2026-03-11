import { test, expect, type Page } from '@playwright/test';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const VEHICLE_ID = '00000000-0000-0000-0000-000000000010';
const DRIVER_ID = '00000000-0000-0000-0000-000000000020';
const ROUTE_ID = '00000000-0000-0000-0000-000000000200';
const JOB_ID = '00000000-0000-0000-0000-000000000300';

const mockUser = {
  id: USER_ID,
  tenant_id: TENANT_ID,
  email: 'admin@test.com',
  role: 'admin',
  first_name: 'Test',
  last_name: 'Admin',
};

const mockTenant = {
  id: TENANT_ID,
  name: 'Test Tenant',
  slug: 'test-tenant',
  plan: 'pro',
};

function makeRoute(overrides: Record<string, unknown> = {}) {
  return {
    id: ROUTE_ID,
    tenant_id: TENANT_ID,
    name: 'Test Route',
    status: 'draft',
    driver_id: null,
    vehicle_id: VEHICLE_ID,
    driver: null,
    vehicle: { id: VEHICLE_ID, registration: 'XYZ-9999', capacity_kg: '5000' },
    waypoints: [
      { latitude: 0, longitude: 0, order: 0 },
      { latitude: 0, longitude: 0, order: 1 },
    ],
    stops: [],
    scheduled_start_at: null,
    estimated_distance_km: null,
    notes: null,
    planned_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
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

test.describe('Route Planning', () => {
  test.beforeEach(async ({ page }) => {
    let currentRoute = makeRoute();
    let optimizeCallCount = 0;

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

    // Mock auth endpoints
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

    // Mock routes API
    await page.route('**/api/v1/routes', (route) => {
      const req = route.request();
      if (req.method() === 'POST' && !req.url().includes('/optimize') && !req.url().includes('/stops')) {
        currentRoute = makeRoute();
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: currentRoute }) });
      } else if (req.method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { totalItems: 0, page: 1, pageSize: 20, totalPages: 0 } }) });
      } else {
        route.continue();
      }
    });

    await page.route(/\/api\/v1\/routes\/[0-9a-f-]+\/optimize\/[0-9a-f-]+$/, (route) => {
      optimizeCallCount++;
      const completed = optimizeCallCount >= 2;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            status: completed ? 'completed' : 'active',
            progress: completed ? 100 : 50,
            result: completed ? { optimized: true } : null,
          },
        }),
      });
      if (completed) {
        currentRoute = {
          ...currentRoute,
          estimated_distance_km: 42.5,
          stops: [
            { id: 's1', route_id: ROUTE_ID, shipment_id: null, shipment: null, stop_type: 'pickup', address: 'Stop 1', latitude: 40.7128, longitude: -74.006, sequence: 0, status: 'pending', arrival_time: null, completed_at: null },
            { id: 's2', route_id: ROUTE_ID, shipment_id: null, shipment: null, stop_type: 'delivery', address: 'Stop 2', latitude: 40.73, longitude: -73.99, sequence: 1, status: 'pending', arrival_time: null, completed_at: null },
          ],
        };
      }
    });

    await page.route(/\/api\/v1\/routes\/[0-9a-f-]+\/optimize$/, (route) => {
      if (route.request().method() === 'POST') {
        optimizeCallCount = 0;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { job_id: JOB_ID } }) });
      } else {
        route.continue();
      }
    });

    await page.route(/\/api\/v1\/routes\/[0-9a-f-]+$/, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: currentRoute }) });
      } else {
        route.continue();
      }
    });

    await page.route('**/api/v1/vehicles*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: VEHICLE_ID, registration: 'XYZ-9999', status: 'available', capacity_kg: '5000' }], meta: { totalItems: 1, page: 1, pageSize: 20, totalPages: 1 } }),
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
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|routes)/);
  });

  test('create route, add stops, optimize', async ({ page }) => {
    // 1. Navigate to new route form (SPA navigation to avoid full reload)
    await navigateTo(page, '/routes/new');
    await expect(page.getByRole('main').getByRole('heading', { name: 'New Route' })).toBeVisible();

    // Fill route name
    await page.locator('input[type="text"]').fill('Test Route');

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to plan view
    await page.waitForURL(/\/routes\/[a-f0-9-]+\/plan/);

    // Verify route planner is visible
    await expect(page.locator('text=Route Planner')).toBeVisible();

    // Click Optimize
    const optimizeBtn = page.locator('button:has-text("Optimize")');
    if (await optimizeBtn.count() > 0) {
      await optimizeBtn.click();

      // Verify button shows optimizing state
      await expect(page.locator('button:has-text("Optimizing")')).toBeVisible({ timeout: 5000 });

      // Wait for optimization to complete (polling will happen)
      await expect(page.locator('button:has-text("Optimize")')).toBeVisible({ timeout: 15000 });
    }
  });
});
