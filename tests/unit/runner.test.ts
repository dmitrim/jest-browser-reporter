import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JestLiteGlobals } from '../../src/jestApi';
import type { TestResult } from '../../src/types';

// jest-lite keeps its state per module instance: every test gets fresh modules.
let runner: typeof import('../../src/runner/runner');
let g: JestLiteGlobals;

beforeEach(async () => {
    vi.resetModules();
    runner = await import('../../src/runner/runner');
    const globals = await import('../../src/runner/globals');
    globals.setupJestLiteGlobals();
    g = globalThis as unknown as JestLiteGlobals;
});

const statuses = (results: TestResult[]) => Object.fromEntries(results.map(r => [r.fullName, r.status]));

describe('runTests', () => {
    it('reports pass, fail and skip with names and paths', async () => {
        g.describe('Suite', () => {
            g.it('passes', () => { });
            g.it('fails', () => { throw new Error('boom'); });
            g.it.skip('is skipped', () => { });
            g.describe('Nested', () => g.it('deep', () => { }));
        });

        const { results, aborted } = await runner.runTests();

        expect(aborted).toBe(false);
        expect(statuses(results)).toEqual({
            'Suite › passes': 'pass',
            'Suite › fails': 'fail',
            'Suite › is skipped': 'skip',
            'Suite › Nested › deep': 'pass',
        });
        const failed = results.find(r => r.name === 'fails')!;
        expect(failed.suitePath).toEqual(['Suite']);
        expect(failed.errors[0]).toContain('boom');
        expect(failed.sourceCode).toContain('boom');
        expect(failed.testPath).toEqual(['ROOT_DESCRIBE_BLOCK', 'Suite', 'fails']);
    });

    it('applies .only, including inside a nested describe', async () => {
        g.describe('A', () => {
            g.it('a1', () => { });
            g.describe.only('B', () => g.it('b1', () => { }));
        });
        g.it.only('top', () => { });
        g.it('other', () => { });

        const { results } = await runner.runTests();

        expect(statuses(results)).toEqual({ 'A › a1': 'skip', 'A › B › b1': 'pass', top: 'pass', other: 'skip' });
    });

    it('does not run focused tests inside a skipped describe', async () => {
        g.describe.skip('Skipped', () => g.it.only('focused', () => { }));
        g.it('other', () => { });

        const { results } = await runner.runTests();

        expect(statuses(results)).toEqual({ 'Skipped › focused': 'skip', other: 'skip' });
    });

    it('with a filter, runs exactly the matching tests and marks the rest as filtered out', async () => {
        g.describe('S', () => {
            g.it('DoTest3', () => { });
            g.it('DoTest30', () => { });
            g.it.only('focused', () => { });
        });

        const selected = new Set(['S › DoTest3']);
        const { results } = await runner.runTests({ filter: t => selected.has(t.fullName) });

        expect(statuses(results)).toEqual({ 'S › DoTest3': 'pass', 'S › DoTest30': 'skip', 'S › focused': 'skip' });
        expect(results.find(r => r.name === 'DoTest30')!.filteredOut).toBe(true);
        expect(results.find(r => r.name === 'DoTest3')!.filteredOut).toBe(false);
    });

    it('runs .skip tests selected by name when runSkipped is set', async () => {
        const body = vi.fn();
        g.it.skip('skipped test', body);
        g.it('other', () => { });

        const { results } = await runner.runTests({ filter: t => t.name === 'skipped test', runSkipped: true });

        expect(body).toHaveBeenCalledTimes(1);
        expect(statuses(results)).toEqual({ 'skipped test': 'pass', other: 'skip' });
    });

    it('never runs .skip tests selected by a pattern', async () => {
        const body = vi.fn();
        g.it.skip('skipped test', body);
        g.describe.skip('Skipped describe', () => g.it('inner', body));

        const { results } = await runner.runTests({ filter: () => true });

        expect(body).not.toHaveBeenCalled();
        expect(statuses(results)).toEqual({ 'skipped test': 'skip', 'Skipped describe › inner': 'skip' });
        expect(results.every(r => !r.filteredOut)).toBe(true);
    });

    it('does not run hooks of a describe with no selected tests', async () => {
        const hook = vi.fn();
        g.describe('Unselected', () => {
            g.beforeAll(hook);
            g.it('x', () => { });
        });
        g.it('y', () => { });

        await runner.runTests({ filter: t => t.name === 'y' });

        expect(hook).not.toHaveBeenCalled();
    });

    it('fails the selected tests of a describe whose beforeAll fails', async () => {
        g.describe('S', () => {
            g.beforeAll(() => { throw new Error('setup failed'); });
            g.it('a', () => { });
            g.describe('Nested', () => g.it('b', () => { }));
        });

        const { results } = await runner.runTests();

        expect(statuses(results)).toEqual({ 'S › a': 'fail', 'S › Nested › b': 'skip' });
        expect(results[0].errors[0]).toContain('setup failed');
    });

    it('resets errors between runs', async () => {
        g.it('always fails', () => { throw new Error('once'); });

        await runner.runTests();
        const { results } = await runner.runTests();

        expect(results[0].errors).toHaveLength(1);
    });

    it('stops after the running test when aborted and cancels the rest', async () => {
        const controller = new AbortController();
        g.describe('S', () => {
            g.it('first', () => { controller.abort(); });
            g.it('second', () => { });
            g.describe('Nested', () => g.it('third', () => { }));
        });
        g.it.skip('not selected', () => { });

        const { results, aborted } = await runner.runTests({ signal: controller.signal });

        expect(aborted).toBe(true);
        expect(statuses(results)).toEqual({
            'S › first': 'pass', 'S › second': 'cancel', 'S › Nested › third': 'cancel', 'not selected': 'skip',
        });
    });

    it('reports progress through the callbacks', async () => {
        g.it('one', () => { });
        g.it('two', () => { throw new Error('x'); });
        g.it.skip('three', () => { });
        const events: string[] = [];

        await runner.runTests({
            onRunStart: tests => events.push(`start:${tests.map(t => t.name).join(',')}`),
            onTestStart: t => events.push(`test:${t.name}`),
            onTestDone: r => events.push(`done:${r.name}:${r.status}`),
        });

        expect(events).toEqual(['start:one,two', 'test:one', 'done:one:pass', 'test:two', 'done:two:fail', 'done:three:skip']);
    });

    it('rejects a second concurrent run', async () => {
        g.it('slow', () => new Promise(resolve => setTimeout(resolve, 20)));
        const first = runner.runTests();
        await expect(runner.runTests()).rejects.toThrow('already in progress');
        await first;
    });

    it('lists registered tests', () => {
        g.describe('S', () => g.it('t', () => { }));
        g.it.skip('skipped', () => { });
        expect(runner.getRegisteredTests()).toEqual([
            { name: 'skipped', suitePath: [], fullName: 'skipped', runnable: false },
            { name: 't', suitePath: ['S'], fullName: 'S › t', runnable: true },
        ]);
    });
});

