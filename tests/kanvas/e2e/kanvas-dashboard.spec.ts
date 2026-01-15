/**
 * Kanvas Dashboard E2E Tests
 * Tests the main dashboard functionality
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  waitForElement,
  clickButtonByText,
  takeScreenshot,
  ElectronTestContext,
} from './electron.setup';

test.describe('Kanvas Dashboard', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context?.app) {
      await closeElectronApp(context.app);
    }
  });

  test('should display the main dashboard', async () => {
    const { page } = context;

    // Should show the Kanvas header
    await expect(page.locator('text=Kanvas')).toBeVisible();
    await expect(page.locator('text=Agent Dashboard')).toBeVisible();
  });

  test('should display sidebar with tabs', async () => {
    const { page } = context;

    // Should show Agents and Sessions tabs
    await expect(page.locator('button:has-text("Agents")')).toBeVisible();
    await expect(page.locator('button:has-text("Sessions")')).toBeVisible();
  });

  test('should show Create Agent Instance button', async () => {
    const { page } = context;

    await expect(page.locator('button:has-text("Create Agent Instance")')).toBeVisible();
  });

  test('should show Settings button', async () => {
    const { page } = context;

    await expect(page.locator('button:has-text("Settings")')).toBeVisible();
  });

  test('should switch between Agents and Sessions tabs', async () => {
    const { page } = context;

    // Click Sessions tab
    await page.click('button:has-text("Sessions")');

    // Should show sessions content
    await expect(page.locator('text=No sessions reported')).toBeVisible();

    // Click Agents tab
    await page.click('button:has-text("Agents")');

    // Should show agents content
    await expect(page.locator('text=No agents connected')).toBeVisible();
  });

  test('should open Settings modal', async () => {
    const { page } = context;

    await page.click('button:has-text("Settings")');

    // Settings modal should appear
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();

    // Close the modal
    await page.click('button:has-text("Done"), button:has-text("Close")');
    await expect(page.locator('.modal')).not.toBeVisible();
  });

  test('should show empty state when no agents connected', async () => {
    const { page } = context;

    // Make sure we're on Agents tab
    await page.click('button:has-text("Agents")');

    // Should show empty state
    await expect(page.locator('text=No agents connected')).toBeVisible();
  });
});

test.describe('Dashboard Canvas', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    context = await launchElectronApp();
  });

  test.afterAll(async () => {
    if (context?.app) {
      await closeElectronApp(context.app);
    }
  });

  test('should display the dashboard canvas area', async () => {
    const { page } = context;

    // The main content area should be visible
    const mainContent = page.locator('.flex-1');
    await expect(mainContent).toBeVisible();
  });

  test('should show welcome message when no agent selected', async () => {
    const { page } = context;

    // Should show some indication to select or create an agent
    const welcomeText = page.locator('text=Select an agent').or(page.locator('text=No agent selected'));
    await expect(welcomeText).toBeVisible();
  });
});
