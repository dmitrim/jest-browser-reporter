import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JestLiteGlobals } from '../../src/jestApi';

type Lib = typeof import('../../src/index');

let lib: Lib;
let g: JestLiteGlobals;
let reporter: InstanceType<Lib['JestBrowserReporter']> | undefined;

beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '<div id="root"></div>';
    lib = await import('../../src/index');
    lib.setupJestLiteGlobals();
    g = globalThis as unknown as JestLiteGlobals;
});

afterEach(() => {
    reporter?.destroy();
    reporter = undefined;
});

function registerSampleTests() {
    g.describe('Math', () => {
        g.it('adds', () => g.expect(1 + 1).toBe(2));
        g.it('fails <b>html</b>', () => g.expect(1).toBe(2));
        g.it.skip('skipped', () => { });
    });
    g.describe('Async', () => {
        g.it('waits', () => new Promise(resolve => setTimeout(resolve, 5)));
    });
}

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const $$ = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));
const visibleRows = () => $$('tr.group-row').filter(row => row.style.display !== 'none');
const stat = (name: string) => $(`.stat.${name} .stat-value`)?.textContent;

describe('JestBrowserReporter', () => {
    it('shows the number of registered tests before the first run', () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        expect($('.running-indicator').textContent).toContain('4 tests registered');
    });

    it('runs, shows results and returns a summary', async () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root', title: 'My <tests>' });

        const summary = await reporter.run();

        expect(summary.counts).toEqual({ total: 4, pass: 2, fail: 1, skip: 1, cancel: 0 });
        expect(summary.aborted).toBe(false);
        expect(stat('pass')).toBe('2');
        expect(stat('fail')).toBe('1');
        expect($('.reporter-title').textContent).toBe('My <tests>');
        expect($('tr[data-status="fail"] .test-name').textContent).toBe('fails <b>html</b>');
        expect(reporter.failedTests).toEqual(['Math › fails <b>html</b>']);
        expect($('.run-failed-btn').textContent).toContain('(1)');
    });

    it('publishes results for CI and emits events', async () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        const events: string[] = [];
        reporter.on('runStart', e => events.push(`runStart:${e.testCount}`));
        reporter.on('testDone', r => events.push(`testDone:${r.name}`));
        const unsubscribe = reporter.on('runFinish', () => events.push('runFinish'));
        const onFinish = vi.fn();
        window.addEventListener(lib.FINISH_EVENT, onFinish);

        await reporter.run();
        unsubscribe();
        await reporter.run();

        expect(events.filter(e => e === 'runFinish')).toHaveLength(1);
        expect(events[0]).toBe('runStart:3');
        const published = (window as any)[lib.RESULTS_GLOBAL];
        expect(published.counts.fail).toBe(1);
        expect(published.results[0]).not.toHaveProperty('sourceCode');
        expect(onFinish).toHaveBeenCalledTimes(2);
    });

    it('runs only failed tests and keeps the other results as stale', async () => {
        let attempt = 0;
        g.it('flaky', () => { if (++attempt === 1) throw new Error('first time'); });
        g.it('stable', () => { });
        reporter = new lib.JestBrowserReporter({ container: '#root' });

        await reporter.run();
        const summary = await reporter.runFailed();

        expect(summary.counts).toEqual({ total: 1, pass: 1, fail: 0, skip: 0, cancel: 0 });
        expect(reporter.results.map(r => [r.name, r.status])).toEqual([['flaky', 'pass'], ['stable', 'pass']]);
        expect($('tr[data-id="stable"]').classList.contains('stale')).toBe(true);
        expect($('tr[data-id="flaky"]').classList.contains('stale')).toBe(false);
        expect(reporter.failedTests).toEqual([]);
    });

    it('runs a single test from its row button, not tests with a longer name', async () => {
        g.it('Test3', () => { });
        g.it('Test30', () => { });
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        await reporter.run();

        const done = new Promise(resolve => reporter!.on('runFinish', resolve));
        $('tr[data-id="Test3"] .run-btn').click();
        const summary = await done as import('../../src/types').RunSummary;

        expect(summary.results.filter(r => !r.filteredOut).map(r => r.name)).toEqual(['Test3']);
    });

    it('stops a run and reports cancelled tests', async () => {
        g.it('first', () => new Promise(resolve => setTimeout(resolve, 20)));
        g.it('second', () => { });
        reporter = new lib.JestBrowserReporter({ container: '#root' });

        const running = reporter.run();
        expect(reporter.isRunning).toBe(true);
        expect($('.run-all-btn').textContent).toContain('Stop');
        $('.run-all-btn').click();
        const summary = await running;

        expect(summary.aborted).toBe(true);
        expect(summary.counts.cancel).toBe(1);
        expect(stat('cancel')).toBe('1');
        expect($('.running-indicator').textContent).toContain('1 tests cancelled');
        expect($('.run-all-btn').textContent).toContain('Run All');
    });

    it('stops when the signal passed to run() aborts', async () => {
        g.it('first', () => new Promise(resolve => setTimeout(resolve, 20)));
        g.it('second', () => { });
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        const controller = new AbortController();

        const running = reporter.run({ signal: controller.signal });
        controller.abort();

        expect((await running).counts.cancel).toBe(1);
    });

    it('filters by status and search text, and remembers the settings', async () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        await reporter.run();

        $('.filter-btn[data-filter="fail"]').click();
        expect(visibleRows().map(r => r.dataset.id)).toEqual(['Math › fails <b>html</b>']);

        $('.filter-btn[data-filter="all"]').click();
        const search = $('.search-input') as HTMLInputElement;
        search.value = 'WAIT';
        search.dispatchEvent(new Event('input'));
        await vi.waitFor(() => expect(visibleRows()).toHaveLength(1));

        $('.group-toggle-btn').click();
        $('tr.group-header[data-group="Async"]').click();
        reporter.destroy();

        reporter = new lib.JestBrowserReporter({ container: '#root' });
        expect(($('.search-input') as HTMLInputElement).value).toBe('WAIT');
        expect($('.group-toggle-btn').classList.contains('active')).toBe(true);
        await reporter.run();
        expect($('tr.group-header[data-group="Async"]').dataset.collapsed).toBe('true');
        expect(visibleRows()).toHaveLength(0);
    });

    it('runs the tests shown by the search and status filter', async () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        const runFiltered = $('.run-filtered-btn') as HTMLButtonElement;
        expect(runFiltered.disabled).toBe(true); // no filter: it would be "Run All"

        const search = $('.search-input') as HTMLInputElement;
        search.value = 'MATH';
        search.dispatchEvent(new Event('input'));
        // Before the first run the search applies to the registered tests; the .skip one is not counted
        await vi.waitFor(() => expect(runFiltered.textContent).toContain('(2)'));

        const done = new Promise<import('../../src/types').RunSummary>(resolve => reporter!.on('runFinish', resolve));
        runFiltered.click();
        const first = await done;
        expect(first.results.filter(r => !r.filteredOut).map(r => r.name)).toEqual(['adds', 'fails <b>html</b>']);

        $('.filter-btn[data-filter="fail"]').click();
        expect(runFiltered.textContent).toContain('(1)');
        const second = await reporter.runFiltered();
        expect(second.results.filter(r => !r.filteredOut && r.status !== 'skip').map(r => r.name)).toEqual(['fails <b>html</b>']);

        search.value = 'no such test';
        search.dispatchEvent(new Event('input'));
        await vi.waitFor(() => expect(runFiltered.disabled).toBe(true));
    });

    it('Run Filtered skips .skip tests, but a row button runs one anyway', async () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        await reporter.run();

        const search = $('.search-input') as HTMLInputElement;
        search.value = 'skipped';
        search.dispatchEvent(new Event('input'));
        const runFiltered = $('.run-filtered-btn') as HTMLButtonElement;
        await vi.waitFor(() => expect(runFiltered.title).toContain('all skipped'));
        expect(runFiltered.disabled).toBe(true);

        // A pattern selects nothing that can run, and says so
        await reporter.run({ filter: 'skipped' });
        expect($('.running-indicator').textContent).toContain('No test was run: the selected tests are all skipped');

        // The row button forces the skipped test
        const skipRow = $('tr[data-id="Math › skipped"] .run-btn') as HTMLButtonElement;
        expect(skipRow.title).toContain('run it anyway');
        const done = new Promise<import('../../src/types').RunSummary>(resolve => reporter!.on('runFinish', resolve));
        skipRow.click();
        const forced = await done;
        expect(forced.results.find(r => r.fullName === 'Math › skipped')!.status).toBe('pass');
    });

    it('matches a saved search case-insensitively after a reload', async () => {
        registerSampleTests();
        localStorage.setItem('jest-browser-reporter:/', JSON.stringify({ search: 'WAIT' }));
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        await reporter.run();
        expect(visibleRows().map(r => r.dataset.id)).toEqual(['Async › waits']);
    });

    it('sorts by a column on header clicks and remembers the sort', async () => {
        g.it('b slow', () => new Promise(resolve => setTimeout(resolve, 30)));
        g.it('a fails', () => { throw new Error('x'); });
        g.it('c fast', () => { });
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        await reporter.run();
        const order = () => $$('tr.group-row').map(r => r.dataset.id);
        expect(order()).toEqual(['b slow', 'a fails', 'c fast']);

        $('th[data-sort="name"]').click();
        expect(order()).toEqual(['a fails', 'b slow', 'c fast']);
        expect($('th[data-sort="name"]').getAttribute('aria-sort')).toBe('ascending');
        $('th[data-sort="name"]').click();
        expect(order()).toEqual(['c fast', 'b slow', 'a fails']);
        $('th[data-sort="duration"]').click();
        expect(order()[order().length - 1]).toBe('b slow');
        expect($('th[data-sort="name"]').getAttribute('aria-sort')).toBe('none');
        reporter.destroy();

        reporter = new lib.JestBrowserReporter({ container: '#root' });
        await reporter.run();
        expect($('th[data-sort="duration"] .sort-indicator').textContent).toContain('▲');
        expect(order()[order().length - 1]).toBe('b slow');
        $('th[data-sort="duration"]').click();
        $('th[data-sort="duration"]').click();
        expect(order()).toEqual(['b slow', 'a fails', 'c fast']); // registration order again
    });

    it('remembers durations: previous time per test, run estimate, total time', async () => {
        g.it('waits', () => new Promise(resolve => setTimeout(resolve, 40)));
        g.it('quick', () => { });
        reporter = new lib.JestBrowserReporter({ container: '#root' });

        const first = await reporter.run();
        expect(first.results[0].previousDuration).toBeNull();
        expect($('.duration-prev')).toBeNull();
        expect($('.stat.time .stat-label').textContent).toBe('Duration');
        reporter.destroy();

        reporter = new lib.JestBrowserReporter({ container: '#root' });
        expect($('.running-indicator').textContent).toMatch(/the last full run took \d+ms/);
        const starts: Array<number | null> = [];
        reporter.on('runStart', e => starts.push(e.estimatedMs));
        const second = await reporter.run();

        expect(starts[0]).toBe(first.durationMs);
        expect(second.results[0].previousDuration).toBe(first.results[0].duration);
        expect($('tr[data-id="waits"] .duration-prev').textContent).toMatch(/prev \d+ms/);
        expect($('.stat.time .stat-label').textContent).toContain('prev');
    });

    it('does not persist durations when settings do not persist', async () => {
        g.it('t', () => { });
        reporter = new lib.JestBrowserReporter({ container: '#root', persistSettings: false });
        await reporter.run();
        expect(localStorage.length).toBe(0);
    });

    it('does not persist settings when disabled', async () => {
        reporter = new lib.JestBrowserReporter({ container: '#root', persistSettings: false });
        $('.filter-btn[data-filter="fail"]').click();
        expect(localStorage.length).toBe(0);
    });

    it('remembers failed tests across visits', async () => {
        g.it('bad', () => { throw new Error('x'); });
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        await reporter.run();
        reporter.destroy();

        reporter = new lib.JestBrowserReporter({ container: '#root' });
        expect(reporter.failedTests).toEqual(['bad']);
        expect(($('.run-failed-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('reports a run interrupted by a reload', () => {
        sessionStorage.setItem('jest-browser-reporter:/:run', JSON.stringify({ testCount: 9, done: 4, currentTest: 'S › slow' }));
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        expect($('.reporter-notice').classList.contains('hidden')).toBe(false);
        expect($('.notice-text').textContent).toContain('"S › slow" was running (4 of 9 tests done)');
    });

    it('asks before leaving while tests run', async () => {
        g.it('slow', () => new Promise(resolve => setTimeout(resolve, 20)));
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        const running = reporter.run();

        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        await running;

        const after = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
    });

    it('opens error and source panels on demand', async () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        await reporter.run();

        const row = $('tr[data-status="fail"]');
        expect(row.querySelector('.error-details')).toBeNull();
        (row.querySelector('.toggle-error') as HTMLElement).click();
        expect((row.querySelector('.error-details') as HTMLElement).style.display).toBe('block');
        expect(row.querySelector('.toggle-error')!.textContent).toContain('Hide');
        (row.querySelector('.toggle-source') as HTMLElement).click();
        expect(row.querySelector('.source-code')!.textContent).toContain('expect(1).toBe(2)');
    });

    it('still renders raw results passed to render()', () => {
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        reporter.render([{ status: 'pass', testPath: ['ROOT_DESCRIBE_BLOCK', 'S', 't'], errors: [], duration: 1 }]);
        expect($('tr.group-row').dataset.id).toBe('S › t');
        expect(stat('total')).toBe('1');
    });

    it('accepts the deprecated string filter', async () => {
        g.it('alpha', () => { });
        g.it('beta', () => { });
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        const summary = await reporter.run('alp');
        expect(summary.counts.total).toBe(1);
    });

    it('rejects a second concurrent run', async () => {
        g.it('slow', () => new Promise(resolve => setTimeout(resolve, 20)));
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        const running = reporter.run();
        await expect(reporter.run()).rejects.toThrow('already running');
        await running;
    });
});

