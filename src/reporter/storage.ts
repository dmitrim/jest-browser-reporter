import type { StatusFilter } from '../types';

/** UI state remembered between visits. */
export interface SavedSettings {
    filter?: StatusFilter;
    search?: string;
    groupBySuite?: boolean;
    collapsedGroups?: string[];
    failedTests?: string[];
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
