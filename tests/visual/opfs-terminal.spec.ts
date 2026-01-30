import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for OPFS Terminal Feature
 *
 * Tests the OPFS-based filesystem and terminal UI.
 */

test.describe('OPFS Terminal - UI Elements', () => {
  test('landing page loads with OPFS mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify terminal container is present
    const terminalContainer = page.locator('#terminal-container');
    await expect(terminalContainer).toBeVisible();
  });

  test('import files button is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const importFilesBtn = page.locator('#import-files-btn');
    await expect(importFilesBtn).toBeVisible();
    await expect(importFilesBtn).toContainText('Import Files');
  });

  test('import folder button is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const importFolderBtn = page.locator('#import-folder-btn');
    await expect(importFolderBtn).toBeVisible();
    await expect(importFolderBtn).toContainText('Import Folder');
  });

  test('storage info element is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const storageInfo = page.locator('#storage-info');
    await expect(storageInfo).toBeAttached();
  });

  test('sidebar shows OPFS Sandbox title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebarTitle = page.locator('.sidebar-title:has-text("OPFS Sandbox")');
    await expect(sidebarTitle).toBeVisible();
  });

  test('sidebar shows Terminal section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const terminalTitle = page.locator('.sidebar-title:has-text("Terminal")');
    await expect(terminalTitle).toBeVisible();
  });
});

test.describe('OPFS Terminal - Visual Regression', () => {
  test('sidebar with OPFS controls renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for terminal to initialize
    await page.waitForTimeout(500);

    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    await expect(sidebar).toHaveScreenshot('opfs-sidebar.png', {
      animations: 'disabled',
    });
  });

  test('terminal container renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for terminal to initialize
    await page.waitForTimeout(500);

    const terminalContainer = page.locator('#terminal-container');
    await expect(terminalContainer).toBeVisible();

    await expect(terminalContainer).toHaveScreenshot('terminal-container.png', {
      animations: 'disabled',
    });
  });
});

test.describe('OPFS Terminal - Responsive', () => {
  test('mobile layout shows terminal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const mobileMenuBtn = page.locator('#mobile-menu-btn');
    await mobileMenuBtn.click();

    // Wait for sidebar to be visible
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    // Terminal should be present in sidebar
    const terminalContainer = page.locator('#terminal-container');
    await expect(terminalContainer).toBeAttached();
  });
});
