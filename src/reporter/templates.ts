import type { StatusCounts, StatusFilter, TestResult, TestStatus } from '../types';
import { escapeHtml } from '../utils/dom';

export const LABELS = {
    runAll: '▶ Run All',
    stop: '⏹ Stop',
    runFailed: (count: number) => `↻ Run Failed${count ? ` (${count})` : ''}`,
    export: '⬇ Export JSON',
    runTest: '▶ Run',
    showError: '▾ Show Error Details',
    hideError: '▴ Hide Error Details',
    showSource: '▾ Show Source Code',
    hideSource: '▴ Hide Source Code',
    groupExpanded: '▾',
    groupCollapsed: '▸',
};

const STATUS_BADGES: Record<TestStatus, { icon: string; text: string }> = {
    pass: { icon: '✓', text: 'PASS' },
    fail: { icon: '✕', text: 'FAIL' },
    skip: { icon: '○', text: 'SKIP' },
    cancel: { icon: '■', text: 'CANCELLED' },
};

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
        <div class="reporter-notice hidden" role="alert">
            <span class="notice-text"></span>
            <button class="notice-close" type="button" title="Dismiss">×</button>
        </div>
        <div class="running-indicator hidden" aria-live="polite"></div>
        <div class="test-results">
            <div class="test-summary">
                <div class="summary-stats">${renderStats({ total: 0, pass: 0, fail: 0, skip: 0, cancel: 0 })}</div>
                <div class="run-controls">
                    <button class="run-all-btn" type="button" title="Run all tests (Ctrl+Enter)">${LABELS.runAll}</button>
                    <button class="run-failed-btn" type="button" title="Run the tests that failed last time" disabled>${LABELS.runFailed(0)}</button>
                    <button class="export-btn" type="button" title="Download the results as JSON" disabled>${LABELS.export}</button>
                </div>
            </div>
            <div class="filter-controls">
                <div class="search-container">
                    <input type="search" class="search-input" placeholder="Search tests… (Ctrl+F)" value="${escapeHtml(state.search)}" />
                    <button class="search-clear ${state.search ? '' : 'hidden'}" type="button" title="Clear search">×</button>
                </div>
                ${FILTERS.map(f => `<button class="filter-btn ${state.filter === f.value ? 'active' : ''}" type="button" data-filter="${f.value}">${f.label}</button>`).join('')}
                <button class="group-toggle-btn ${state.groupBySuite ? 'active' : ''}" type="button">Group by Suite</button>
            </div>
            <table class="test-table">
                <thead>
                    <tr>
                        <th class="col-status">Status</th>
                        <th>Test</th>
                        <th class="col-duration">Duration</th>
                    </tr>
                </thead>
                <tbody id="test-results-body"></tbody>
            </table>
        </div>
    `;
}

export function renderStats(counts: StatusCounts): string {
    const stat = (cls: string, value: number, label: string) =>
        `<div class="stat ${cls}"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
    return stat('total', counts.total, 'Total')
        + stat('pass', counts.pass, 'Passed')
        + stat('fail', counts.fail, 'Failed')
        + stat('skip', counts.skip, 'Skipped')
        + (counts.cancel ? stat('cancel', counts.cancel, 'Cancelled') : '');
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
        <tr class="group-header" data-group="${escapeHtml(groupKey)}" data-collapsed="${collapsed}">
            <td colspan="3">
                <span class="group-icon">${collapsed ? LABELS.groupCollapsed : LABELS.groupExpanded}</span>
                <span class="group-title">${escapeHtml(groupKey)}</span>
                <span class="group-meta"></span>
            </td>
        </tr>
    `;
}

/**
 * One result row. Error and source panels are not rendered here: highlighting every row
 * up front is slow, so they are created when first opened.
 */
export function renderTestRow(test: TestResult, groupKey: string, stale: boolean): string {
    const hasErrors = test.status === 'fail' && test.errors.length > 0;
    const badge = STATUS_BADGES[test.status] ?? { icon: '?', text: String(test.status).toUpperCase() };
    const path = test.suitePath.join(' › ');

    const actions = [
        hasErrors ? `<button class="toggle-error" type="button">${LABELS.showError}</button>` : '',
        test.sourceCode ? `<button class="toggle-source" type="button">${LABELS.showSource}</button>` : '',
    ].join('');

    const duration = test.duration === null ? '–' : `${test.duration}ms`;

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
            <button class="run-btn" type="button" title="Run this test only">${LABELS.runTest}</button>
        </div>
    </td>
</tr>`;
}
