import { describe, expect, it } from 'vitest';
import { formatDuration } from '../../src/utils/format';
import { createComparator, nextSort } from '../../src/reporter/sorting';
import { DurationStore } from '../../src/reporter/storage';
import { normalizeResult } from '../../src/reporter/testResults';
import type { TestResult, TestStatus } from '../../src/types';

describe('formatDuration', () => {
    it.each([
        [0, '0ms'],
        [850.4, '850ms'],
        [999, '999ms'],
        [1000, '1sec'],
        [1234, '1sec 234ms'],
        [59_999, '59sec 999ms'],
        [60_000, '1min'],
        [125_300, '2min 5sec'],
        [3_600_000, '1h'],
        [3_780_000, '1h 3min'],
        [-5, '0ms'],
    ])('%d ms → %s', (ms, text) => {
        expect(formatDuration(ms)).toBe(text);
    });
});

describe('sorting', () => {
    const result = (name: string, status: TestStatus, duration: number | null): TestResult =>
        normalizeResult({ name, suitePath: ['S'], status, duration });
    const tests = [result('b', 'pass', 30), result('a10', 'fail', null), result('a2', 'skip', 10), result('c', 'fail', 20)];
    const order = new Map(tests.map((t, i) => [t.fullName, i]));
    const names = (column: 'status' | 'name' | 'duration', direction: 'asc' | 'desc') =>
        [...tests].sort(createComparator({ column, direction }, order)).map(t => t.name);

    it('cycles ascending → descending → none, and restarts on another column', () => {
        const asc = nextSort(null, 'name');
        expect(asc).toEqual({ column: 'name', direction: 'asc' });
        const desc = nextSort(asc, 'name');
        expect(desc).toEqual({ column: 'name', direction: 'desc' });
        expect(nextSort(desc, 'name')).toBeNull();
        expect(nextSort(desc, 'duration')).toEqual({ column: 'duration', direction: 'asc' });
    });

    it('sorts by status with failures first, keeping registration order for ties', () => {
        expect(names('status', 'asc')).toEqual(['a10', 'c', 'a2', 'b']);
        expect(names('status', 'desc')).toEqual(['b', 'a2', 'a10', 'c']);
    });

    it('sorts names naturally', () => {
        expect(names('name', 'asc')).toEqual(['a2', 'a10', 'b', 'c']);
    });

    it('sorts by duration with not-run tests last in both directions', () => {
        expect(names('duration', 'asc')).toEqual(['a2', 'c', 'b', 'a10']);
        expect(names('duration', 'desc')).toEqual(['b', 'c', 'a2', 'a10']);
    });
});

describe('DurationStore', () => {
    it('sums the known durations and only counts the untimed tests, without guessing them', () => {
        const store = new DurationStore(null);
        expect(store.estimate(['a', 'b'])).toEqual({ knownMs: 0, untimed: 2 });
        store.set('a', 100);
        store.set('b', 300);
        expect(store.estimate(['a', 'b', 'c', 'd'])).toEqual({ knownMs: 400, untimed: 2 });
    });

    it('learns the overhead from any long enough run, within 1–5', () => {
        const store = new DurationStore(null);
        store.set('a', 1000);
        store.learnOverhead(900, 100); // too short to tell
        expect(store.overheadRatio).toBe(1);
        store.learnOverhead(1500, 1000);
        expect(store.estimate(['a']).knownMs).toBe(1500);
        store.learnOverhead(60_000, 1000);
        expect(store.overheadRatio).toBe(5);
        store.learnOverhead(500, 1000);
        expect(store.overheadRatio).toBe(1);
    });

    it('persists durations and the last full run', () => {
        const store = new DurationStore('dur-test');
        store.set('S › t', 1234);
        store.lastFullRunMs = 5000;
        store.learnOverhead(2468, 1234);
        store.save();

        const reloaded = new DurationStore('dur-test');
        expect(reloaded.get('S › t')).toBe(1234);
        expect(reloaded.lastFullRunMs).toBe(5000);
        expect(reloaded.overheadRatio).toBe(2);
        expect(reloaded.get('unknown')).toBeNull();
    });
});
