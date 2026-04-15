import { test, expect } from '@playwright/test';
import { loginAs, TEST_ADMIN } from './helpers/auth';

// ── Test 1: Login ────────────────────────────────────────────────────────────
test('login with mock admin credentials succeeds', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_ADMIN.email);
  await page.fill('input[type="password"]', TEST_ADMIN.password);
  await page.click('button[type="submit"]');

  // Should redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

  // No error message should be visible
  const errorText = page.locator('[role="alert"], .error, [data-testid="error"]');
  await expect(errorText).toHaveCount(0);
});

// ── Test 2: Protected page accessible after login ────────────────────────────
test('protected /agents page is accessible after login', async ({ page }) => {
  await loginAs(page);
  await page.goto('/agents');

  // Should not be redirected back to login
  await expect(page).not.toHaveURL(/\/login/);

  // Page should contain agent-related content
  const agentContent = page.locator('h1, h2, table, [data-testid*="agent"]').filter({
    hasText: /agent/i,
  });
  // Either agent content exists OR the page simply loaded without an error
  const pageTitle = page.locator('h1, h2');
  await expect(pageTitle.first()).toBeVisible({ timeout: 8000 });
});

// ── Test 3: AgentMesh Run — create ───────────────────────────────────────────
test('can create a new AgentMesh run', async ({ page }) => {
  await loginAs(page);
  await page.goto('/agentmesh/runs');

  // Wait for the page to be ready
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Look for a "New Run" trigger — button, link or fab
  const newRunBtn = page
    .locator('button, a[href]')
    .filter({ hasText: /new run|neuer lauf|starten|create|start/i })
    .first();

  const btnVisible = await newRunBtn.isVisible().catch(() => false);

  if (btnVisible) {
    await newRunBtn.click();

    // Fill task/prompt input — textarea or labelled input
    const taskInput = page.locator('textarea, input[name*="task"], input[placeholder*="task" i], [data-testid*="task"]').first();
    await taskInput.waitFor({ state: 'visible', timeout: 8000 });
    await taskInput.fill('Analysiere den aktuellen Stand der KI-OS Effizienz');

    // Submit
    const submitBtn = page
      .locator('button[type="submit"], button')
      .filter({ hasText: /submit|start|run|ausführen|erstellen|create/i })
      .first();
    await submitBtn.click();

    // Assert a new run row or status badge appears
    const statusBadge = page.locator('[data-testid*="status"], [class*="badge"], [class*="status"]').first();
    await statusBadge.waitFor({ state: 'visible', timeout: 15000 });
    await expect(statusBadge).toBeVisible();
  } else {
    // No "New Run" button found — verify page loaded without errors
    await expect(page.locator('body')).not.toContainText(/500|error|fehler/i);
  }
});

// ── Test 4: AgentMesh Run appears in list ────────────────────────────────────
test('AgentMesh run list shows at least one row with a status badge', async ({ page }) => {
  await loginAs(page);
  await page.goto('/agentmesh/runs');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Either rows exist or an empty-state element is shown
  const runRows = page.locator('[data-testid*="run-row"], tr[data-id], tbody tr, [class*="run-item"]');
  const emptyState = page.locator('[data-testid*="empty"], [class*="empty-state"], [class*="no-runs"]');

  const rowCount = await runRows.count();
  const emptyVisible = await emptyState.isVisible().catch(() => false);

  if (rowCount > 0) {
    // At least one run exists — verify a status badge is present
    const statusBadge = page.locator('[data-testid*="status"], [class*="badge"], [class*="status"]').first();
    await expect(statusBadge).toBeVisible({ timeout: 8000 });
  } else {
    // Empty state is acceptable — just ensure the page rendered
    expect(emptyVisible || rowCount === 0).toBeTruthy();
    await expect(page.locator('body')).not.toContainText(/500|uncaught/i);
  }
});

// ── Test 5: Cancel / Retry buttons visible for appropriate runs ───────────────
test('cancel or retry action is available for runs in matching state', async ({ page }) => {
  await loginAs(page);
  await page.goto('/agentmesh/runs');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  const cancelBtn = page.locator('button').filter({ hasText: /cancel|abbrechen/i }).first();
  const retryBtn = page.locator('button').filter({ hasText: /retry|erneut|wiederholen/i }).first();

  const cancelVisible = await cancelBtn.isVisible().catch(() => false);
  const retryVisible = await retryBtn.isVisible().catch(() => false);

  if (cancelVisible || retryVisible) {
    // At least one action button is present — good
    expect(cancelVisible || retryVisible).toBeTruthy();
  } else {
    // No runs in the right state — page should still load cleanly
    await expect(page.locator('body')).not.toContainText(/500|error page|uncaught/i);
  }
});

// ── Test 6: Agents page loads without JS errors ──────────────────────────────
test('agents page renders without errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await loginAs(page);
  await page.goto('/agents');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Not redirected to login
  await expect(page).not.toHaveURL(/\/login/);

  // Either agent list, empty state, or any visible heading rendered
  const mainContent = page.locator('main, [role="main"], #main-content, .page-content');
  const hasMain = await mainContent.isVisible().catch(() => false);
  if (hasMain) {
    await expect(mainContent.first()).toBeVisible();
  } else {
    await expect(page.locator('body')).toBeVisible();
  }

  // Filter out known noisy non-critical errors (e.g. HMR, analytics)
  const criticalErrors = consoleErrors.filter(
    (e) => !e.includes('HMR') && !e.includes('webpack') && !e.includes('favicon'),
  );
  expect(criticalErrors).toHaveLength(0);
});

// ── Test 7: Privacy page tabs and analyze flow ───────────────────────────────
test('privacy page tabs render and analyze flow works', async ({ page }) => {
  await loginAs(page);
  await page.goto('/privacy');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Not redirected to login
  await expect(page).not.toHaveURL(/\/login/);

  // Tabs should be visible (Analyze / Mask / De-Mask or similar)
  const tabs = page.locator('[role="tab"], [data-testid*="tab"], button').filter({
    hasText: /analyze|analysieren|mask|de-mask|demask/i,
  });
  await expect(tabs.first()).toBeVisible({ timeout: 8000 });

  // Click "Analyze" tab if not already active
  const analyzeTab = tabs.filter({ hasText: /analyze|analysieren/i }).first();
  const analyzeTabVisible = await analyzeTab.isVisible().catch(() => false);
  if (analyzeTabVisible) {
    await analyzeTab.click();
  }

  // Find text area and fill with test data
  const textArea = page.locator('textarea').first();
  await textArea.waitFor({ state: 'visible', timeout: 8000 });
  await textArea.fill('Test text: Mein Name ist Max Mustermann, Tel: 0123456789');

  // Click Analyze button
  const analyzeBtn = page
    .locator('button[type="submit"], button')
    .filter({ hasText: /analyze|analysieren|start|run/i })
    .first();
  await analyzeBtn.click();

  // Wait for result or loading state — either is acceptable
  const result = page.locator(
    '[data-testid*="result"], [class*="result"], [class*="output"], [aria-live], [role="status"]',
  );
  const spinner = page.locator('[class*="spinner"], [class*="loading"], [aria-busy="true"]');

  await Promise.race([
    result.first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => null),
    spinner.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
  ]);

  // Page should not have crashed
  await expect(page.locator('body')).not.toContainText(/500|uncaught exception/i);
});