describe('auto-run with a saved filter', () => {
    const finished = (r: InstanceType<Lib['JestBrowserReporter']>) =>
        new Promise<import('../../src/types').RunSummary>(resolve => r.on('runFinish', resolve));
    // Tests that actually ran: not excluded by the filter and not .skip
    const ran = (s: import('../../src/types').RunSummary) =>
        s.results.filter(r => !r.filteredOut && r.status !== 'skip').map(r => r.fullName);

    it('runs only the tests matching the saved search and says so', async () => {
        registerSampleTests();
        localStorage.setItem('jest-browser-reporter:/', JSON.stringify({ search: 'Math' }));
        reporter = new lib.JestBrowserReporter({ container: '#root', autoRun: true });
        const summary = await finished(reporter);

        expect(ran(summary)).toEqual(['Math › adds', 'Math › fails <b>html</b>']);
        expect($('.notice-text').textContent).toContain('limited to the search "Math"');
        expect($('.stat.time .stat-label').textContent).toBe('Duration · filtered run');

        // "Run all tests" in the notice runs everything and removes the notice
        const all = finished(reporter);
        $('.notice-action').click();
        expect(ran(await all)).toHaveLength(3);
        expect($('.reporter-notice')).toBeNull();
    });

    it('with the saved status filter "Failed", runs the remembered failed tests', async () => {
        registerSampleTests();
        localStorage.setItem('jest-browser-reporter:/', JSON.stringify({ filter: 'fail', failedTests: ['Async › waits'] }));
        reporter = new lib.JestBrowserReporter({ container: '#root', autoRun: true });
        expect(ran(await finished(reporter))).toEqual(['Async › waits']);
        expect($('.notice-text').textContent).toContain('the tests that failed last time');
    });

    it('runs nothing when the saved filter matches nothing', async () => {
        registerSampleTests();
        localStorage.setItem('jest-browser-reporter:/', JSON.stringify({ search: 'no such test' }));
        reporter = new lib.JestBrowserReporter({ container: '#root', autoRun: true });
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(reporter.isRunning).toBe(false);
        expect($('.running-indicator').textContent).toContain('no test that can run matches the saved filter');
    });

    it("autoRun: 'all' and an explicit run() ignore the saved filter", async () => {
        registerSampleTests();
        localStorage.setItem('jest-browser-reporter:/', JSON.stringify({ search: 'Math' }));
        reporter = new lib.JestBrowserReporter({ container: '#root', autoRun: 'all' });
        expect(ran(await finished(reporter))).toHaveLength(3);
        expect($('.reporter-notice')).toBeNull();
        expect(ran(await reporter.run())).toHaveLength(3);
    });

    it('does not auto-run after an interrupted run, so a navigating test cannot loop', async () => {
        registerSampleTests();
        sessionStorage.setItem('jest-browser-reporter:/:run', JSON.stringify({ testCount: 4, done: 1, currentTest: 'Math › adds' }));
        reporter = new lib.JestBrowserReporter({ container: '#root', autoRun: true });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(reporter.isRunning).toBe(false);
        expect($('.notice-text').textContent).toContain('"Math › adds" was running');
        expect($('.running-indicator').textContent).toContain('automatic run was not started');

        // The next load auto-runs again
        reporter.destroy();
        reporter = new lib.JestBrowserReporter({ container: '#root', autoRun: true });
        expect((await finished(reporter)).counts.total).toBe(4);
    });
});

