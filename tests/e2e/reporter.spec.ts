import { expect, test, type Page } from '@playwright/test';

const stat = (page: Page, name: string) => page.locator(`.stat.${name} .stat-value`);
const rows = (page: Page) => page.locator('tr.group-row');

async function openReporter(page: Page, query = '') {
    await page.goto(`/tests/e2e/pages/reporter.html${query}`);
    await page.waitForFunction(() => (window as any).reporter);
}

async function waitForRunEnd(page: Page) {
    await page.waitForFunction(() => !document.querySelector('.jest-browser-reporter.is-running')
        && (window as any).__JEST_BROWSER_RESULTS__);
}

test('shows results while the run is in progress', async ({ page }) => {
    await openReporter(page, '?delay=300');
    await expect(page.locator('.running-indicator')).toContainText('8 tests registered');

    await page.click('.run-all-btn');

    await expect(page.locator('.run-all-btn')).toHaveText(/Stop/);
    await expect(page.locator('.running-progress-text')).toHaveText('0 / 7');
    await expect(page.locator('.running-status-text')).toHaveText('Math › adds');
    // First results show up long before the run ends
    await expect(rows(page).first()).toHaveAttribute('data-status', 'pass');
    await expect(page.locator('.jest-browser-reporter')).toHaveClass(/is-running/);
    await expect(page.locator('.running-progress-text')).toHaveText(/^[1-6] \/ 7$/);

    await waitForRunEnd(page);
    await expect(stat(page, 'pass')).toHaveText('6');
    await expect(stat(page, 'fail')).toHaveText('1');
    await expect(page.locator('.running-indicator')).toBeHidden();
});

test('Stop cancels the remaining tests', async ({ page }) => {
    await openReporter(page, '?delay=300');
    await page.click('.run-all-btn');
    await expect(rows(page)).not.toHaveCount(0);

    await page.click('.run-all-btn'); // now "Stop"
    await expect(page.locator('.running-main-text')).toHaveText(/Stopping/);
    await waitForRunEnd(page);

    await expect(page.locator('.run-all-btn')).toHaveText(/Run All/);
    await expect(page.locator('.running-indicator')).toContainText('Run stopped');
    expect(Number(await stat(page, 'cancel').textContent())).toBeGreaterThan(0);
    await expect(page.locator('tr[data-status="cancel"]').first()).toBeVisible();
});

test('remembers settings and failed tests across reloads; Run Failed re-runs only them', async ({ page }) => {
    await openReporter(page);
    await page.click('.run-all-btn');
    await waitForRunEnd(page);

    await page.click('.filter-btn[data-filter="fail"]');
    await page.click('.group-toggle-btn');
    await page.fill('.search-input', 'math');

    await page.reload();
    await page.waitForFunction(() => (window as any).reporter);
    await expect(page.locator('.filter-btn[data-filter="fail"]')).toHaveClass(/active/);
    await expect(page.locator('.group-toggle-btn')).toHaveClass(/active/);
    await expect(page.locator('.search-input')).toHaveValue('math');
    await expect(page.locator('.run-failed-btn')).toHaveText(/Run Failed \(1\)/);
    await expect(page.locator('.run-failed-btn')).toBeEnabled();

    await page.click('.run-failed-btn');
    await waitForRunEnd(page);
    const summary = await page.evaluate(() => (window as any).__JEST_BROWSER_RESULTS__);
    expect(summary.counts).toEqual({ total: 1, pass: 0, fail: 1, skip: 0, cancel: 0 });
    await expect(page.locator('tr.group-header[data-group="Math"]')).toBeVisible();
    await expect(rows(page).locator('visible=true')).toHaveCount(1);
});

test('the row button runs one test; the others keep their results, marked stale', async ({ page }) => {
    await openReporter(page);
    await page.click('.run-all-btn');
    await waitForRunEnd(page);

    await page.locator('tr[data-id="Slow › step 1"] .run-btn').click();
    await waitForRunEnd(page);

    await expect(page.locator('tr[data-id="Slow › step 1"]')).not.toHaveClass(/stale/);
    await expect(page.locator('tr[data-id="Slow › step 2"]')).toHaveClass(/stale/);
    await expect(stat(page, 'pass')).toHaveText('6');
});

test('Run Filtered runs exactly the tests found by the search', async ({ page }) => {
    await openReporter(page);
    await expect(page.locator('.run-filtered-btn')).toBeDisabled();

    await page.fill('.search-input', 'step');
    await expect(page.locator('.run-filtered-btn')).toHaveText(/Run Filtered \(5\)/);
    await page.click('.run-filtered-btn');
    await waitForRunEnd(page);

    const summary = await page.evaluate(() => (window as any).__JEST_BROWSER_RESULTS__);
    expect(summary.counts).toEqual({ total: 5, pass: 5, fail: 0, skip: 0, cancel: 0 });
    await expect(rows(page).locator('visible=true')).toHaveCount(5);

    await page.fill('.search-input', 'step 2');
    await expect(page.locator('.run-filtered-btn')).toHaveText(/Run Filtered \(1\)/);
    await page.keyboard.press('Control+Shift+Enter');
    await waitForRunEnd(page);
    expect((await page.evaluate(() => (window as any).__JEST_BROWSER_RESULTS__)).counts.total).toBe(1);
});

