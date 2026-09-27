import type { StatusFilter } from '../types';
import type { SortState } from './sorting';

/** UI state remembered between visits. */
export interface SavedSettings {
    filter?: StatusFilter;
    search?: string;
    groupBySuite?: boolean;
    collapsedGroups?: string[];
    failedTests?: string[];
    sort?: SortState | null;
}

/** Progress of the current run, kept so that an interrupted run can be reported after a reload. */
export interface RunRecord {
    testCount: number;
    done: number;
    currentTest?: string;
}

function readJson<T>(storage: () => Storage, key: string): T | undefined {
    try {
        const raw = storage().getItem(key);
        return raw ? JSON.parse(raw) as T : undefined;
    } catch {
        return undefined; // storage disabled, quota, or corrupt data
    }
}

function writeJson(storage: () => Storage, key: string, value: unknown): void {
    try {
        if (value === undefined) storage().removeItem(key);
        else storage().setItem(key, JSON.stringify(value));
    } catch {
        // Persistence is a convenience; ignore failures.
    }
}

/** Settings in `localStorage`; a no-op when `key` is null. */
export class SettingsStore {
    constructor(private readonly key: string | null) { }

    load(): SavedSettings {
        return (this.key && readJson<SavedSettings>(() => localStorage, this.key)) || {};
    }

    save(patch: SavedSettings): void {
        if (!this.key) return;
        writeJson(() => localStorage, this.key, { ...this.load(), ...patch });
    }
}

/** Run progress in `sessionStorage`: survives a reload of the tab, not a new tab. */
export class RunRecordStore {
    private readonly key: string;

    constructor(baseKey: string) {
        this.key = `${baseKey}:run`;
    }

    begin(testCount: number): void {
        writeJson(() => sessionStorage, this.key, { testCount, done: 0 } satisfies RunRecord);
    }

    update(record: RunRecord): void {
        writeJson(() => sessionStorage, this.key, record);
    }

    end(): void {
        writeJson(() => sessionStorage, this.key, undefined);
    }

    /** The record of a run that never ended, if any; it is removed. */
    takeInterrupted(): RunRecord | undefined {
        const record = readJson<RunRecord>(() => sessionStorage, this.key);
        if (record) this.end();
        return record;
    }
}

interface SavedDurations {
    /** Last duration of each test, in ms, by full name. */
    tests: Record<string, number>;
    /** Duration of the last complete run of all tests. */
    lastFullRunMs?: number;
}

/**
 * Remembered test durations, in `localStorage` under `<key>:durations`; kept in memory only when
 * `key` is null. Written once per run, not per test.
 */
export class DurationStore {
    private readonly key: string | null;
    private readonly data: SavedDurations;

    constructor(baseKey: string | null) {
        this.key = baseKey && `${baseKey}:durations`;
        const saved = this.key ? readJson<SavedDurations>(() => localStorage, this.key) : undefined;
        this.data = { tests: saved?.tests && typeof saved.tests === 'object' ? saved.tests : {}, lastFullRunMs: saved?.lastFullRunMs };
    }

    get(fullName: string): number | null {
        const value = this.data.tests[fullName];
        return typeof value === 'number' ? value : null;
    }

    set(fullName: string, ms: number): void {
        this.data.tests[fullName] = ms;
    }

    get lastFullRunMs(): number | null {
        return this.data.lastFullRunMs ?? null;
    }

    set lastFullRunMs(ms: number | null) {
        this.data.lastFullRunMs = ms ?? undefined;
    }

    /**
     * Expected total duration of these tests: known durations, plus their average for the rest;
     * `null` when none is known.
     */
    estimate(fullNames: Iterable<string>): number | null {
        let known = 0;
        let knownCount = 0;
        let unknownCount = 0;
        for (const name of fullNames) {
            const ms = this.get(name);
            if (ms === null) unknownCount++;
            else { known += ms; knownCount++; }
        }
        if (!knownCount) return null;
        return known + unknownCount * (known / knownCount);
    }

    save(): void {
        if (this.key) writeJson(() => localStorage, this.key, this.data);
    }
}
