import { describe, expect, it } from 'vitest';
import { createTestPredicate } from '../../src/runner/testFilter';
import { formatEachTitle } from '../../src/runner/globals';
import { countStatuses, getGroupKey, normalizeResult, toSerializable } from '../../src/reporter/testResults';
import { RunRecordStore, SettingsStore } from '../../src/reporter/storage';
import type { TestInfo } from '../../src/types';

const info = (fullPath: string[]): TestInfo => ({
    name: fullPath[fullPath.length - 1],
    suitePath: fullPath.slice(0, -1),
    fullName: fullPath.join(' › '),
});

describe('createTestPredicate', () => {
    const tests = [info(['Signatures', 'DoSignatureTest3']), info(['Signatures', 'DoSignatureTest36']), info(['Text', 'draws text'])];
    const select = (...args: Parameters<typeof createTestPredicate>) => {
        const predicate = createTestPredicate(...args);
        return predicate ? tests.filter(predicate).map(t => t.name) : 'all';
    };

    it('returns undefined without criteria', () => {
        expect(select({}, [])).toBe('all');
        expect(select({ filter: '' }, [])).toBe('all');
    });

    it('matches a string against the test and describe names', () => {
        expect(select({ filter: 'Signature' }, [])).toEqual(['DoSignatureTest3', 'DoSignatureTest36']);
        expect(select({ filter: 'Text' }, [])).toEqual(['draws text']);
    });

    it('matches a RegExp against the full name, also with the g flag', () => {
        const re = /Test3$/g;
        expect(select({ filter: re }, [])).toEqual(['DoSignatureTest3']);
        expect(select({ filter: re }, [])).toEqual(['DoSignatureTest3']);
    });

    it('selects exact full names, so a prefix does not match longer names', () => {
        expect(select({ tests: ['Signatures › DoSignatureTest3'] }, [])).toEqual(['DoSignatureTest3']);
    });

    it('selects the failed tests and combines criteria with AND', () => {
        const failed = ['Signatures › DoSignatureTest36', 'Text › draws text'];
        expect(select({ onlyFailed: true }, failed)).toEqual(['DoSignatureTest36', 'draws text']);
        expect(select({ onlyFailed: true, filter: 'Signature' }, failed)).toEqual(['DoSignatureTest36']);
    });
});

describe('formatEachTitle', () => {
    it('fills printf placeholders', () => {
        expect(formatEachTitle('%s|%d|%i|%f|%j|%#|%%', ['a', 2.7, 3.9, 1.5, { x: 1 }], 4))
            .toBe('a|2|3|1.5|{"x":1}|4|%');
    });

    it('fills $property placeholders for object rows', () => {
        expect(formatEachTitle('$name is $info.age', [{ name: 'Ann', info: { age: 30 } }], 0)).toBe('Ann is 30');
    });

    it('leaves placeholders without a value as they are', () => {
        expect(formatEachTitle('%s and %s', ['one'], 0)).toBe('one and %s');
        expect(formatEachTitle('$missing.deep', [{}], 0)).toBe('$missing.deep');
    });
});

describe('test results', () => {
    it('normalizes raw jest-lite results', () => {
        const result = normalizeResult({ status: 'pass', testPath: ['ROOT_DESCRIBE_BLOCK', 'Suite', 'name'], errors: [], duration: 3 });
        expect(result).toMatchObject({ name: 'name', suitePath: ['Suite'], fullName: 'Suite › name' });
        expect(getGroupKey(result)).toBe('Suite');
    });

    it('counts statuses', () => {
        expect(countStatuses(['pass', 'fail', 'skip', 'cancel', 'pass', undefined]))
            .toEqual({ total: 6, pass: 2, fail: 1, skip: 1, cancel: 1 });
    });

    it('drops the source code for JSON output', () => {
        const result = normalizeResult({ status: 'pass', name: 't', sourceCode: 'code' });
        expect(toSerializable(result)).not.toHaveProperty('sourceCode');
    });
});

describe('storage', () => {
    it('merges saved settings and survives corrupt data', () => {
        const store = new SettingsStore('test-key');
        store.save({ filter: 'fail' });
        store.save({ search: 'abc' });
        expect(store.load()).toEqual({ filter: 'fail', search: 'abc' });

        localStorage.setItem('test-key', '{not json');
        expect(store.load()).toEqual({});
    });

    it('does nothing without a key', () => {
        const store = new SettingsStore(null);
        store.save({ filter: 'fail' });
        expect(store.load()).toEqual({});
    });

    it('reports a run record that was never ended, once', () => {
        const store = new RunRecordStore('run-key');
        store.begin(10);
        store.update({ testCount: 10, done: 3, currentTest: 'S › t' });
        expect(store.takeInterrupted()).toEqual({ testCount: 10, done: 3, currentTest: 'S › t' });
        expect(store.takeInterrupted()).toBeUndefined();

        store.begin(5);
        store.end();
        expect(store.takeInterrupted()).toBeUndefined();
    });
});