test('sorting by column, formatted durations with the previous time, and a run estimate', async ({ page }) => {
    await openReporter(page, '?delay=1100');
    await page.fill('.search-input', 'step 1');
    await page.click('.run-filtered-btn');
    await waitForRunEnd(page);
    await expect(page.locator('tr[data-id="Slow › step 1"] .duration')).toHaveText(/^1sec \d+ms$/);
    await expect(page.locator('.stat.time .stat-value')).toHaveText(/^1sec( \d+ms)?$/);

    // Second run of the same test: previous duration and an estimate are known
    await page.click('.run-filtered-btn');
    await expect(page.locator('.running-main-text')).toHaveText(/Running selected tests · ≈ 1sec/);
    await expect(page.locator('.running-estimate')).toHaveText(/≈ 1sec( \d+ms)? left/);
    await waitForRunEnd(page);
    await expect(page.locator('tr[data-id="Slow › step 1"] .duration-prev')).toHaveText(/prev 1sec \d+ms/);

    await page.fill('.search-input', '');
    await page.goto('/tests/e2e/pages/reporter.html');
    await page.waitForFunction(() => (window as any).reporter);
    await page.click('.run-all-btn');
    await waitForRunEnd(page);
    const ids = () => page.$$eval('tr.group-row', rows => rows.map(r => (r as HTMLElement).dataset.id));

    await page.click('th[data-sort="status"]');
    expect((await ids())[0]).toBe('Math › fails');
    await page.click('th[data-sort="status"]');
    expect((await ids())[0]).not.toBe('Math › fails');
    await page.click('th[data-sort="status"]');
    expect(await ids()).toEqual(['Math › adds', 'Math › fails', 'Math › skipped', 'Slow › step 1', 'Slow › step 2', 'Slow › step 3', 'Slow › step 4', 'Slow › step 5']);
});

test('error and source panels open on demand', async ({ page }) => {
    await openReporter(page);
    await page.click('.run-all-btn');
    await waitForRunEnd(page);

    const failed = page.locator('tr[data-status="fail"]');
    await failed.locator('.toggle-error').click();
    await expect(failed.locator('.error-details')).toContainText('Expected');
    await failed.locator('.toggle-source').click();
    await expect(failed.locator('.source-code')).toContainText('expect(1).toBe(2)');
    await page.screenshot({ path: 'test-results/reporter-light.png', fullPage: true });
});

test('dark theme renders', async ({ page }) => {
    await openReporter(page, '?theme=dark');
    await page.click('.run-all-btn');
    await waitForRunEnd(page);
    await expect(page.locator('.jest-browser-reporter')).toHaveAttribute('data-theme', 'dark');
    const background = await page.locator('.jest-browser-reporter').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(background).toBe('rgb(15, 23, 42)');
    await page.screenshot({ path: 'test-results/reporter-dark.png', fullPage: true });
});

test('Export JSON downloads the results without source code', async ({ page }) => {
    await openReporter(page);
    await page.click('.run-all-btn');
    await waitForRunEnd(page);

    const [download] = await Promise.all([page.waitForEvent('download'), page.click('.export-btn')]);
    const json = JSON.parse(await (await download.createReadStream()).toArray().then(chunks => Buffer.concat(chunks).toString()));
    expect(download.suggestedFilename()).toBe('test-results.json');
    expect(json.counts.total).toBe(8);
    expect(json.results[0]).not.toHaveProperty('sourceCode');
});

test('?autorun&grep= starts a filtered run', async ({ page }) => {
    await openReporter(page, '?autorun&grep=step');
    await waitForRunEnd(page);
    const summary = await page.evaluate(() => (window as any).__JEST_BROWSER_RESULTS__);
    expect(summary.counts).toEqual({ total: 5, pass: 5, fail: 0, skip: 0, cancel: 0 });
});

test('asks for confirmation before leaving during a run', async ({ page }) => {
    await openReporter(page, '?delay=2000');
    await page.click('.run-all-btn');
    await expect(page.locator('.jest-browser-reporter')).toHaveClass(/is-running/);

    const dialog = page.waitForEvent('dialog');
    page.reload().catch(() => { });
    const shown = await dialog;
    expect(shown.type()).toBe('beforeunload');
    await shown.dismiss(); // stay on the page
    await expect(page.locator('.jest-browser-reporter')).toHaveClass(/is-running/);
});

test('reports a run that the page left mid-way', async ({ page }) => {
    await page.goto('/tests/e2e/pages/reload.html');
    await page.waitForFunction(() => (window as any).reporter);
    await page.click('.run-all-btn');

    await page.waitForFunction(() => sessionStorage.getItem('reloaded') && (window as any).reporter);
    await expect(page.locator('.reporter-notice')).toBeVisible();
    await expect(page.locator('.notice-text')).toContainText('"Suite › reloads the page" was running (1 of 3 tests done)');
    await page.click('.notice-close');
    await expect(page.locator('.reporter-notice')).toBeHidden();
});

test('the 1.x API keeps working', async ({ page }) => {
    await page.goto('/tests/e2e/pages/legacy.html');
    await waitForRunEnd(page);
    await expect(stat(page, 'total')).toHaveText('8');
    await expect(stat(page, 'pass')).toHaveText('6');
    await expect(page.locator('.back-link')).toBeVisible();
});
