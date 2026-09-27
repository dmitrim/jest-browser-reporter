import type { StatusCounts, StatusFilter, TestResult, TestStatus } from '../types';
import { escapeHtml } from '../utils/dom';
import { formatDuration } from '../utils/format';
import type { SortColumn } from './sorting';

export const LABELS = {
    runAll: '▶ Run All',
    stop: '⏹ Stop',
    runFailed: (count: number) => `↻ Run Failed${count ? ` (${count})` : ''}`,
    runFiltered: (count: number) => `▶ Run Filtered${count ? ` (${count})` : ''}`,
    export: '⬇ Export JSON',
    runTest: '▶ Run',
    showError: '▾ Show Error Details',
    hideError: '▴ Hide Error Details',
    showSource: '▾ Show Source Code',
    hideSource: '▴ Hide Source Code',
    groupExpanded: '▾',
    groupCollapsed: '▸',
};

/** `pending` marks the row of a test that has no result yet. */
const STATUS_BADGES: Record<TestStatus | 'pending', { icon: string; text: string }> = {
    pass: { icon: '✓', text: 'PASS' },
    fail: { icon: '✕', text: 'FAIL' },
    skip: { icon: '○', text: 'SKIP' },
    cancel: { icon: '■', text: 'CANCELLED' },
    pending: { icon: '·', text: 'NOT RUN' },
};

export const RUN_FILTERED_TIP = 'Run the tests the table shows: the search and the status filter apply — use | in the search '
    + 'for alternatives, e.g. &quot;Signature | Licensing&quot;. Skipped (.skip) tests are left out. Ctrl+Shift+Enter';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pass', label: 'Passed' },
    { value: 'fail', label: 'Failed' },
    { value: 'skip', label: 'Skipped' },
    { value: 'cancel', label: 'Cancelled' },
];

export interface LayoutState {
    title?: string;
    backLink: boolean | string;
    filter: StatusFilter;
    search: string;
    groupBySuite: boolean;
}

/** Page skeleton; rendered once, later updates touch only its parts. */
export function renderLayout(state: LayoutState): string {
    const backLink = state.backLink
        ? `<a href="${typeof state.backLink === 'string' ? escapeHtml(state.backLink) : 'javascript:history.back()'}" class="back-link">← Back</a>`
        : '';
    const title = state.title ? `<h1 class="reporter-title">${escapeHtml(state.title)}</h1>` : '';

    return `
        ${backLink}
        ${title}
        <div class="reporter-notices"></div>
        <div class="running-indicator hidden" aria-live="polite"></div>
        <div class="test-results">
            <div class="test-summary">
                <div class="summary-stats">${renderStats({ total: 0, pass: 0, fail: 0, skip: 0, cancel: 0 })}</div>
                <div class="run-controls">
                    <button class="run-all-btn" type="button" title="Run all tests (Ctrl+Enter)">${LABELS.runAll}</button>
                    <button class="run-filtered-btn" type="button" title="${RUN_FILTERED_TIP}" disabled>${LABELS.runFiltered(0)}</button>
                    <button class="run-failed-btn" type="button" title="Run only the tests that failed last time; they are remembered across reloads" disabled>${LABELS.runFailed(0)}</button>
                    <button class="export-btn" type="button" title="Download the results as JSON" disabled>${LABELS.export}</button>
                </div>
            </div>
            <div class="filter-controls">
                <div class="search-container">
                    <input type="search" class="search-input" placeholder="Search tests… (a | b matches either)" title="Filters by test and suite name. Separate alternatives with | to match any of them, e.g. &quot;Signature | Licensing&quot;. Ctrl+F focuses the search, Esc clears it." value="${escapeHtml(state.search)}" />
                    <button class="search-clear ${state.search ? '' : 'hidden'}" type="button" title="Clear search">×</button>
                </div>
                ${FILTERS.map(f => `<button class="filter-btn ${state.filter === f.value ? 'active' : ''}" type="button" data-filter="${f.value}" title="${f.value === 'all' ? 'Show all tests' : `Show only ${f.label.toLowerCase()} tests`}">${f.label}</button>`).join('')}
                <button class="group-toggle-btn ${state.groupBySuite ? 'active' : ''}" type="button" title="Group the tests by their top-level describe. Each group can be collapsed, and has a &quot;▶ Run&quot; button for its tests.">Group by Suite</button>
            </div>
            <table class="test-table">
                <thead>
                    <tr>
                        ${sortableHeader('status', 'Status', 'col-status')}
                        ${sortableHeader('name', 'Test', '')}
                        ${sortableHeader('duration', 'Duration', 'col-duration')}
                    </tr>
                </thead>
                <tbody id="test-results-body"></tbody>
            </table>
        </div>
    `;
}

function sortableHeader(column: SortColumn, label: string, cls: string): string {
    return `<th class="${cls} sortable" data-sort="${column}" aria-sort="none" title="Sort by ${label.toLowerCase()}: click again for descending order, a third time for the original order">`
        + `${label}<span class="sort-indicator"></span></th>`;
}

/** Duration of the last run, and of the one before it, for the summary. */
export interface RunTiming {
    durationMs: number;
    previousMs: number | null;
    /** The run was limited to some tests. */
    partial: boolean;
}

/** A dismissible notice above the results, optionally with an action button. */
export function renderNotice(message: string, actionLabel?: string): string {
    return `<div class="reporter-notice" role="alert">
        <div class="notice-body"><span class="notice-text">${escapeHtml(message)}</span></div>
        ${actionLabel ? `<button class="notice-action" type="button">${escapeHtml(actionLabel)}</button>` : ''}
        <button class="notice-close" type="button" title="Dismiss">×</button>
    </div>`;
}