describe('globals', () => {
    it('supports it.each and describe.each', async () => {
        g.it.each([[1, 2, 3], [2, 2, 4]])('%i + %i = %i', (a, b, sum) => {
            if (a + b !== sum) throw new Error('wrong');
        });
        g.describe.each([{ name: 'alpha' }])('suite $name', ({ name }) => {
            g.it('has the row', () => { if (name !== 'alpha') throw new Error(); });
        });

        const { results } = await runner.runTests();

        expect(statuses(results)).toEqual({ '1 + 2 = 3': 'pass', '2 + 2 = 4': 'pass', 'suite alpha › has the row': 'pass' });
    });

    it('supports it.todo as a skipped test', async () => {
        g.it.todo('write me');
        const { results } = await runner.runTests();
        expect(statuses(results)).toEqual({ 'todo: write me': 'skip' });
    });

    it('provides working jest.fn and jest.spyOn', () => {
        const fn = g.jest.fn((x: number) => x * 2).mockReturnValueOnce(100);
        expect(fn(1)).toBe(100);
        expect(fn(2)).toBe(4);
        expect(fn.mock.calls).toEqual([[1], [2]]);
        expect(g.jest.isMockFunction(fn)).toBe(true);

        const target = { value: () => 'real' };
        const spy = g.jest.spyOn(target, 'value').mockReturnValue('mocked');
        expect(target.value()).toBe('mocked');
        spy.mockRestore();
        expect(target.value()).toBe('real');
    });

    it('lets jest-lite expect check the mocks', async () => {
        g.it('calls the mock', () => {
            const fn = g.jest.fn();
            fn('a');
            g.expect(fn).toHaveBeenCalledWith('a');
            g.expect(fn).toHaveBeenCalledTimes(1);
        });
        const { results } = await runner.runTests();
        expect(results[0].errors).toEqual([]);
        expect(results[0].status).toBe('pass');
    });

    it('supports rejects.toThrow() like Jest 23+', async () => {
        g.it('matches', () => g.expect(Promise.reject(new Error('nope'))).rejects.toThrow('nope'));
        g.it('mismatches', () => g.expect(Promise.reject(new Error('nope'))).rejects.toThrow('other'));
        g.it('resolved', () => g.expect(Promise.resolve(1)).rejects.toThrow());

        const { results } = await runner.runTests();

        expect(statuses(results)).toEqual({ matches: 'pass', mismatches: 'fail', resolved: 'fail' });
        expect(results[2].errors[0]).toContain('Promise to reject');
    });

    it('throws a clear error for unsupported jest APIs', () => {
        expect(() => g.jest.useFakeTimers()).toThrow('jest.useFakeTimers() is not supported');
    });

    it('applies jest.setTimeout, and a per-test timeout overrides it', async () => {
        g.jest.setTimeout(10);
        g.it('too slow', () => new Promise(resolve => setTimeout(resolve, 100)));
        g.it('own timeout wins', () => new Promise(resolve => setTimeout(resolve, 30)), 1000);

        const { results } = await runner.runTests();
        g.jest.setTimeout(5000);

        expect(results[0].status).toBe('fail');
        expect(results[0].errors[0]).toContain('Exceeded timeout of 10ms');
        expect(results[1].status).toBe('pass');
    });
});