describe('rows of tests without results', () => {
    it('lists every registered test before the first run: NOT RUN, or SKIP for .skip tests', () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root' });

        expect($$('tr.group-row').map(r => [r.dataset.id, r.dataset.status])).toEqual([
            ['Math › adds', 'pending'], ['Math › fails <b>html</b>', 'pending'], ['Math › skipped', 'skip'], ['Async › waits', 'pending'],
        ]);
        expect($('tr[data-id="Math › adds"] .status-indicator').textContent).toContain('NOT RUN');
        expect(stat('total')).toBe('4');
        expect(reporter.results).toEqual([]);
        expect(($('.export-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('after a reload whose saved search finds only .skip tests, they are listed and can be run from their row', async () => {
        registerSampleTests();
        localStorage.setItem('jest-browser-reporter:/', JSON.stringify({ search: 'skipped' }));
        reporter = new lib.JestBrowserReporter({ container: '#root', autoRun: true });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(reporter.isRunning).toBe(false);
        expect(visibleRows().map(r => [r.dataset.id, r.dataset.status])).toEqual([['Math › skipped', 'skip']]);

        const done = new Promise<import('../../src/types').RunSummary>(resolve => reporter!.on('runFinish', resolve));
        (visibleRows()[0].querySelector('.run-btn') as HTMLElement).click();
        await done;
        expect(visibleRows().map(r => [r.dataset.id, r.dataset.status])).toEqual([['Math › skipped', 'pass']]);
        expect($('tr[data-id="Math › adds"]').dataset.status).toBe('pending'); // still not run
        expect(reporter.results.map(r => r.fullName)).toEqual(['Math › skipped']);
    });

    it('keeps every row during a full run, updating statuses in place', async () => {
        registerSampleTests();
        reporter = new lib.JestBrowserReporter({ container: '#root' });
        const running = reporter.run();
        expect($$('tr.group-row')).toHaveLength(4);
        await running;
        expect($$('tr.group-row').map(r => r.dataset.status)).toEqual(['pass', 'fail', 'skip', 'pass']);
    });
});

describe('createTestPage', () => {
    it('installs globals before loading the tests, then waits for a click', async () => {
        lib.resetJestLiteGlobals();
        reporter = await lib.createTestPage({
            container: '#root',
            tests: () => {
                (globalThis as any).it('registered by the loader', () => { });
            },
        });
        expect($('.running-indicator').textContent).toContain('1 tests registered');
        expect(reporter.isRunning).toBe(false);
    });

    it('shows a load error on the page', async () => {
        await expect(lib.createTestPage({
            container: '#root',
            tests: () => Promise.reject(new Error('syntax error in foo.test.js')),
        })).rejects.toThrow('syntax error');
        expect($('.notice-text').textContent).toContain('Failed to load the tests: syntax error in foo.test.js');
    });

    it('starts a run with autoRun', async () => {
        const page = await lib.createTestPage({ container: '#root', autoRun: true, tests: () => g.it('t', () => { }) });
        reporter = page;
        await vi.waitFor(() => expect(page.lastRun?.counts.pass).toBe(1));
    });
});
