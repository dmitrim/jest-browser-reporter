import jestLite from './jestLiteFixed';
import type { TestInfo, TestResult, TestStatus } from '../types';

// Only the parts of jest-lite's internal structures that are used here.
interface JestLiteDescribe {
    name: string;
    mode?: 'skip' | 'only';
    parent?: JestLiteDescribe;
    tests: JestLiteTest[];
    children: JestLiteDescribe[];
}

interface JestLiteTest {
    name: string;
    fn?: Function;
    mode?: 'skip' | 'only';
    parent: JestLiteDescribe;
    status: TestStatus | null;
    errors: unknown[];
    duration: number | null;
    startedAt: number | null;
}

interface JestLiteState {
    rootDescribeBlock: JestLiteDescribe;
    hasFocusedTests: boolean;
}

interface JestLiteEvent {
    name: string;
    test?: JestLiteTest;
}

export interface TestRunOptions {
    /** When set, runs the tests it accepts, ignoring `.only`. `.skip` tests run only with `runSkipped`. */
    filter?: (test: TestInfo) => boolean;
    /** Lets `filter` select `.skip` tests too: for tests the user asked for by name. */
    runSkipped?: boolean;
    signal?: AbortSignal;
    /** Called before the first test with the tests selected to run. */
    onRunStart?(tests: TestInfo[]): void;
    onTestStart?(test: TestInfo): void;
    onTestDone?(result: TestResult): void;
}

/** A registered test; `runnable` is false for `.skip` tests and tests without a body. */
export interface RegisteredTest extends TestInfo {
    runnable: boolean;
}

interface ActiveRun {
    options: TestRunOptions;
    aborted: boolean;
}

/** Default timeout for tests and hooks, read by jest-lite; set by `jest.setTimeout()`. */
export const TEST_TIMEOUT_KEY = '__JESTLITE_TEST_TIMEOUT';
/** Decision hooks read by the patched jest-lite runner (see `//dma:` in jestLiteFixed.js). */
const RUN_HOOKS_KEY = '__JESTLITE_RUN_HOOKS__';

const TERMINAL_EVENTS = new Set(['test_success', 'test_failure', 'test_skip', 'test_cancel']);

let state: JestLiteState | undefined;
let activeRun: ActiveRun | undefined;
const testInfoCache = new WeakMap<JestLiteTest, TestInfo>();

(globalThis as unknown as Record<string, unknown>)[RUN_HOOKS_KEY] = {
    shouldRunTest,
    isAborted: () => !!activeRun?.aborted,
};

jestLite.addEventHandler((event: JestLiteEvent, currentState: JestLiteState) => {
    state = currentState;
    const run = activeRun;
    if (!run) return;

    if (event.name === 'run_start') {
        forEachTest(currentState.rootDescribeBlock, resetTest);
        const selected: TestInfo[] = [];
        forEachTest(currentState.rootDescribeBlock, test => {
            if (shouldRunTest(test, currentState)) selected.push(getTestInfo(test));
        });
        run.options.onRunStart?.(selected);
    } else if (event.test && event.name === 'test_start') {
        run.options.onTestStart?.(getTestInfo(event.test));
    } else if (event.test && TERMINAL_EVENTS.has(event.name)) {
        run.options.onTestDone?.(toTestResult(event.test, run));
    }
});

/** Runs the registered tests. Only one run can be in progress at a time. */
export async function runTests(options: TestRunOptions = {}): Promise<{ results: TestResult[]; aborted: boolean }> {
    if (activeRun) throw new Error('jest-browser-reporter: a test run is already in progress');

    const run: ActiveRun = { options, aborted: !!options.signal?.aborted };
    const onAbort = () => { run.aborted = true; };
    options.signal?.addEventListener('abort', onAbort);
    activeRun = run;
    try {
        await jestLite.run();
        const results: TestResult[] = [];
        if (state) forEachTest(state.rootDescribeBlock, test => results.push(toTestResult(test, run)));
        return { results, aborted: run.aborted && results.some(r => r.status === 'cancel') };
    } finally {
        activeRun = undefined;
        options.signal?.removeEventListener('abort', onAbort);
    }
}

/** Tests registered so far, in registration order. */
export function getRegisteredTests(): RegisteredTest[] {
    const tests: RegisteredTest[] = [];
    if (state) forEachTest(state.rootDescribeBlock, test => tests.push({ ...getTestInfo(test), runnable: isRunnable(test) }));
    return tests;
}

/** `.skip` tests and tests without a body never run, whatever the selection. */
function isRunnable(test: JestLiteTest): boolean {
    return !!test.fn && test.mode !== 'skip' && !hasSkippedAncestor(test);
}

function shouldRunTest(test: JestLiteTest, currentState: JestLiteState): boolean {
    if (!test.fn) return false;
    const options = activeRun?.options;
    // A pattern (search, auto-run, grep) never selects `.skip` tests, as with Jest's -t: they are often
    // skipped because they cannot run here (e.g. Node.js-only tests). Tests asked for by name do run.
    if (!isRunnable(test) && !(options?.filter && options.runSkipped)) return false;
    if (options?.filter) return options.filter(getTestInfo(test));
    return !currentState.hasFocusedTests || test.mode === 'only';
}

function hasSkippedAncestor(test: JestLiteTest): boolean {
    for (let block: JestLiteDescribe | undefined = test.parent; block; block = block.parent) {
        if (block.mode === 'skip') return true;
    }
    return false;
}

/** Visits tests in registration order: a block's own tests, then its nested blocks. */
function forEachTest(block: JestLiteDescribe, visit: (test: JestLiteTest) => void): void {
    block.tests.forEach(visit);
    block.children.forEach(child => forEachTest(child, visit));
}

function resetTest(test: JestLiteTest): void {
    test.status = null;
    test.errors = [];
    test.duration = null;
    test.startedAt = null;
}

function getTestInfo(test: JestLiteTest): TestInfo {
    let info = testInfoCache.get(test);
    if (!info) {
        const suitePath: string[] = [];
        for (let block: JestLiteDescribe | undefined = test.parent; block?.parent; block = block.parent) {
            suitePath.unshift(block.name);
        }
        info = { name: test.name, suitePath, fullName: [...suitePath, test.name].join(' › ') };
        testInfoCache.set(test, info);
    }
    return info;
}

function toTestResult(test: JestLiteTest, run: ActiveRun): TestResult {
    const info = getTestInfo(test);
    const status: TestStatus = test.status || 'skip';
    const filter = run.options.filter;
    return {
        ...info,
        suitePath: [...info.suitePath],
        status,
        errors: test.errors.map(formatError),
        duration: test.duration,
        sourceCode: test.fn?.toString(),
        filteredOut: !!filter && status === 'skip' && !(test.fn && filter(info)),
        testPath: ['ROOT_DESCRIBE_BLOCK', ...info.suitePath, info.name],
    };
}

/** Same formatting as jest-lite's own `makeTestResults()`. */
function formatError(error: unknown): string {
    if (!error) return 'NO ERROR MESSAGE OR STACK TRACE SPECIFIED';
    const e = error as { stack?: string; message?: string };
    return e.stack || e.message || `${String(error)} thrown`;
}