/** Lines under a notice's message; beyond `limit`, a "… and N more" line. */
export function renderNoticeDetails(lines: readonly string[], limit = 10): string {
    const shown = lines.slice(0, limit).map(line => `<li>${escapeHtml(line)}</li>`).join('');
    const more = lines.length > limit ? `<li>… and ${lines.length - limit} more</li>` : '';
    return `<ul class="notice-details">${shown}${more}</ul>`;
}

export function renderStats(counts: StatusCounts, timing?: RunTiming | null): string {
    const stat = (cls: string, value: number | string, label: string, title = '') =>
        `<div class="stat ${cls}"${title ? ` title="${escapeHtml(title)}"` : ''}><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
    const time = timing
        ? stat('time', escapeHtml(formatDuration(timing.durationMs)),
            timing.partial ? 'Duration · filtered run'
                : timing.previousMs === null ? 'Duration' : `Duration · prev ${escapeHtml(formatDuration(timing.previousMs))}`,
            'Duration of the last run')
        : '';
    return stat('total', counts.total, 'Total')
        + stat('pass', counts.pass, 'Passed')
        + stat('fail', counts.fail, 'Failed')
        + stat('skip', counts.skip, 'Skipped')
        + (counts.cancel ? stat('cancel', counts.cancel, 'Cancelled') : '')
        + time;
}

export function renderEmptyRow(message: string): string {
    return `<tr class="empty-row"><td colspan="3" class="empty-state">${escapeHtml(message)}</td></tr>`;
}

export function formatGroupMeta(counts: StatusCounts): string {
    const parts = [`${counts.pass} passed`, `${counts.fail} failed`, `${counts.skip} skipped`];
    if (counts.cancel) parts.push(`${counts.cancel} cancelled`);
    return ` — ${counts.total} tests (${parts.join(', ')})`;
}

export function renderGroupHeader(groupKey: string, collapsed: boolean): string {
    return `
        <tr class="group-header" data-group="${escapeHtml(groupKey)}" data-collapsed="${collapsed}" title="Click to collapse or expand this suite">
            <td colspan="3">
                <div class="group-header-content">
                    <span class="group-icon">${collapsed ? LABELS.groupCollapsed : LABELS.groupExpanded}</span>
                    <span class="group-title">${escapeHtml(groupKey)}</span>
                    <span class="group-meta"></span>
                    <button class="run-group-btn" type="button">${LABELS.runTest}</button>
                </div>
            </td>
        </tr>
    `;
}

/** Tooltip of a suite's "▶ Run": how many tests it runs, and which. */
export function groupRunTitle(runnableCount: number): string {
    return runnableCount
        ? `Run the ${runnableCount} tests this suite shows. The search and the status filter apply; skipped (.skip) tests are left out.`
        : 'Nothing to run: the tests this suite shows are all skipped (.skip). To run one anyway, use "▶ Run" in its row.';
}

/**
 * One result row. Error and source panels are not rendered here: highlighting every row
 * up front is slow, so they are created when first opened.
 */
export function renderTestRow(test: TestResult, groupKey: string, stale: boolean, runnable = true): string {
    const hasErrors = test.status === 'fail' && test.errors.length > 0;
    const badge = STATUS_BADGES[test.status] ?? { icon: '?', text: String(test.status).toUpperCase() };
    const path = test.suitePath.join(' › ');

    const actions = [
        hasErrors ? `<button class="toggle-error" type="button">${LABELS.showError}</button>` : '',
        test.sourceCode ? `<button class="toggle-source" type="button">${LABELS.showSource}</button>` : '',
    ].join('');

    const duration = test.duration === null ? '–' : formatDuration(test.duration);

    return `
<tr class="group-row${stale ? ' stale' : ''}" data-id="${escapeHtml(test.fullName)}" data-status="${escapeHtml(test.status)}"
    data-group="${escapeHtml(groupKey)}" data-search="${escapeHtml(test.fullName.toLowerCase())}"
    ${stale ? 'title="Not run this time: result of a previous run"' : ''}>
    <td class="col-status">
        <span class="status-indicator status-${escapeHtml(test.status)}">${badge.icon} ${badge.text}</span>
    </td>
    <td class="test-main-content">
        ${path ? `<div class="test-path">${escapeHtml(path)}</div>` : ''}
        <div class="test-name">${escapeHtml(test.name)}</div>
        ${actions ? `<div class="test-actions">${actions}</div>` : ''}
        <div class="test-panels"></div>
    </td>
    <td class="col-duration">
        <div class="duration-cell">
            <span class="duration">${duration}</span>
            ${renderPreviousDuration(test)}
            <button class="run-btn" type="button" title="${runnable
                ? 'Run this test only, even if the search or status filter hides it'
                : 'Skipped with .skip: click to run it anyway'}">${LABELS.runTest}</button>
        </div>
    </td>
</tr>`;
}

/** "prev 1sec 20ms", with ▲ / ▼ when the test got clearly slower / faster. */
function renderPreviousDuration(test: TestResult): string {
    const previous = test.previousDuration;
    if (previous === null || previous === undefined) return '';
    let trend = '';
    if (test.duration !== null && Math.abs(test.duration - previous) >= 50) {
        if (test.duration > previous * 1.2) trend = '<span class="trend slower" title="Slower than last time">▲</span> ';
        else if (test.duration < previous * 0.8) trend = '<span class="trend faster" title="Faster than last time">▼</span> ';
    }
    return `<span class="duration-prev" title="Duration the last time this test ran">${trend}prev ${escapeHtml(formatDuration(previous))}</span>`;
}
