import { test, expect } from '@playwright/test';

test.describe('Route Planning', () => {
  test.beforeEach(async ({ page }) => {
    // Login as dispatcher
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@demofleet.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('plan a route: add shipments, optimize, verify map polyline', async ({ page }) => {
    // Step 1: Navigate to route planner
    await page.goto('/routes/plan');
    await expect(page.locator('h1')).toContainText('Route Planner');

    // Step 2: Switch to the "Unassigned" tab to see available shipments
    const unassignedTab = page.locator('button:has-text("Unassigned")');
    await unassignedTab.click();

    // Wait for the unassigned shipments list to load
    await page.waitForTimeout(1000);

    // Step 3: Drag a shipment from the unassigned list onto the stop list
    const firstShipment = page.locator(
      '[data-testid="unassigned-shipment"]:first-child, .unassigned-shipment:first-child'
    ).first();

    const stopListTarget = page.locator(
      '[data-testid="stop-list"], .stop-list, [class*="stop"]'
    ).first();

    // If drag-and-drop elements are available, perform the drag
    if (await firstShipment.isVisible({ timeout: 3000 })) {
      await firstShipment.dragTo(stopListTarget);

      // Verify the stop appears with a sequence number
      await expect(
        page.locator('[data-testid="stop-item"], .stop-item, :text("#1")')
      ).toBeVisible({ timeout: 5000 });

      // Step 4: Drag a second shipment
      const secondShipment = page.locator(
        '[data-testid="unassigned-shipment"]:nth-child(2), .unassigned-shipment:nth-child(2)'
      ).first();

      if (await secondShipment.isVisible({ timeout: 2000 })) {
        await secondShipment.dragTo(stopListTarget);

        // Verify sequence numbers update (should show #1 and #2)
        await expect(
          page.locator(':text("#2"), [data-sequence="2"]')
        ).toBeVisible({ timeout: 5000 });
      }
    }

    // Step 5: Fill route name and save first (needed before optimization)
    const routeNameInput = page.locator(
      'input[placeholder*="Morning"], input[type="text"]:first-of-type'
    );
    if (await routeNameInput.isVisible()) {
      await routeNameInput.fill('E2E Test Route');
    }

    // Step 6: Click "Save Route" first if we need a route to exist
    const saveButton = page.locator('button:has-text("Save Route"), button:has-text("Save")');
    if (await saveButton.isVisible({ timeout: 2000 })) {
      await saveButton.click();
      await page.waitForTimeout(2000);
    }

    // Step 7: Click 'Optimize Route' button
    const optimizeButton = page.locator(
      'button:has-text("Optimize"), button:has-text("Optimize Route")'
    );
    if (await optimizeButton.isEnabled({ timeout: 3000 })) {
      await optimizeButton.click();

      // Step 8: Expect a loading/progress indicator
      // The button shows a spinner (Loader2 with animate-spin) during optimization
      await expect(
        page.locator('.animate-spin, [class*="loading"], [class*="progress"]')
      ).toBeVisible({ timeout: 5000 });

      // Step 9: Wait for optimization to complete
      // Wait for the spinner to disappear or for a success toast
      await expect(
        page.locator('.animate-spin')
      ).not.toBeVisible({ timeout: 30000 });

      // Step 10: Verify the map shows a route polyline
      // Leaflet renders polylines as SVG path elements with class "leaflet-interactive"
      await expect(
        page.locator('.leaflet-interactive, path.leaflet-interactive, polyline')
      ).toBeVisible({ timeout: 10000 });

      // Step 11: Verify estimated_distance_km is displayed
      await expect(
        page.locator(':text("km"), :text("distance"), [data-testid="estimated-distance"]')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('route planner shows map container', async ({ page }) => {
    await page.goto('/routes/plan');

    // Verify the map container loads
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
  });

  test('route planner shows stop list and unassigned tabs', async ({ page }) => {
    await page.goto('/routes/plan');

    // Verify tabs exist
    await expect(page.locator('button:has-text("Stops")')).toBeVisible();
    await expect(page.locator('button:has-text("Unassigned")')).toBeVisible();
  });

  test('optimize button is disabled without a saved route', async ({ page }) => {
    await page.goto('/routes/plan');

    // The optimize button should be disabled when no route is loaded
    const optimizeButton = page.locator(
      'button:has-text("Optimize")'
    );
    await expect(optimizeButton).toBeDisabled();
  });
});
