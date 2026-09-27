import type { TestResult, TestStatus } from '../types';

export type SortColumn = 'status' | 'name' | 'duration';

export interface SortState {
    column: SortColumn;
    direction: 'asc' | 'desc';
}

/** Ascending status order: the outcomes that need attention first. */
const STATUS_RANK: Record<TestStatus | 'pending', number> = { fail: 0, cancel: 1, skip: 2, pass: 3, pending: 4 };

/** A click on a header cycles: ascending → descending → no sorting (registration order). */
export function nextSort(current: SortState | null, column: SortColumn): SortState | null {
    if (!current || current.column !== column) return { column, direction: 'asc' };
    return current.direction === 'asc' ? { column, direction: 'desc' } : null;
}

/**
 * Comparator for the sort; ties keep registration order (`order`). Tests without a duration
 * go last in both directions.
 */
export function createComparator(sort: SortState, order: Map<string, number>): (a: TestResult, b: TestResult) => number {
    const sign = sort.direction === 'asc' ? 1 : -1;
    const byOrder = (a: TestResult, b: TestResult) => (order.get(a.fullName) ?? 0) - (order.get(b.fullName) ?? 0);

    return (a, b) => {
        let result: number;
        if (sort.column === 'duration') {
            if (a.duration === null || b.duration === null) {
                if (a.duration === b.duration) return byOrder(a, b);
                return a.duration === null ? 1 : -1;
            }
            result = a.duration - b.duration;
        } else if (sort.column === 'status') {
            result = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
        } else {
            result = a.fullName.localeCompare(b.fullName, undefined, { numeric: true, sensitivity: 'base' });
        }
        return result * sign || byOrder(a, b);
    };
}
