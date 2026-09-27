import type {
    BlockedNavigation, JestBrowserReporterOptions, ReporterEventMap, RunOptions, RunSummary, StatusFilter, TestResult, TestStatus
} from '../types';
import { getRegisteredTests, runTests, TEST_TIMEOUT_KEY } from '../runner/runner';
import { createTestPredicate } from '../runner/testFilter';
import { formatErrorsHtml, formatSourceCodeHtml } from '../utils/SourceCodeFormat';
import { debounce, queryRequired } from '../utils/dom';
import { formatDuration } from '../utils/format';
import { guardNavigation } from './navigationGuard';
import { ResultsTable } from './ResultsTable';
import { RunningIndicator } from './RunningIndicator';
import { nextSort, type SortColumn, type SortState } from './sorting';
import { DurationStore, RunRecordStore, SettingsStore } from './storage';
import { LABELS, renderLayout, renderNotice, renderNoticeDetails, renderStats, type RunTiming } from './templates';
import { countStatuses, normalizeResult, toSerializable } from './testResults';
import './styles.css';

/** Name of the `window` property that receives the {@link RunSummary} (without source code) after each run. */
export const RESULTS_GLOBAL = '__JEST_BROWSER_RESULTS__';
/** Name of the `window` event dispatched after each run; its `detail` is the same object as {@link RESULTS_GLOBAL}. */
export const FINISH_EVENT = 'jest-browser-reporter:finish';

const EMPTY_MESSAGE = 'No results yet. Press "Run All" to start.';

type Listeners = { [K in keyof ReporterEventMap]: Set<(payload: ReporterEventMap[K]) => void> };

interface ActiveRun {
    controller: AbortController;
    /** Tests selected to run, and how many of them finished. */
    testCount: number;
    done: number;
    /** Results received but not yet shown; flushed once per animation frame. */
    pending: TestResult[];
    frame: number;
    /** Selected tests that have not finished yet, for the time estimate. */
    remaining: Set<string>;
    /** Real run time per remembered test time: covers hooks and overhead in the estimate. */
    estimateScale: number;
    /** Remembered duration of each test before this run. */
    previous: Map<string, number | null>;
    currentTest: string | null;
    blockedNavigations: BlockedNavigation[];
    releaseNavigation: () => void;
    /** One notice per run lists all blocked navigations. */
    navigationNotice: HTMLElement | null;
}

/**
 * Runs the registered tests and shows the results on the page.
 *
 * @example
 * ```js
 * import { JestBrowserReporter } from 'jest-browser-reporter';
 *
 * const reporter = new JestBrowserReporter({ container: '#root', title: 'My tests' });
 * reporter.on('testDone', result => console.log(result.fullName, result.status));
 * const summary = await reporter.run({ filter: /Signature/ });
 * console.log(summary.counts);
 * ```
 */
export class JestBrowserReporter {
    private readonly options: JestBrowserReporterOptions;
    private readonly root: HTMLElement;
    private readonly table: ResultsTable;
    private readonly indicator: RunningIndicator;
    private readonly settings: SettingsStore;
    private readonly runRecords: RunRecordStore;
    private readonly durations: DurationStore;
    private readonly elements: {
        stats: HTMLElement;
        search: HTMLInputElement;
        searchClear: HTMLElement;
        runAll: HTMLButtonElement;
        runFailed: HTMLButtonElement;
        runFiltered: HTMLButtonElement;
        export: HTMLButtonElement;
        notices: HTMLElement;
    };

    private filter: StatusFilter;
    private search: string;
    private groupBySuite: boolean;
    private readonly collapsedGroups: Set<string>;
    private savedFailedTests: string[];
    private sort: SortState | null;
    /** Duration of the last finished run, shown in the summary. */
    private timing: RunTiming | null = null;
    /** Describes the limit of the next run (set by an auto-run), e.g. `search "sign"`. */
    private nextRunLabel: string | null = null;
    /** The notice about a limited auto-run; removed when another run starts. */
    private autoRunNotice: HTMLElement | null = null;
    private runPromise: Promise<RunSummary> | null = null;
    /** Actions of the notice buttons. */
    private readonly noticeActions = new WeakMap<HTMLElement, () => void>();
    /** The previous run did not finish, so an auto-run now could repeat whatever ended it. */
    private previousRunInterrupted = false;

