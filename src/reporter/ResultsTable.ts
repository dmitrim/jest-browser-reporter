import type { StatusFilter, TestResult } from '../types';
import { LABELS, formatGroupMeta, groupRunTitle, renderEmptyRow, renderGroupHeader, renderTestRow } from './templates';
import { matchesSearch } from './search';
import { countStatuses, getGroupKey } from './testResults';
import { createComparator, type SortState } from './sorting';

export interface TableFilter {
    status: StatusFilter;
    /** Search alternatives (see `parseSearch`); none match everything. */
    search: readonly string[];
}

interface Group {
    header: HTMLTableRowElement;
    rows: HTMLTableRowElement[];
}

/** The results `<tbody>`: rows are added or replaced one at a time, so results can stream in. */
export class ResultsTable {
    private readonly rows = new Map<string, HTMLTableRowElement>();
    private readonly results = new Map<string, TestResult>();
    private readonly groups = new Map<string, Group>();

    constructor(
        private readonly tbody: HTMLElement,
        private grouped: boolean,
        private readonly collapsedGroups: Set<string>,
        private readonly isRunnable: (fullName: string) => boolean = () => true,
    ) { }

    clear(emptyMessage: string): void {
        this.rows.clear();
        this.results.clear();
        this.groups.clear();
        this.tbody.innerHTML = renderEmptyRow(emptyMessage);
    }

    /** Rebuilds the table, e.g. after grouping was switched. */
    rebuild(entries: Iterable<{ result: TestResult; stale: boolean }>, grouped: boolean, emptyMessage: string): void {
        this.grouped = grouped;
        this.clear(emptyMessage);
        for (const { result, stale } of entries) this.upsert(result, stale);
    }

    /** Adds the row of a test, or replaces it if the test already has one. */
    upsert(result: TestResult, stale: boolean): void {
        const groupKey = this.grouped ? getGroupKey(result) : '';
        const row = createRow(renderTestRow(result, groupKey, stale, this.isRunnable(result.fullName)));
        const existing = this.rows.get(result.fullName);

        if (existing) {
            existing.replaceWith(row);
            const group = this.groups.get(groupKey);
            if (group) group.rows[group.rows.indexOf(existing)] = row;
        } else {
            this.tbody.querySelector(':scope > .empty-row')?.remove();
            if (this.grouped) {
                const group = this.getOrCreateGroup(groupKey);
                (group.rows[group.rows.length - 1] ?? group.header).after(row);
                group.rows.push(row);
            } else {
                this.tbody.appendChild(row);
            }
        }
        this.rows.set(result.fullName, row);
        this.results.set(result.fullName, result);
    }

    /**
     * Reorders the rows (within their group when grouped); `null` restores registration order.
     * Rows added later are appended, so call it again after adding rows.
     */
    applySort(sort: SortState | null): void {
        const order = new Map([...this.results.keys()].map((name, index) => [name, index]));
        const compare = sort ? createComparator(sort, order) : null;
        const sorted = (names: Iterable<string>) => {
            const list = [...names].map(name => this.results.get(name)!).filter(Boolean);
            list.sort(compare ?? ((a, b) => order.get(a.fullName)! - order.get(b.fullName)!));
            return list.map(result => this.rows.get(result.fullName)!);
        };

        if (!this.grouped) {
            this.tbody.append(...sorted(this.rows.keys()));
            return;
        }
        for (const group of this.groups.values()) {
            group.rows = sorted(group.rows.map(row => row.dataset.id!));
            group.header.after(...group.rows);
        }
    }

    setStale(fullName: string, stale: boolean): void {
        const row = this.rows.get(fullName);
        if (!row) return;
        row.classList.toggle('stale', stale);
        if (stale) row.title = 'Not run this time: result of a previous run';
        else row.removeAttribute('title');
    }

    toggleGroup(groupKey: string): boolean {
        const collapsed = !this.collapsedGroups.has(groupKey);
        if (collapsed) this.collapsedGroups.add(groupKey);
        else this.collapsedGroups.delete(groupKey);

        const header = this.groups.get(groupKey)?.header;
        if (header) {
            header.dataset.collapsed = String(collapsed);
            header.querySelector('.group-icon')!.textContent = collapsed ? LABELS.groupCollapsed : LABELS.groupExpanded;
        }
        return collapsed;
    }

    /** Shows only rows matching the filter; refreshes the counts in group headers. */
    applyFilter(filter: TableFilter): void {
        const matches = (row: HTMLElement) =>
            (filter.status === 'all' || row.dataset.status === filter.status)
            && matchesSearch(row.dataset.search || '', filter.search);

        if (!this.grouped) {
            this.rows.forEach(row => setVisible(row, matches(row)));
            return;
        }

        for (const [groupKey, group] of this.groups) {
            const collapsed = this.collapsedGroups.has(groupKey);
            const matching = group.rows.filter(matches);
            group.rows.forEach(row => setVisible(row, !collapsed && matching.includes(row)));
            group.header.querySelector('.group-meta')!.textContent =
                formatGroupMeta(countStatuses(matching.map(row => row.dataset.status)));
            setVisible(group.header, matching.length > 0);

            const runnable = matching.filter(row => this.isRunnable(row.dataset.id || '')).length;
            const runButton = group.header.querySelector<HTMLButtonElement>('.run-group-btn')!;
            runButton.disabled = runnable === 0;
            runButton.title = groupRunTitle(runnable);
        }
    }

    private getOrCreateGroup(groupKey: string): Group {
        let group = this.groups.get(groupKey);
        if (!group) {
            const header = createRow(renderGroupHeader(groupKey, this.collapsedGroups.has(groupKey)));
            this.tbody.appendChild(header);
            group = { header, rows: [] };
            this.groups.set(groupKey, group);
        }
        return group;
    }
}

function createRow(html: string): HTMLTableRowElement {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild as HTMLTableRowElement;
}

function setVisible(element: HTMLElement, visible: boolean): void {
    element.style.display = visible ? '' : 'none';
}
