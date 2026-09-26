import type { StatusCounts, TestResult, TestStatus } from '../types';

/** Synthetic top-level block jest-lite puts at the start of every raw test path. */
const ROOT_DESCRIBE_BLOCK = 'ROOT_DESCRIBE_BLOCK';

const STATUSES: readonly TestStatus[] = ['pass', 'fail', 'skip', 'cancel'];

/** Suite shown as the group of a test when grouping by suite. */
export function getGroupKey(test: TestResult): string {
    return test.suitePath[0] || test.name || 'Ungrouped';
}

export function countStatuses(statuses: Iterable<string | undefined>): StatusCounts {
    const counts: StatusCounts = { total: 0, pass: 0, fail: 0, skip: 0, cancel: 0 };
    for (const status of statuses) {
        counts.total++;
        if (STATUSES.includes(status as TestStatus)) counts[status as TestStatus]++;
    }
    return counts;
}

/**
 * Accepts both {@link TestResult}s and the raw results of jest-lite's `run()`
 * (`{ status, testPath, errors, duration }`), which `render()` used to take.
 */
export function normalizeResult(input: Partial<TestResult> & { status: TestStatus }): TestResult {
    const rawPath = Array.isArray(input.testPath) ? input.testPath.filter(p => !!p && p !== ROOT_DESCRIBE_BLOCK) : [];
    const name = input.name ?? rawPath[rawPath.length - 1] ?? 'Unnamed Test';
    const suitePath = input.suitePath ?? rawPath.slice(0, -1);
    return {
        ...input,
        name,
        suitePath,
        fullName: input.fullName ?? [...suitePath, name].join(' › '),
        errors: (input.errors ?? []).map(String),
        duration: input.duration ?? null,
        testPath: input.testPath ?? [ROOT_DESCRIBE_BLOCK, ...suitePath, name],
    };
}

/** A result without its source code, for JSON output. */
export function toSerializable({ sourceCode: _sourceCode, ...rest }: TestResult): Omit<TestResult, 'sourceCode'> {
    return rest;
}
