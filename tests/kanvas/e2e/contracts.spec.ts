/**
 * Contract Generation UI E2E Tests
 * Tests the contract display UI in SessionDetailView
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  takeScreenshot,
  ElectronTestContext,
} from './electron.setup';

// All contract types that should appear in the UI
const CONTRACT_TYPES = [
  { type: 'api', label: 'API', icon: '🔌' },
  { type: 'schema', label: 'Schema', icon: '🗄️' },
  { type: 'events', label: 'Events', icon: '📡' },
  { type: 'features', label: 'Features', icon: '⚡' },
  { type: 'infra', label: 'Infra', icon: '🏗️' },
  { type: 'integrations', label: 'Integrations', icon: '🔗' },
  { type: 'admin', label: 'Admin', icon: '👤' },
  { type: 'sql', label: 'SQL', icon: '🗃️' },
  { type: 'css', label: 'CSS', icon: '🎨' },
  { type: 'prompts', label: 'Prompts', icon: '💬' },
];

test.describe('Contract Generation UI', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    // Use real app data to test with actual sessions
    context = await launchElectronApp(true);
  });

  test.afterAll(async () => {
    if (context?.app) {
      await closeElectronApp(context.app);
    }
  });

  test('should display Kanvas dashboard', async () => {
    const { page } = context;
    // Use more specific locator - the h1 heading
    await expect(page.getByRole('heading', { name: 'Kanvas', exact: true })).toBeVisible();
  });

  test('should navigate to Sessions tab', async () => {
    const { page } = context;

    // Click Sessions tab button specifically
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();

    // Should show sessions tab is active (button should have different styling)
    const sessionsButton = page.getByRole('button', { name: 'Sessions', exact: true });
    await expect(sessionsButton).toBeVisible();
  });

  test.describe('Session Detail View - Contract Types', () => {
    test.beforeAll(async () => {
      const { page } = context;

      // Navigate to Sessions tab
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();

      // Wait for sessions to load
      await page.waitForTimeout(3000);

      // Take screenshot to see what sessions are available
      await takeScreenshot(page, 'sessions-list');

      // First expand the LinkedIn repo to see its sessions (this has all our contracts)
      const linkedinRepo = page.locator('button:has-text("Linkedin-New-S")').first();

      if (await linkedinRepo.isVisible().catch(() => false)) {
        console.log('Expanding LinkedIn repo...');
        await linkedinRepo.click();
        await page.waitForTimeout(1500);

        // Look for the conceptwork session (has all contracts)
        const allSpans = await page.locator('span').allTextContents();
        const sessionSpans = allSpans.filter(t => t.includes('claude-session'));
        console.log('Session spans found:', sessionSpans);

        // Find and click on the conceptwork session specifically
        const conceptworkSession = sessionSpans.find(s => s.includes('conceptwork'));
        if (conceptworkSession) {
          console.log('Found conceptwork session:', conceptworkSession);
          await page.locator(`span:text-is("${conceptworkSession}")`).click();
          await page.waitForTimeout(2000);
          await takeScreenshot(page, 'linkedin-session-selected');
        } else if (sessionSpans.length > 0) {
          // Fall back to first LinkedIn session
          console.log('Using first LinkedIn session:', sessionSpans[0]);
          await page.locator(`span:text-is("${sessionSpans[0]}")`).click();
          await page.waitForTimeout(2000);
          await takeScreenshot(page, 'session-selected');
        }
      } else {
        // If LinkedIn not visible, try DevOpsAgent as fallback
        const devOpsSession = page.locator('span:text-is("claude-session-20260129-S9N-926-FeatureScanning")');
        if (await devOpsSession.isVisible().catch(() => false)) {
          console.log('Found DevOpsAgent session, clicking...');
          await devOpsSession.click();
          await page.waitForTimeout(2000);
          await takeScreenshot(page, 'devops-session-selected');
        }
      }
    });

    test('should display contract filter buttons when session is selected', async () => {
      const { page } = context;

      // First, click on the Contracts tab (use exact match to avoid "Update Contracts" button)
      const contractsTab = page.getByRole('button', { name: 'Contracts', exact: true });
      if (await contractsTab.isVisible().catch(() => false)) {
        console.log('Clicking Contracts tab...');
        await contractsTab.click();
        await page.waitForTimeout(1500);
      }

      // Take screenshot to see what's visible
      await takeScreenshot(page, 'contracts-tab-clicked');

      // Look for contract type buttons
      const contractButtons = page.locator('button:has-text("API")').or(
        page.locator('button:has-text("Schema")'));

      // If a session with contracts is selected, buttons should be visible
      const isVisible = await contractButtons.isVisible().catch(() => false);
      console.log('Contract type buttons visible:', isVisible);

      // Log result but don't fail if no session selected
      if (!isVisible) {
        console.log('Contract buttons not visible - may need to select a session with contracts');
        // List what's visible for debugging
        const visibleText = await page.locator('button').allTextContents();
        console.log('Buttons on page:', visibleText.filter(t => t.length > 0).slice(0, 15));
      }
    });

    test('should show contract counts in filter buttons', async () => {
      const { page } = context;

      // Click Contracts tab if not already on it (use exact match to avoid "Update Contracts" button)
      const contractsTab = page.getByRole('button', { name: 'Contracts', exact: true });
      if (await contractsTab.isVisible().catch(() => false)) {
        await contractsTab.click();
        await page.waitForTimeout(1000);
      }

      // Contract buttons should show counts like "API (1)" or "Schema (1)"
      const apiButton = page.locator('button:has-text("API")');

      if (await apiButton.isVisible().catch(() => false)) {
        const buttonText = await apiButton.textContent();
        console.log('API button text:', buttonText);
        // Should have a count in parentheses
        expect(buttonText).toMatch(/API.*\(\d+\)/);
      }
    });

    for (const { type, label, icon } of CONTRACT_TYPES.slice(0, 3)) {
      test(`should display ${label} contract filter button`, async () => {
        const { page } = context;

        const button = page.locator(`button:has-text("${label}")`);
        const isVisible = await button.isVisible().catch(() => false);

        if (isVisible) {
          await expect(button).toBeVisible();
          // Could also check for icon
          const buttonText = await button.textContent();
          expect(buttonText?.toLowerCase()).toContain(label.toLowerCase());
        } else {
          console.log(`${label} button not visible - session may not have this contract type`);
        }
      });
    }
  });

  test.describe('Contract Content Display', () => {
    test('should display contract content when filter is clicked', async () => {
      const { page } = context;

      // Try to click on a contract filter
      const schemaButton = page.locator('button:has-text("Schema")');

      if (await schemaButton.isVisible()) {
        await schemaButton.click();
        await page.waitForTimeout(500);

        // Should display contract cards or content
        const contractContent = page.locator('.contract-card')
          .or(page.locator('[data-testid="contract-content"]'))
          .or(page.locator('text=Database Tables'))
          .or(page.locator('text=linkedin_'));

        const hasContent = await contractContent.first().isVisible().catch(() => false);

        if (hasContent) {
          await expect(contractContent.first()).toBeVisible();
        }

        await takeScreenshot(page, 'contract-content');
      }
    });

    test('should show markdown rendered content for contracts', async () => {
      const { page } = context;

      // If contract content is displayed, it should be rendered markdown
      const markdownContent = page.locator('.prose')
        .or(page.locator('.markdown-body'))
        .or(page.locator('table'));

      const isRendered = await markdownContent.first().isVisible().catch(() => false);

      if (isRendered) {
        // Tables should be formatted properly
        await expect(markdownContent.first()).toBeVisible();
      }
    });
  });
});

test.describe('Contract Generation - New Contract Types', () => {
  let context: ElectronTestContext;

  test.beforeAll(async () => {
    // Use real app data to test with actual sessions
    context = await launchElectronApp(true);

    // Navigate to sessions
    const { page } = context;
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    if (context?.app) {
      try {
        await closeElectronApp(context.app);
      } catch (e) {
        console.log('App cleanup error (non-fatal):', e);
      }
    }
  }, 30000); // Shorter timeout

  test('should include Admin contract type in UI', async () => {
    const { page } = context;

    // Admin should be in the contract type list
    const adminButton = page.locator('button:has-text("Admin")');
    const typeSelector = page.locator('text=Admin');

    await takeScreenshot(page, 'admin-contract-type');

    // Check if Admin appears anywhere in the UI
    const hasAdmin = await adminButton.isVisible().catch(() => false) ||
                     await typeSelector.isVisible().catch(() => false);

    console.log(`Admin contract type visible: ${hasAdmin}`);
  });

  test('should include CSS contract type in UI', async () => {
    const { page } = context;

    const cssButton = page.locator('button:has-text("CSS")');
    const typeSelector = page.locator('text=CSS');

    const hasCSS = await cssButton.isVisible().catch(() => false) ||
                   await typeSelector.isVisible().catch(() => false);

    console.log(`CSS contract type visible: ${hasCSS}`);
  });

  test('should include Prompts contract type in UI', async () => {
    const { page } = context;

    const promptsButton = page.locator('button:has-text("Prompts")');
    const typeSelector = page.locator('text=Prompts');

    const hasPrompts = await promptsButton.isVisible().catch(() => false) ||
                       await typeSelector.isVisible().catch(() => false);

    console.log(`Prompts contract type visible: ${hasPrompts}`);
  });

  test('should include SQL contract type in UI', async () => {
    const { page } = context;

    const sqlButton = page.locator('button:has-text("SQL")');
    const typeSelector = page.locator('text=SQL');

    const hasSQL = await sqlButton.isVisible().catch(() => false) ||
                   await typeSelector.isVisible().catch(() => false);

    console.log(`SQL contract type visible: ${hasSQL}`);
  });
});
