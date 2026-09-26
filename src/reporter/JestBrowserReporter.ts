import type {
    JestBrowserReporterOptions, ReporterEventMap, RunOptions, RunSummary, StatusFilter, TestResult, TestStatus
} from '../types';
import { getRegisteredTests, runTests, TEST_TIMEOUT_KEY } from '../runner/runner';
import { createTestPredicate } from '../runner/testFilter';
import { formatErrorsHtml, formatSourceCodeHtml } from '../utils/SourceCodeFormat';
import { debounce, queryRequired } from '../utils/dom';
import { ResultsTable } from './ResultsTable';
import { RunningIndicator } from './RunningIndicator';
import { RunRecordStore, SettingsStore } from './storage';
import { LABELS, renderLayout, renderStats } from './templates';
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
    private readonly elements: {
        stats: HTMLElement;
        search: HTMLInputElement;
        searchClear: HTMLElement;
        runAll: HTMLButtonElement;
        runFailed: HTMLButtonElement;
        export: HTMLButtonElement;
        notice: HTMLElement;
    };

    private filter: StatusFilter;
    private search: string;
    private groupBySuite: boolean;
    private readonly collapsedGroups: Set<string>;
    private savedFailedTests: string[];

    /** Shown results by full name, in registration order; merged across filtered runs. */
    private readonly shown = new Map<string, TestResult>();
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
        ['.export-btn', () => this.exportResults()],
        ['.filter-btn', el => this.setFilter((el.dataset.filter as StatusFilter) || 'all')],
        ['.group-toggle-btn', () => this.toggleGrouping()],
        ['.search-clear', () => this.clearSearch()],
        ['.notice-close', () => this.hideNotice()],
        ['.toggle-error', el => this.togglePanel(el, 'error')],
        ['.toggle-source', el => this.togglePanel(el, 'source')],
        ['.group-header', el => this.toggleGroup(el.dataset.group || '')],
    ];

    /**
     * Renders the reporter into `options.container`. Tests registered by then are
     * counted in the idle message; tests may also be registered later.
     */
    constructor(options: JestBrowserReporterOptions = {}) {
        this.options = options;
        const baseKey = options.storageKey || `jest-browser-reporter:${location.pathname}`;
        this.settings = new SettingsStore(options.persistSettings === false ? null : baseKey);
        this.runRecords = new RunRecordStore(baseKey);

        const saved = this.settings.load();
        this.filter = saved.filter ?? 'all';
        this.search = saved.search ?? '';
        this.groupBySuite = saved.groupBySuite ?? !!options.groupBySuite;
        this.collapsedGroups = new Set(saved.collapsedGroups);
        this.savedFailedTests = saved.failedTests ?? [];

        if (options.defaultTimeout) (globalThis as unknown as Record<string, unknown>)[TEST_TIMEOUT_KEY] = options.defaultTimeout;

        this.root = document.createElement('div');
        this.root.className = 'jest-browser-reporter';
        this.root.dataset.theme = options.theme || 'light';
        this.root.innerHTML = renderLayout({
            title: options.title,
            backLink: options.backLink ?? !!options.showBackLink,
            filter: this.filter,
            search: this.search,
            groupBySuite: this.groupBySuite,
        });
        resolveContainer(options.container).appendChild(this.root);

        this.elements = {
            stats: queryRequired(this.root, '.summary-stats'),
            search: queryRequired<HTMLInputElement>(this.root, '.search-input'),
            searchClear: queryRequired(this.root, '.search-clear'),
            runAll: queryRequired<HTMLButtonElement>(this.root, '.run-all-btn'),
            runFailed: queryRequired<HTMLButtonElement>(this.root, '.run-failed-btn'),
            export: queryRequired<HTMLButtonElement>(this.root, '.export-btn'),
            notice: queryRequired(this.root, '.reporter-notice'),
        };
        this.table = new ResultsTable(queryRequired(this.root, '#test-results-body'), this.groupBySuite, this.collapsedGroups);
        this.table.clear(EMPTY_MESSAGE);
        this.indicator = new RunningIndicator(queryRequired(this.root, '.running-indicator'));

        this.root.addEventListener('click', e => this.handleClick(e));
        this.elements.search.addEventListener('input', debounce(() => this.setSearch(this.elements.search.value), 180));
        document.addEventListener('keydown', this.onKeydown);

        const interrupted = this.runRecords.takeInterrupted();
        if (interrupted) {
            const where = interrupted.currentTest ? ` while "${interrupted.currentTest}" was running` : '';
            this.showNotice(`The previous run did not finish: the page was reloaded or left${where} `
                + `(${interrupted.done} of ${interrupted.testCount} tests done).`);
        }

        this.updateButtons();
        const url = options.urlParams === false ? {} : readUrlParams();
        if (options.autoRun || url.autorun) {
            setTimeout(() => this.runFromUi({ filter: url.grep }), 0);
        } else {
            this.refreshIdleState();
        }
    }

    /** Results currently shown: the latest result of every test, across filtered runs. */
    get results(): readonly TestResult[] {
        return [...this.shown.values()];
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
        if (!this.shown.size) return [...this.savedFailedTests];
        return [...this.shown.values()].filter(r => r.status === 'fail').map(r => r.fullName);
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
        const run: ActiveRun = { controller: new AbortController(), testCount: 0, done: 0, pending: [], frame: 0 };
        const external = options.signal;
        const abort = () => this.stop();
        if (external?.aborted) run.controller.abort();
        external?.addEventListener('abort', abort);

        this.activeRun = run;
        delete (window as unknown as Record<string, unknown>)[RESULTS_GLOBAL];
        if (!filter) {
            this.shown.clear();
            this.stale.clear();
            this.table.clear('Waiting for results…');
        }
        this.hideNotice();
        this.setRunningUi(true);
        this.indicator.showRunning(filter ? 'Running selected tests' : 'Running all tests');

        const startedAt = Date.now();
        try {
            const { results, aborted } = await runTests({
                filter,
                signal: run.controller.signal,
                onRunStart: testCount => {
                    run.testCount = testCount;
                    this.indicator.setProgress(0, testCount);
                    this.runRecords.begin(testCount);
                    this.emit('runStart', { testCount });
                },
                onTestStart: test => {
                    this.indicator.setStatus(test.fullName);
                    this.runRecords.update({ testCount: run.testCount, done: run.done, currentTest: test.fullName });
                    this.emit('testStart', test);
                },
                onTestDone: result => {
                    if (result.status === 'pass' || result.status === 'fail') {
                        run.done++;
                        this.indicator.setProgress(run.done, run.testCount);
                    }
                    run.pending.push(result);
                    run.frame ||= requestAnimationFrame(() => this.flushPending(run));
                    this.emit('testDone', result);
                },
            });

            this.flushPending(run);
            const summary: RunSummary = {
                results,
                counts: countStatuses(results.filter(r => !r.filteredOut).map(r => r.status)),
                startedAt,
                durationMs: Date.now() - startedAt,
                aborted,
            };
            this.summary = summary;
            this.finishRun(summary);
            return summary;
        } catch (error) {
            this.indicator.showError('Test execution failed: ' + (error instanceof Error ? error.message : String(error)));
            throw error;
        } finally {
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
        if (this.activeRun || this.shown.size) return;
        const count = getRegisteredTests().length;
        this.indicator.showIdle(count
            ? `${count} tests registered. Press "Run All" (Ctrl+Enter) to start.`
            : 'No tests registered yet.');
    }

    /**
     * Shows a dismissible warning above the results.
     * @internal
     */
    showNotice(message: string): void {
        this.elements.notice.querySelector('.notice-text')!.textContent = message;
        this.elements.notice.classList.remove('hidden');
    }

    // #region Running

    /** Starts a run from a UI action; errors are already shown by run(). */
    private runFromUi(options?: RunOptions): void {
        if (this.activeRun) return;
        this.run(options).catch(error => console.error('jest-browser-reporter: test execution failed', error));
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
    }

    /** A test excluded by the filter keeps its previous result, marked as stale. */
    private showResult(result: TestResult): void {
        if (result.filteredOut && this.shown.has(result.fullName)) {
            this.stale.add(result.fullName);
            this.table.setStale(result.fullName, true);
            return;
        }
        this.stale.delete(result.fullName);
        this.shown.set(result.fullName, result);
        this.table.upsert(result, false);
    }

    private finishRun(summary: RunSummary): void {
        if (summary.aborted) {
            this.indicator.showIdle(`Run stopped: ${summary.counts.cancel} tests cancelled.`);
        } else {
            this.indicator.hide();
        }
        this.settings.save({ failedTests: this.failedTests });

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
        this.applyFilter();
    }

    private refreshSummary(): void {
        this.elements.stats.innerHTML = renderStats(countStatuses([...this.shown.values()].map(r => r.status)));
        this.applyFilter();
        this.updateButtons();
    }

    private applyFilter(): void {
        this.table.applyFilter({ status: this.filter, search: this.search });
    }

    private updateButtons(): void {
        const running = !!this.activeRun;
        const failedCount = this.failedTests.length;
        this.elements.runFailed.textContent = LABELS.runFailed(failedCount);
        this.elements.runFailed.disabled = running || failedCount === 0;
        this.elements.export.disabled = running || this.shown.size === 0;
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
            counts: countStatuses([...this.shown.values()].map(r => r.status)),
            results: [...this.shown.values()].map(toSerializable),
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
    }

    private setSearch(value: string): void {
        this.search = value.trim().toLowerCase();
        this.elements.searchClear.classList.toggle('hidden', !value);
        this.settings.save({ search: value });
        this.applyFilter();
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

    private hideNotice(): void {
        this.elements.notice.classList.add('hidden');
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
