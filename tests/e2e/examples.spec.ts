import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Every example must load and produce the expected results against the built package,
// so that the examples shipped in the package never go stale.

async function runToEnd(page: Page, url: string) {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    const handle = await page.waitForFunction(() => (window as any).__JEST_BROWSER_RESULTS__);
    return { summary: await handle.jsonValue(), errors };
}

const expectations: Record<string, { fail: number; minTotal: number }> = {
    'quick-start': { fail: 0, minTotal: 5 },
    typescript: { fail: 0, minTotal: 5 },
    features: { fail: 2, minTotal: 24 },
    'ci-playwright': { fail: 0, minTotal: 3 },
};

for (const [name, expected] of Object.entries(expectations)) {
    test(`example ${name}`, async ({ page }) => {
        const { summary, errors } = await runToEnd(page, `/examples/${name}/index.html?autorun`);
        expect(errors).toEqual([]);
        expect(summary.counts.fail).toBe(expected.fail);
        expect(summary.counts.total).toBeGreaterThanOrEqual(expected.minTotal);
    });
}

test('example script-tag (UMD from the CDN)', async ({ page }) => {
    const umd = fs.readFileSync(path.resolve(__dirname, '../../dist/umd/index.js'));
    await page.route('https://cdn.jsdelivr.net/npm/jest-browser-reporter@2/umd/index.js',
        route => route.fulfill({ body: umd, contentType: 'text/javascript' }));

    await page.goto('/examples/script-tag/index.html');
    await page.click('.run-all-btn');
    const summary = await (await page.waitForFunction(() => (window as any).__JEST_BROWSER_RESULTS__)).jsonValue();
    expect(summary.counts).toMatchObject({ total: 3, pass: 3 });
});

test('example programmatic-api', async ({ page }) => {
    await page.goto('/examples/programmatic-api/index.html');
    await expect(page.locator('#log')).toContainText('failed tests remembered');

    await page.click('#run-math');
    await expect(page.locator('#log')).toContainText(/■ finished .*: [0-9]+ passed/);
    await expect(page.locator('#log')).toContainText('Math › adds');
    await expect(page.locator('#log')).not.toContainText('slow step');

    await page.click('#run-timeout');
    await expect(page.locator('#log')).toContainText('(stopped)', { timeout: 10_000 });
});
