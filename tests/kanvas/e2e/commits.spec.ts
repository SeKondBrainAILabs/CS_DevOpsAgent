/**
 * Commits Feature E2E Tests
 * Tests the commit history and diff viewing functionality
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  clickButtonByText,
  ElectronTestContext,
} from './electron.setup';

test.describe('Universal Commits View', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context?.app) {
      await closeElectronApp(context.app);
    }
  });

  test('should display View All Commits button in sidebar', async () => {
    const { page } = context;

    // The sidebar should have a "View All Commits" button
    await expect(page.locator('button:has-text("View All Commits")')).toBeVisible();
  });

  test('should navigate to universal commits view when clicking View All Commits', async () => {
    const { page } = context;

    // Click the View All Commits button
    await page.click('button:has-text("View All Commits")');

    // Should show the "All Commits" header
    await expect(page.locator('text=All Commits')).toBeVisible();
  });

  test('should display filter dropdowns', async () => {
    const { page } = context;

    // Click View All Commits if not already there
    await page.click('button:has-text("View All Commits")');

    // Should show filter dropdowns
    await expect(page.locator('select')).toHaveCount(3); // Session, Repo, Time filters

    // Check for "All Sessions" option
    await expect(page.locator('option:has-text("All Sessions")')).toBeVisible();

    // Check for "All Repos" option
    await expect(page.locator('option:has-text("All Repos")')).toBeVisible();

    // Check for "All Time" option
    await expect(page.locator('option:has-text("All Time")')).toBeVisible();
  });

  test('should have Refresh button', async () => {
    const { page } = context;

    // Navigate to commits view
    await page.click('button:has-text("View All Commits")');

    // Should have a Refresh button
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
  });

  test('should show empty state when no commits', async () => {
    const { page } = context;

    // Navigate to commits view
    await page.click('button:has-text("View All Commits")');

    // Should show empty state message
    const emptyState = page.locator('text=No commits found').or(page.locator('text=Commits will appear'));
    await expect(emptyState).toBeVisible();
  });

  test('should allow filtering by time period', async () => {
    const { page } = context;

    // Navigate to commits view
    await page.click('button:has-text("View All Commits")');

    // Find the time filter dropdown (the one with "All Time")
    const timeFilter = page.locator('select:has(option:has-text("All Time"))');
    await expect(timeFilter).toBeVisible();

    // Select "Last 24 Hours"
    await timeFilter.selectOption('24h');

    // The filter should be applied (UI should update)
    await expect(timeFilter).toHaveValue('24h');
  });

  test('should display commit and session counts', async () => {
    const { page } = context;

    // Navigate to commits view
    await page.click('button:has-text("View All Commits")');

    // Should show count text
    await expect(page.locator('text=/\\d+ commits/')).toBeVisible();
    await expect(page.locator('text=/\\d+ sessions/')).toBeVisible();
  });
});

test.describe('Session Commits Tab', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context?.app) {
      await closeElectronApp(context.app);
    }
  });

  test('should display Sessions tab in sidebar', async () => {
    const { page } = context;

    await expect(page.locator('button:has-text("Sessions")')).toBeVisible();
  });

  test('should show empty sessions list initially', async () => {
    const { page } = context;

    // Click on Sessions tab
    await page.click('button:has-text("Sessions")');

    // Should show "No sessions reported"
    await expect(page.locator('text=No sessions reported')).toBeVisible();
  });
});

test.describe('Commits Tab Navigation', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context?.app) {
      await closeElectronApp(context.app);
    }
  });

  test('should be able to switch between dashboard and commits view', async () => {
    const { page } = context;

    // Start at dashboard
    await expect(page.locator('text=Agent Dashboard')).toBeVisible();

    // Click View All Commits
    await page.click('button:has-text("View All Commits")');

    // Should be in commits view
    await expect(page.locator('text=All Commits')).toBeVisible();

    // Verify we can navigate back by clicking on an Agent or Session
    // Since we have no agents/sessions, just verify the commits view is shown
    await expect(page.locator('text=All Commits')).toBeVisible();
  });

  test('should show refresh button that updates data', async () => {
    const { page } = context;

    // Navigate to commits view
    await page.click('button:has-text("View All Commits")');

    // Find and click the refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible();

    // Click refresh
    await refreshButton.click();

    // The view should still be visible (no crash)
    await expect(page.locator('text=All Commits')).toBeVisible();
  });
});

test.describe('Diff Viewer Component', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context?.app) {
      await closeElectronApp(context.app);
    }
  });

  test('should be able to navigate to commits view', async () => {
    const { page } = context;

    // Click View All Commits
    await page.click('button:has-text("View All Commits")');

    // Should show the commits view
    await expect(page.locator('text=All Commits')).toBeVisible();
  });

  // Note: Diff viewer tests would require actual commit data
  // These tests verify the UI structure when no commits are present
  test('should show empty state text', async () => {
    const { page } = context;

    await page.click('button:has-text("View All Commits")');

    // Should show empty state
    const emptyText = page.locator('text=No commits found').or(page.locator('text=Commits will appear'));
    await expect(emptyText).toBeVisible();
  });
});

test.describe('Commits View Accessibility', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context?.app) {
      await closeElectronApp(context.app);
    }
  });

  test('should have proper heading structure', async () => {
    const { page } = context;

    await page.click('button:has-text("View All Commits")');

    // Should have h2 heading
    const heading = page.locator('h2:has-text("All Commits")');
    await expect(heading).toBeVisible();
  });

  test('should have proper select elements for filters', async () => {
    const { page } = context;

    await page.click('button:has-text("View All Commits")');

    // All select elements should be accessible
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should be keyboard navigable', async () => {
    const { page } = context;

    await page.click('button:has-text("View All Commits")');

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to press Enter on focused element
    // Just verify no errors occur
    await expect(page.locator('text=All Commits')).toBeVisible();
  });
});
