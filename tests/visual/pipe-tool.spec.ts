import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Pipe Tool
 *
 * Tests the pipe (command chaining) feature UI elements.
 */

test.describe('Pipe Tool - Permission UI', () => {
  test('pipe permission toggle is visible in tools modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    const toolsModal = page.locator('#tools-modal');
    await expect(toolsModal).toBeVisible();

    // Find the pipe permission toggle
    const pipePermission = page.locator('[data-tool="pipe"]');
    await expect(pipePermission).toBeVisible();
  });

  test('pipe permission toggle is in text processing group', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    // Verify pipe is in the text-processing group
    const textProcessingGroup = page.locator('[data-group="text-processing"]');
    const pipePermission = textProcessingGroup.locator('[data-tool="pipe"]');

    await expect(pipePermission).toBeVisible();
  });

  test('pipe permission toggle has correct label', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    // Find the permission item containing the pipe toggle
    const pipeItem = page.locator('.permission-item:has([data-tool="pipe"])');
    const toolName = pipeItem.locator('.tool-name');

    await expect(toolName).toHaveText('Pipe (Chain Commands)');
  });

  test('pipe permission toggle defaults to ask', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    const pipePermission = page.locator('[data-tool="pipe"]');
    const selectedValue = await pipePermission.inputValue();

    expect(selectedValue).toBe('ask');
  });

  test('pipe permission toggle can be changed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    const pipePermission = page.locator('[data-tool="pipe"]');

    // Change to "always"
    await pipePermission.selectOption('always');
    expect(await pipePermission.inputValue()).toBe('always');

    // Change to "never"
    await pipePermission.selectOption('never');
    expect(await pipePermission.inputValue()).toBe('never');

    // Change back to "ask"
    await pipePermission.selectOption('ask');
    expect(await pipePermission.inputValue()).toBe('ask');
  });

  test('pipe permission toggle has correct options', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    const pipePermission = page.locator('[data-tool="pipe"]');
    const options = pipePermission.locator('option');

    // Should have exactly 3 options
    await expect(options).toHaveCount(3);

    // Verify option values
    await expect(options.nth(0)).toHaveAttribute('value', 'always');
    await expect(options.nth(1)).toHaveAttribute('value', 'ask');
    await expect(options.nth(2)).toHaveAttribute('value', 'never');
  });

  test('pipe permission section displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    // Find the permission item containing the pipe toggle
    const pipeItem = page.locator('.permission-item:has([data-tool="pipe"])');

    await expect(pipeItem).toHaveScreenshot('pipe-permission-item.png', {
      animations: 'disabled',
    });
  });
});