    /** Shown results by full name, in registration order; merged across filtered runs. */
    private readonly shown = new Map<string, TestResult>();
    /**
     * Rows of registered tests without a result yet ("NOT RUN", or SKIP for `.skip` tests), so the
     * table always lists every test. They are not results: `results`, the export and the failed
     * tests ignore them.
     */
    private readonly placeholders = new WeakSet<TestResult>();
    /** Shown results that the last run did not run because its filter excluded them. */
    private readonly stale = new Set<string>();
    private activeRun: ActiveRun | null = null;
    private summary: RunSummary | null = null;
    private readonly listeners: Listeners = { runStart: new Set(), testStart: new Set(), testDone: new Set(), runFinish: new Set() };

    private readonly onKeydown = (e: KeyboardEvent) => this.handleKeydown(e);
    private readonly onBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
    };

    /** Clicked element selector → action; the first match wins. */
    private readonly clickActions: Array<[selector: string, action: (el: HTMLElement) => void]> = [
        ['.run-btn', el => this.runFromUi({ tests: [rowId(el)] })],
        ['.run-all-btn', () => this.activeRun ? this.stop() : this.runFromUi()],
        ['.run-failed-btn', () => this.runFromUi({ onlyFailed: true })],
        ['.run-filtered-btn', () => this.runFromUi({ tests: this.filteredTests() })],
        ['.export-btn', () => this.exportResults()],
        ['.filter-btn', el => this.setFilter((el.dataset.filter as StatusFilter) || 'all')],
        ['.group-toggle-btn', () => this.toggleGrouping()],
        ['.search-clear', () => this.clearSearch()],
        ['.notice-action', el => { this.noticeActions.get(el.closest<HTMLElement>('.reporter-notice')!)?.(); }],
        ['.notice-close', el => el.closest('.reporter-notice')?.remove()],
        ['.toggle-error', el => this.togglePanel(el, 'error')],
        ['.toggle-source', el => this.togglePanel(el, 'source')],
        ['.group-header', el => this.toggleGroup(el.dataset.group || '')],
        ['th.sortable', el => this.toggleSort(el.dataset.sort as SortColumn)],
    ];

    /**
     * Renders the reporter into `options.container`. Tests registered by then are
     * counted in the idle message; tests may also be registered later.
     */
    constructor(options: JestBrowserReporterOptions = {}) {
        this.options = options;
        const baseKey = options.storageKey || `jest-browser-reporter:${location.pathname}`;
        const persist = options.persistSettings !== false;
        this.settings = new SettingsStore(persist ? baseKey : null);
        this.runRecords = new RunRecordStore(baseKey);
        this.durations = new DurationStore(persist ? baseKey : null);

        const saved = this.settings.load();
        this.filter = saved.filter ?? 'all';
        this.search = normalizeSearch(saved.search ?? '');
        this.groupBySuite = saved.groupBySuite ?? !!options.groupBySuite;
        this.collapsedGroups = new Set(saved.collapsedGroups);
        this.savedFailedTests = saved.failedTests ?? [];
        this.sort = saved.sort ?? null;

        if (options.defaultTimeout) (globalThis as unknown as Record<string, unknown>)[TEST_TIMEOUT_KEY] = options.defaultTimeout;

        this.root = document.createElement('div');
        this.root.className = 'jest-browser-reporter';
        this.root.dataset.theme = options.theme || 'light';
        this.root.innerHTML = renderLayout({
            title: options.title,
            backLink: options.backLink ?? !!options.showBackLink,
            filter: this.filter,
            search: saved.search ?? '',
            groupBySuite: this.groupBySuite,
        });
        resolveContainer(options.container).appendChild(this.root);

        this.elements = {
            stats: queryRequired(this.root, '.summary-stats'),
            search: queryRequired<HTMLInputElement>(this.root, '.search-input'),
            searchClear: queryRequired(this.root, '.search-clear'),
            runAll: queryRequired<HTMLButtonElement>(this.root, '.run-all-btn'),
            runFailed: queryRequired<HTMLButtonElement>(this.root, '.run-failed-btn'),
            runFiltered: queryRequired<HTMLButtonElement>(this.root, '.run-filtered-btn'),
            export: queryRequired<HTMLButtonElement>(this.root, '.export-btn'),
            notices: queryRequired(this.root, '.reporter-notices'),
        };
        this.table = new ResultsTable(queryRequired(this.root, '#test-results-body'), this.groupBySuite, this.collapsedGroups,
            fullName => !this.skippedTests().has(fullName));
        this.table.clear(EMPTY_MESSAGE);
        this.indicator = new RunningIndicator(queryRequired(this.root, '.running-indicator'));
        this.updateSortHeaders();

        this.root.addEventListener('click', e => this.handleClick(e));
        const applySearch = debounce(() => this.setSearch(this.elements.search.value), 180);
        this.elements.search.addEventListener('input', () => {
            this.settings.save({ search: this.elements.search.value }); // right away: a reload may come before the debounce
            applySearch();
        });
        document.addEventListener('keydown', this.onKeydown);

        const interrupted = this.runRecords.takeInterrupted();
        this.previousRunInterrupted = !!interrupted;
        if (interrupted) {
            const where = interrupted.currentTest ? ` while "${interrupted.currentTest}" was running` : '';
            this.showNotice(`The previous run did not finish: the page was reloaded or left${where} `
                + `(${interrupted.done} of ${interrupted.testCount} tests done).`);
        }

        this.updateButtons();
        const url = options.urlParams === false ? {} : readUrlParams();
        if (options.autoRun || url.autorun) {
            setTimeout(() => this.startAutoRun(options.autoRun === 'all' ? 'all' : 'filtered', url.grep), 0);
        } else {
            this.refreshIdleState();
        }
    }

    /** Results currently shown: the latest result of every test, across filtered runs. */
    get results(): readonly TestResult[] {
        return this.realResults();
    }

    /** Summary of the last finished run, or `null` before the first one. */
    get lastRun(): RunSummary | null {
        return this.summary;
    }

    /** Whether a run is in progress. */
    get isRunning(): boolean {
        return !!this.activeRun;
    }

    /** Full names of the tests that failed last time; remembered across visits when settings persist. */
    get failedTests(): string[] {
        const results = this.realResults();
        if (!results.length) return [...this.savedFailedTests];
        return results.filter(r => r.status === 'fail').map(r => r.fullName);
    }

    /**
     * Runs the tests and shows the results as they arrive.
     *
     * Without criteria, all tests run and the table is rebuilt. With criteria, only matching
     * tests run; the others keep their previous result, marked as not run this time.
     *
     * @param options - Which tests to run. A string is a {@link TestFilter} (deprecated form).
     * @returns The summary of the run; also for a run that was stopped.
     * @throws If a run is already in progress.
     */
    async run(options: RunOptions | string = {}): Promise<RunSummary> {
        if (typeof options === 'string') options = { filter: options };
        if (this.activeRun) throw new Error('jest-browser-reporter: tests are already running');

        const filter = createTestPredicate(options, this.failedTests);
        const run: ActiveRun = {
            controller: new AbortController(), testCount: 0, done: 0, pending: [], frame: 0,
            remaining: new Set(), estimateScale: 1, previous: new Map(),
            currentTest: null, blockedNavigations: [], releaseNavigation: () => undefined, navigationNotice: null,
        };
        if (this.options.blockNavigation !== false) {
            run.releaseNavigation = guardNavigation(url => this.onNavigationBlocked(run, url));
        }
        const external = options.signal;
        const abort = () => this.stop();
        if (external?.aborted) run.controller.abort();
        external?.addEventListener('abort', abort);

        this.activeRun = run;
        delete (window as unknown as Record<string, unknown>)[RESULTS_GLOBAL];
        if (!filter) {
            this.shown.clear();
            this.stale.clear();
        }
        this.syncWithRegistry(); // every test gets a row now; results replace them as they arrive
        const label = this.nextRunLabel;
        this.nextRunLabel = null;
        if (!label) {
            this.autoRunNotice?.remove();
            this.autoRunNotice = null;
        }
        this.timing = null;
        this.setRunningUi(true);
        let message = filter ? 'Running selected tests' : 'Running all tests';
        this.indicator.showRunning(message);

        const startedAt = Date.now();
        try {
            const { results, aborted } = await runTests({
                filter,
                // Tests named explicitly (a row's "▶ Run", run({ tests })) run even if they are .skip
                runSkipped: !!options.tests,
                signal: run.controller.signal,
                onRunStart: tests => {
                    run.testCount = tests.length;
                    run.remaining = new Set(tests.map(t => t.fullName));
                    if (label) message = `Filtered run: ${tests.length} of ${getRegisteredTests().length} tests (${label})`;
                    this.indicator.setMessage(message);
                    // A full run is best predicted by the last full run; otherwise sum the tests
                    const testsMs = this.durations.estimate(run.remaining);
                    const lastFullRunMs = this.durations.lastFullRunMs;
                    const estimatedMs = !filter && lastFullRunMs !== null ? lastFullRunMs : testsMs;
                    run.estimateScale = estimatedMs && testsMs ? estimatedMs / testsMs : 1;

                    if (estimatedMs !== null) this.indicator.setMessage(`${message} · ≈ ${formatDuration(estimatedMs)}`);
                    this.indicator.setProgress(0, run.testCount);
                    this.updateEstimate(run);
                    this.runRecords.begin(run.testCount);
                    this.emit('runStart', { testCount: run.testCount, estimatedMs });
                },
                onTestStart: test => {
                    run.currentTest = test.fullName;
                    this.indicator.setStatus(test.fullName);
                    this.runRecords.update({ testCount: run.testCount, done: run.done, currentTest: test.fullName });
                    this.emit('testStart', test);
                },
                onTestDone: result => {
                    const previous = this.durations.get(result.fullName);
                    run.previous.set(result.fullName, previous);
                    result.previousDuration = previous;
                    if (result.duration !== null && (result.status === 'pass' || result.status === 'fail')) {
                        this.durations.set(result.fullName, result.duration);
                    }
                    run.remaining.delete(result.fullName);
                    if (result.status === 'pass' || result.status === 'fail') {
                        run.done++;
                        this.indicator.setProgress(run.done, run.testCount);
                        this.updateEstimate(run);
                    }
                    run.pending.push(result);
                    run.frame ||= requestAnimationFrame(() => this.flushPending(run));
                    this.emit('testDone', result);
                },
            });

            this.flushPending(run);
            for (const result of results) result.previousDuration = run.previous.get(result.fullName) ?? null;
            const summary: RunSummary = {
                results,
                counts: countStatuses(results.filter(r => !r.filteredOut).map(r => r.status)),
                startedAt,
                durationMs: Date.now() - startedAt,
                aborted,
                blockedNavigations: run.blockedNavigations,
            };
            this.summary = summary;
            this.finishRun(summary, !filter, run.testCount);
            return summary;
        } catch (error) {
            this.indicator.showError('Test execution failed: ' + (error instanceof Error ? error.message : String(error)));
            throw error;
        } finally {
            run.releaseNavigation();
            cancelAnimationFrame(run.frame);
            external?.removeEventListener('abort', abort);
            this.activeRun = null;
            this.runRecords.end();
            this.setRunningUi(false);
        }
    }

    /** Runs only the tests that failed last time (see {@link failedTests}). */
    runFailed(): Promise<RunSummary> {
        return this.run({ onlyFailed: true });
    }

    /**
     * Runs the tests the table currently shows: those matching the search text and the status
     * filter. Before the first run, the search applies to the registered tests.
     */
    runFiltered(): Promise<RunSummary> {
        return this.run({ tests: this.filteredTests() });
    }

    /**
     * Stops the current run. The test that is running finishes; the remaining
     * selected tests are reported as `cancel`.
     */
    stop(): void {
        if (!this.activeRun || this.activeRun.controller.signal.aborted) return;
        this.activeRun.controller.abort();
        this.indicator.setMessage('Stopping after the current test…');
    }

    /**
     * Subscribes to a reporter event.
     * @returns A function that unsubscribes.
     */
    on<K extends keyof ReporterEventMap>(event: K, handler: (payload: ReporterEventMap[K]) => void): () => void {
        const set = this.listeners[event] as Set<typeof handler>;
        set.add(handler);
        return () => set.delete(handler);
    }

    /**
     * Shows results produced elsewhere, e.g. by the legacy global `run()`.
     * Accepts {@link TestResult}s and raw jest-lite results.
     */
    render(results: ReadonlyArray<Partial<TestResult> & { status: TestStatus }>): void {
        this.shown.clear();
        this.stale.clear();
        for (const input of results || []) {
            const result = normalizeResult(input);
            this.shown.set(result.fullName, result);
        }
        this.indicator.hide();
        this.rebuildTable();
        this.refreshSummary();
    }

    /** Removes the reporter from the page and its global listeners. */
    destroy(): void {
        this.stop();
        document.removeEventListener('keydown', this.onKeydown);
        window.removeEventListener('beforeunload', this.onBeforeUnload);
        this.root.remove();
    }

    /**
     * Shows the idle hint with the number of registered tests.
     * @internal
     */
    refreshIdleState(): void {
        if (!this.activeRun) this.syncWithRegistry(); // the registered tests may have changed
        this.updateButtons();
        if (this.activeRun || this.realResults().length) return;
        const count = getRegisteredTests().length;
        const lastRun = this.durations.lastFullRunMs;
        this.indicator.showIdle(count
            ? `${count} tests registered${lastRun === null ? '' : `; the last full run took ${formatDuration(lastRun)}`}. `
                + 'Press "Run All" (Ctrl+Enter) to start.'
            : 'No tests registered yet.');
    }

    /**
     * Shows a dismissible warning above the results, optionally with an action button.
     * @internal
     */
    showNotice(message: string, action?: { label: string; run: () => void }): HTMLElement {
        this.elements.notices.insertAdjacentHTML('beforeend', renderNotice(message, action?.label));
        const notice = this.elements.notices.lastElementChild as HTMLElement;
        if (action) this.noticeActions.set(notice, action.run);
        return notice;
    }

    /**
     * Starts the automatic run of `autoRun` / `?autorun`. In `filtered` mode it runs what the saved
     * search and status filter select, and announces the limit; `grep` replaces the saved filter.
     * @internal
     */
    startAutoRun(mode: 'filtered' | 'all', grep?: string): void {
        this.syncWithRegistry();
        if (this.previousRunInterrupted) {
            // A test that navigates the page away would otherwise restart the run on every load, forever
            this.previousRunInterrupted = false;
            this.indicator.showIdle('The automatic run was not started because the previous run did not finish '
                + '(see the notice above). Press "Run All" to run the tests.');
            return;
        }
        const plan = this.planAutoRun(mode, grep);
        if (!plan) {
            this.indicator.showIdle('Nothing was run: no test that can run matches the saved filter (skipped tests '
                + 'never run). Change the search or status filter, or press "Run All".');
            return;
        }
        if (plan.label) {
            this.autoRunNotice = this.showNotice(`This automatic run is limited to ${plan.label}.`,
                { label: 'Run all tests', run: () => this.runAllNow() });
        }
        this.nextRunLabel = plan.label;
        this.runFromUi(plan.options);
    }

    // #region Running

    /** Starts a run from a UI action; errors are already shown by run(). */
    private runFromUi(options?: RunOptions): void {
        if (this.activeRun) return;
        this.runPromise = this.run(options);
        this.runPromise.catch(error => console.error('jest-browser-reporter: test execution failed', error));
    }

    /** Runs all tests; a run in progress is stopped first. */
    private runAllNow(): void {
        const current = this.activeRun ? this.runPromise : null;
        this.stop();
        (current ?? Promise.resolve()).catch(() => undefined).then(() => this.runFromUi());
    }

    /**
     * What an auto-run runs: `label` describes a limit (null for all tests); `null` when the saved
     * filter selects nothing.
     */
    private planAutoRun(mode: 'filtered' | 'all', grep?: string): { options: RunOptions; label: string | null } | null {
        if (grep) return { options: { filter: grep }, label: `?grep="${grep}"` };
        const failedOnly = this.filter === 'fail';
        if (mode === 'all' || (!this.search && !failedOnly)) return { options: {}, label: null };

        // Results are not saved, so the other status filters cannot be applied before a run
        let tests = getRegisteredTests().filter(t => t.runnable).map(t => t.fullName);
        if (this.search) tests = tests.filter(name => name.toLowerCase().includes(this.search));
        if (failedOnly) {
            const failed = new Set(this.failedTests);
            tests = tests.filter(name => failed.has(name));
        }
        if (!tests.length) return null;

        const parts = [
            this.search ? `the search "${this.elements.search.value.trim()}"` : '',
            failedOnly ? 'the tests that failed last time' : '',
        ].filter(Boolean);
        return { options: { tests }, label: parts.join(' and ') };
    }

    private emit<K extends keyof ReporterEventMap>(event: K, payload: ReporterEventMap[K]): void {
        for (const handler of this.listeners[event]) {
            try {
                handler(payload);
            } catch (error) {
                console.error(`jest-browser-reporter: "${event}" handler failed`, error);
            }
        }
    }

    private flushPending(run: ActiveRun): void {
        run.frame = 0;
        if (!run.pending.length) return;
        for (const result of run.pending.splice(0)) this.showResult(result);
        this.refreshSummary();
        this.updateEstimate(run);
    }

    /** A test tried to leave the page; the guard cancelled it. */
    private onNavigationBlocked(run: ActiveRun, url: string): void {
        const test = run.currentTest;
        console.warn(`jest-browser-reporter: blocked a navigation to ${url} by ${test ? `"${test}"` : 'a hook'}`);
        run.blockedNavigations.push({ test, url });

        const count = run.blockedNavigations.length;
        const message = count === 1
            ? 'A test tried to leave the page. The navigation was blocked and the run went on:'
            : `Tests tried to leave the page ${count} times. The navigations were blocked and the run went on:`;
        const lines = [...new Set(run.blockedNavigations.map(n => `${n.test ?? 'A hook'} → ${n.url || 'another address'}`))];

        if (!run.navigationNotice?.isConnected) run.navigationNotice = this.showNotice(message);
        const body = run.navigationNotice.querySelector('.notice-body')!;
        body.querySelector('.notice-text')!.textContent = message;
        body.querySelector('.notice-details')?.remove();
        body.insertAdjacentHTML('beforeend', renderNoticeDetails(lines));
    }

    /** Time left, from the remembered durations of the tests that have not finished. */
    private updateEstimate(run: ActiveRun): void {
        const remainingMs = this.durations.estimate(run.remaining);
        this.indicator.setEstimate(remainingMs === null || !run.remaining.size
            ? ''
            : `≈ ${formatDuration(remainingMs * run.estimateScale)} left`);
    }

    /** A test excluded by the filter keeps its previous result, marked as stale. */
    private showResult(result: TestResult): void {
        const existing = this.shown.get(result.fullName);
        if (result.filteredOut && existing && this.placeholders.has(existing)) return; // still not run
        if (result.filteredOut && existing) {
            this.stale.add(result.fullName);
            this.table.setStale(result.fullName, true);
            return;
        }
        this.stale.delete(result.fullName);
        this.shown.set(result.fullName, result);
        this.table.upsert(result, false);
    }

    private finishRun(summary: RunSummary, fullRun: boolean, testCount: number): void {
        if (summary.aborted) {
            this.indicator.showIdle(`Run stopped: ${summary.counts.cancel} tests cancelled.`);
        } else if (testCount === 0) {
            this.indicator.showIdle(summary.counts.skip
                ? 'No test was run: the selected tests are all skipped (.skip). To run one anyway, use "▶ Run" in its row.'
                : 'No test was run: no test matches the selection.');
        } else {
            this.indicator.hide();
        }
        this.settings.save({ failedTests: this.failedTests });

        const completeFullRun = fullRun && !summary.aborted;
        this.timing = {
            durationMs: summary.durationMs,
            previousMs: completeFullRun ? this.durations.lastFullRunMs : null,
            partial: !fullRun,
        };
        if (completeFullRun) this.durations.lastFullRunMs = summary.durationMs;
        this.durations.save();
        this.refreshSummary();

        const published = { ...summary, results: summary.results.map(toSerializable) };
        (window as unknown as Record<string, unknown>)[RESULTS_GLOBAL] = published;
        window.dispatchEvent(new CustomEvent(FINISH_EVENT, { detail: published }));
        this.emit('runFinish', summary);
    }

    private setRunningUi(running: boolean): void {
        this.root.classList.toggle('is-running', running);
        this.elements.runAll.textContent = running ? LABELS.stop : LABELS.runAll;
        this.elements.runAll.classList.toggle('stop', running);
        this.elements.runAll.title = running ? 'Stop after the current test' : 'Run all tests (Ctrl+Enter)';
        if (this.options.confirmLeaveWhileRunning !== false) {
            if (running) window.addEventListener('beforeunload', this.onBeforeUnload);
            else window.removeEventListener('beforeunload', this.onBeforeUnload);
        }
        this.updateButtons();
    }

    // #endregion

    // #region Table and summary

    private rebuildTable(): void {
        const entries = [...this.shown.values()].map(result => ({ result, stale: this.stale.has(result.fullName) }));
        this.table.rebuild(entries, this.groupBySuite, EMPTY_MESSAGE);
        if (this.sort) this.table.applySort(this.sort);
        this.applyFilter();
    }

    private refreshSummary(): void {
        this.elements.stats.innerHTML = renderStats(countStatuses([...this.shown.values()].map(r => r.status)), this.timing);
        if (this.sort) this.table.applySort(this.sort); // new rows are appended unsorted
        this.applyFilter();
        this.updateButtons();
    }

    private toggleSort(column: SortColumn): void {
        this.sort = nextSort(this.sort, column);
        this.settings.save({ sort: this.sort });
        this.updateSortHeaders();
        this.table.applySort(this.sort);
    }

    private updateSortHeaders(): void {
        const sort = this.sort;
        this.root.querySelectorAll<HTMLElement>('th.sortable').forEach(th => {
            const direction = sort && sort.column === th.dataset.sort ? sort.direction : null;
            th.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none');
            th.querySelector('.sort-indicator')!.textContent = direction === 'asc' ? ' ▲' : direction === 'desc' ? ' ▼' : '';
        });
    }

    private applyFilter(): void {
        this.table.applyFilter({ status: this.filter, search: this.search });
    }

    private updateButtons(): void {
        const running = !!this.activeRun;
        const failedCount = this.failedTests.length;
        this.elements.runFailed.textContent = LABELS.runFailed(failedCount);
        this.elements.runFailed.disabled = running || failedCount === 0;
        // Without a search or status filter, "Run Filtered" would be "Run All"
        const filterActive = !!this.search || this.filter !== 'all';
        const matching = filterActive ? this.filteredTests(true) : [];
        const runnableCount = matching.filter(name => !this.skippedTests().has(name)).length;
        this.elements.runFiltered.textContent = LABELS.runFiltered(runnableCount);
        this.elements.runFiltered.disabled = running || runnableCount === 0;
        this.elements.runFiltered.title = matching.length && !runnableCount
            ? 'The tests shown are all skipped (.skip). To run one anyway, use "▶ Run" in its row.'
            : 'Run the tests shown by the search and status filter (Ctrl+Shift+Enter)';
        this.elements.export.disabled = running || this.realResults().length === 0;
    }

    private realResults(): TestResult[] {
        return [...this.shown.values()].filter(r => !this.placeholders.has(r));
    }

    /**
     * Gives every registered test a row, in registration order: its result if it has one, otherwise
     * a placeholder. Rebuilds the table.
     */
    private syncWithRegistry(): void {
        const registered = getRegisteredTests();
        if (!registered.length) return;
        const ordered = new Map<string, TestResult>();
        for (const test of registered) {
            let result = this.shown.get(test.fullName);
            if (!result) {
                result = normalizeResult({
                    name: test.name,
                    suitePath: test.suitePath,
                    fullName: test.fullName,
                    // 'pending' is a display-only status: shown as "NOT RUN", never in a result
                    status: (test.runnable ? 'pending' : 'skip') as TestStatus,
                    duration: null,
                    previousDuration: this.durations.get(test.fullName),
                });
                this.placeholders.add(result);
            }
            ordered.set(test.fullName, result);
        }
        for (const [name, result] of this.shown) if (!ordered.has(name)) ordered.set(name, result);
        this.shown.clear();
        for (const [name, result] of ordered) this.shown.set(name, result);
        this.rebuildTable();
        this.refreshSummary();
    }

    /** Full names of the registered tests that never run (`.skip`, no body). */
    private skippedTests(): Set<string> {
        return new Set(getRegisteredTests().filter(t => !t.runnable).map(t => t.fullName));
    }

    /**
     * Full names of the tests matching the search text and status filter, as the table shows them;
     * without `includeSkipped`, only those that can run.
     */
    private filteredTests(includeSkipped = false): string[] {
        const matching = this.matchingTests();
        if (includeSkipped) return matching;
        const skipped = this.skippedTests();
        return matching.filter(name => !skipped.has(name));
    }

    private matchingTests(): string[] {
        const matchesSearch = (fullName: string) => !this.search || fullName.toLowerCase().includes(this.search);
        if (!this.realResults().length) {
            // Nothing run yet: only the search can apply, to the registered tests
            return this.filter === 'all'
                ? getRegisteredTests().map(t => t.fullName).filter(matchesSearch)
                : [];
        }
        return [...this.shown.values()]
            .filter(r => (this.filter === 'all' || r.status === this.filter) && matchesSearch(r.fullName))
            .map(r => r.fullName);
    }

    private togglePanel(button: HTMLElement, kind: 'error' | 'source'): void {
        const result = this.shown.get(rowId(button));
        const panels = button.closest('tr')?.querySelector('.test-panels');
        if (!result || !panels) return;

        const selector = kind === 'error' ? '.error-details' : '.source-code';
        let panel = panels.querySelector<HTMLElement>(selector);
        if (!panel) {
            panels.insertAdjacentHTML('beforeend', kind === 'error'
                ? formatErrorsHtml(result.errors)
                : formatSourceCodeHtml(result.sourceCode));
            panel = panels.querySelector<HTMLElement>(selector);
            if (!panel) return;
            panel.style.display = 'none';
        }
        const show = panel.style.display === 'none';
        panel.style.display = show ? 'block' : 'none';
        button.textContent = kind === 'error'
            ? (show ? LABELS.hideError : LABELS.showError)
            : (show ? LABELS.hideSource : LABELS.showSource);
    }

    private exportResults(): void {
        const data = {
            exportedAt: new Date().toISOString(),
            counts: countStatuses(this.realResults().map(r => r.status)),
            results: this.realResults().map(toSerializable),
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'test-results.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    // #endregion

    // #region Controls

    private setFilter(filter: StatusFilter): void {
        this.filter = filter;
        this.root.querySelectorAll<HTMLElement>('.filter-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.filter === filter));
        this.settings.save({ filter });
        this.applyFilter();
        this.updateButtons();
    }

    private setSearch(value: string): void {
        this.search = normalizeSearch(value);
        this.elements.searchClear.classList.toggle('hidden', !value);
        this.settings.save({ search: value });
        this.applyFilter();
        this.updateButtons();
    }

    private clearSearch(): void {
        this.elements.search.value = '';
        this.setSearch('');
        this.elements.search.focus();
    }

    private toggleGrouping(): void {
        this.groupBySuite = !this.groupBySuite;
        this.root.querySelector('.group-toggle-btn')?.classList.toggle('active', this.groupBySuite);
        this.settings.save({ groupBySuite: this.groupBySuite });
        this.rebuildTable();
    }

    private toggleGroup(groupKey: string): void {
        this.table.toggleGroup(groupKey);
        this.settings.save({ collapsedGroups: [...this.collapsedGroups] });
        this.applyFilter();
    }

    private handleClick(ev: MouseEvent): void {
        const target = ev.target as HTMLElement;
        for (const [selector, action] of this.clickActions) {
            const element = target.closest<HTMLElement>(selector);
            if (element && this.root.contains(element)) {
                ev.preventDefault();
                if (!(element as HTMLButtonElement).disabled) action(element);
                return;
            }
        }
    }

    private handleKeydown(e: KeyboardEvent): void {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key === 'f') {
            e.preventDefault();
            this.elements.search.focus();
        } else if (e.key === 'Escape' && document.activeElement === this.elements.search) {
            if (this.elements.search.value) this.clearSearch();
            else this.elements.search.blur();
        } else if (ctrl && e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            if (!this.elements.runFiltered.disabled) this.runFromUi({ tests: this.filteredTests() });
        } else if (ctrl && e.key === 'Enter') {
            e.preventDefault();
            this.runFromUi();
        }
    }

    // #endregion
}

function resolveContainer(container: HTMLElement | string | undefined): HTMLElement {
    if (!container) return document.body;
    if (typeof container !== 'string') return container;
    const element = document.querySelector<HTMLElement>(container);
    if (!element) throw new Error(`jest-browser-reporter: container "${container}" not found`);
    return element;
}

function normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
}

function rowId(element: HTMLElement): string {
    return element.closest<HTMLElement>('tr[data-id]')?.dataset.id ?? '';
}

/** `?autorun` (unless `0` or `false`) and `?grep=text`. */
export function readUrlParams(): { autorun?: boolean; grep?: string } {
    const params = new URLSearchParams(location.search);
    const autorun = params.get('autorun');
    return {
        autorun: autorun !== null && autorun !== '0' && autorun !== 'false',
        grep: params.get('grep') || undefined,
    };
}
