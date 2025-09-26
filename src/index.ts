/**
 * Setup Jest Lite functions as globals to run tests
 * in a Jest-like style (describe, it, expect, etc.).
 *
 * @param jestLite - Optional. The imported Jest Lite module (default export).
 */
export async function setupJestLiteGlobals(jestLite?: any): Promise<void> {
    if (!jestLite) {
        //@ts-ignore
        jestLite = await import('https://cdn.skypack.dev/jest-lite');
    }

    const { describe, it, expect, run, beforeAll, afterAll, beforeEach, afterEach } = jestLite;

    (globalThis as any).describe = describe;
    (globalThis as any).it = it;
    (globalThis as any).expect = expect;
    (globalThis as any).before = (globalThis as any).beforeAll = beforeAll;
    (globalThis as any).after = (globalThis as any).afterAll = afterAll;
    (globalThis as any).beforeEach = beforeEach;
    (globalThis as any).afterEach = afterEach;
    (globalThis as any).run = run;
}


// Improved Jest Browser Reporter
// - Adds grouping by suite (first non-root describe block)
// - Hides technical path elements like ROOT_DESCRIBE_BLOCK
// - Uses event delegation instead of inline onclick handlers
// - Shows collapsible group sections with per-group pass/fail counts
// - Adds live search by test name/path (debounced)
// - All user-facing text and comments are in English

export type JestBrowserReporterOptions = { container: HTMLElement; showBackLink?: boolean; groupBySuite?: boolean };

const STYLES = `
/* Base styles */
.jest-browser-reporter * { box-sizing: border-box; margin: 0; padding: 0; }
.jest-browser-reporter { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f5f7fa; padding: 20px; }
.jest-browser-reporter .back-link { display: inline-block; margin-bottom: 20px; text-decoration: none; color: #4a6ee0; font-weight: 500; padding: 8px 16px; border-radius: 4px; transition: background-color 0.2s; }
.jest-browser-reporter .back-link:hover { background-color: #eef2ff; }

/* Test results container */
.jest-browser-reporter .test-results { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); overflow: hidden; margin-bottom: 20px; }

/* Summary section */
.jest-browser-reporter .test-summary { padding: 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.jest-browser-reporter .summary-stats { display: flex; gap: 20px; }
.jest-browser-reporter .stat { display: flex; flex-direction: column; align-items: center; }
.jest-browser-reporter .stat-value { font-size: 24px; font-weight: bold; }
.jest-browser-reporter .stat-label { font-size: 14px; color: #64748b; }
.jest-browser-reporter .pass .stat-value { color: #10b981; }
.jest-browser-reporter .fail .stat-value { color: #ef4444; }
.jest-browser-reporter .total .stat-value { color: #4a6ee0; }

/* Filter & grouping controls */
.jest-browser-reporter .filter-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.jest-browser-reporter .filter-btn, .jest-browser-reporter .group-toggle-btn { padding: 6px 12px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.jest-browser-reporter .filter-btn.active, .jest-browser-reporter .group-toggle-btn.active { background: #4a6ee0; color: white; border-color: #4a6ee0; }
.jest-browser-reporter .search-input { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 14px; }

/* Test table */
.jest-browser-reporter .test-table { width: 100%; border-collapse: collapse; }
.jest-browser-reporter .test-table th { text-align: left; padding: 12px 16px; background-color: #f1f5f9; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
.jest-browser-reporter .test-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
.jest-browser-reporter .test-table tr:last-child td { border-bottom: none; }
.jest-browser-reporter .test-table tr:hover { background-color: #f8fafc; }

/* Status indicators */
.jest-browser-reporter .status-indicator { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 500; }
.jest-browser-reporter .status-pass { background-color: #d1fae5; color: #065f46; }
.jest-browser-reporter .status-fail { background-color: #fee2e2; color: #991b1b; }

/* Test path styling */
.jest-browser-reporter .test-path { color: #64748b; font-size: 13px; }
.jest-browser-reporter .test-name { font-weight: 600; margin-top: 4px; }

/* Error details */
.jest-browser-reporter .error-details { display: none; margin-top: 10px; padding: 10px; background-color: #fef2f2; border-radius: 4px; border-left: 4px solid #ef4444; }
.jest-browser-reporter .error-details pre { white-space: pre-wrap; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; color: #991b1b; overflow-x: auto; }
.jest-browser-reporter .toggle-error { background: none; border: none; color: #4a6ee0; cursor: pointer; font-size: 14px; padding: 0; margin-top: 5px; }
.jest-browser-reporter .toggle-error:hover { text-decoration: underline; }

/* Grouping */
.jest-browser-reporter .group-header { background: #f1f5f9; font-weight: 700; cursor: pointer; }
.jest-browser-reporter .group-meta { color: #64748b; font-weight: 500; font-size: 13px; margin-left: 8px; }

/* Duration indicator */
.jest-browser-reporter .duration { color: #64748b; font-size: 14px; }
`;

export class JestBrowserReporter {
    options: JestBrowserReporterOptions;
    results: any[];
    currentFilter: string;
    currentSearch: string;
    groupBySuite: boolean;
    elements: { container: HTMLElement; summary: Element | null; tableBody: Element | null; searchInput: HTMLInputElement | null } | undefined;
    private searchHandler?: (e: Event) => void;

    constructor(options: JestBrowserReporterOptions) {
        this.options = options || {} as any;
        this.options.container ||= document.body as HTMLElement;
        this.results = [];
        this.currentFilter = 'all';
        this.currentSearch = '';
        this.groupBySuite = !!options.groupBySuite;
        this.init();
    }

    // Initialize UI and listeners
    init() {
        this.injectStyles();
        this.createHTMLStructure();
        this.setupEventListeners();
    }

    injectStyles() {
        if (document.getElementById('jest-browser-reporter-styles')) return;
        const style = document.createElement('style');
        style.id = 'jest-browser-reporter-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    // Build DOM skeleton
    createHTMLStructure() {
        const container = document.createElement('div');
        container.className = 'jest-browser-reporter';
        container.innerHTML = this.generateHTML();
        this.options.container.appendChild(container);

        this.elements = {
            container,
            summary: container.querySelector('.test-summary'),
            tableBody: container.querySelector('#test-results-body'),
            searchInput: container.querySelector('.search-input') as HTMLInputElement | null
        };

        // Delegated listeners
        this.attachDelegatedListeners(container);
    }

    generateHTML() {
        const backLink = this.options.showBackLink ? '<a href="javascript:history.back()" class="back-link">&larr; Back</a>' : '';
        return `
            ${backLink}
            <div class="test-results">
                <div class="test-summary">
                    <div class="summary-stats">
                        <div class="stat total"><span class="stat-value">0</span><span class="stat-label">Total Tests</span></div>
                        <div class="stat pass"><span class="stat-value">0</span><span class="stat-label">Passed</span></div>
                        <div class="stat fail"><span class="stat-value">0</span><span class="stat-label">Failed</span></div>
                    </div>
                    <div class="filter-controls">
                        <input type="text" class="search-input" placeholder="Search tests…" />
                        <button class="filter-btn active" data-filter="all">All</button>
                        <button class="filter-btn" data-filter="pass">Passed</button>
                        <button class="filter-btn" data-filter="fail">Failed</button>
                        <button class="group-toggle-btn ${this.groupBySuite ? 'active' : ''}" data-group-by="suite">Group by Suite</button>
                    </div>
                </div>

                <table class="test-table">
                    <thead>
                        <tr>
                            <th width="120px">Status</th>
                            <th>Test</th>
                            <th width="120px">Duration</th>
                        </tr>
                    </thead>
                    <tbody id="test-results-body"></tbody>
                </table>
            </div>
        `;
    }

    // Attach event listeners for filters/search (re-attached after summary re-render)
    setupEventListeners() {
        if (!this.elements) return;

        // Filter buttons
        const filterButtons = this.elements.container.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.removeEventListener('click', this.onFilterClick as any);
            btn.addEventListener('click', this.onFilterClick.bind(this));
        });

        // Group toggle
        const groupBtn = this.elements.container.querySelector('.group-toggle-btn');
        if (groupBtn) {
            groupBtn.removeEventListener('click', this.onGroupToggleClick as any);
            groupBtn.addEventListener('click', this.onGroupToggleClick.bind(this));
        }

        // Search input (debounced)
        if (this.elements.searchInput) {
            if (this.searchHandler) {
                this.elements.searchInput.removeEventListener('input', this.searchHandler);
            }
            this.searchHandler = this.debounce((e: Event) => {
                const input = e.target as HTMLInputElement;
                this.currentSearch = (input.value || '').toLowerCase();
                this.applyFilter();
            }, 180);
            this.elements.searchInput.addEventListener('input', this.searchHandler);
            // restore value
            this.elements.searchInput.value = this.currentSearch || '';
        }
    }

    onFilterClick(e: Event) {
        const target = e.currentTarget as HTMLElement;
        if (!this.elements) return;
        const filterButtons = this.elements.container.querySelectorAll('.filter-btn');
        filterButtons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.currentFilter = (target.dataset.filter as string) || 'all';
        this.applyFilter();
    }

    onGroupToggleClick() {
        this.groupBySuite = !this.groupBySuite;
        if (this.elements) {
            const groupBtn = this.elements.container.querySelector('.group-toggle-btn');
            if (groupBtn) groupBtn.classList.toggle('active', this.groupBySuite);
        }
        this.renderTable();
    }

    // Delegated click handling for error toggles and group header toggles
    attachDelegatedListeners(container: HTMLElement) {
        container.addEventListener('click', (ev) => {
            // Toggle error details
            const btn = (ev.target as HTMLElement).closest('.toggle-error') as HTMLElement | null;
            if (btn) {
                const details = btn.nextElementSibling as HTMLElement | null;
                if (details) {
                    const isVisible = details.style.display === 'block';
                    details.style.display = isVisible ? 'none' : 'block';
                    btn.textContent = isVisible ? 'Show Error Details' : 'Hide Error Details';
                }
                ev.preventDefault();
                return;
            }

            // Toggle only the rows of the clicked group header
            const header = (ev.target as HTMLElement).closest('.group-header') as HTMLElement | null;
            if (header) {
                const groupKey = header.getAttribute('data-group') || '';
                // toggle collapsed state on this header
                const collapsed = header.getAttribute('data-collapsed') === 'true';
                header.setAttribute('data-collapsed', (!collapsed).toString());

                // find rows that belong to this group and toggle only them
                const safeSelector = this.escapeForSelector(groupKey);
                const rows = Array.from(container.querySelectorAll(`tr.group-row[data-group="${safeSelector}"]`)) as HTMLElement[];
                rows.forEach(r => r.style.display = collapsed ? '' : 'none');

                ev.preventDefault();
                return;
            }
        });
    }

    // Render results into the reporter
    render(results: any[]) {
        this.results = results || [];
        this.updateSummary();
        this.renderTable();
    }

    // Update summary area (re-renders the controls area which contains the search input)
    updateSummary() {
        const total = this.results.length;
        const pass = this.results.filter(t => t.status === 'pass').length;
        const fail = total - pass;
        if (!this.elements || !this.elements.summary) return;
        this.elements.summary.innerHTML = `
            <div class="summary-stats">
                <div class="stat total"><span class="stat-value">${total}</span><span class="stat-label">Total</span></div>
                <div class="stat pass"><span class="stat-value">${pass}</span><span class="stat-label">Passed</span></div>
                <div class="stat fail"><span class="stat-value">${fail}</span><span class="stat-label">Failed</span></div>
            </div>
            <div class="filter-controls">
                <input type="text" class="search-input" placeholder="Search tests…" value="${this.escapeHtml(this.currentSearch)}"/>
                <button class="filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                <button class="filter-btn ${this.currentFilter === 'pass' ? 'active' : ''}" data-filter="pass">Passed</button>
                <button class="filter-btn ${this.currentFilter === 'fail' ? 'active' : ''}" data-filter="fail">Failed</button>
                <button class="group-toggle-btn ${this.groupBySuite ? 'active' : ''}" data-group-by="suite">Group by Suite</button>
            </div>
        `;
        // update references and reattach listeners
        if (this.elements && this.elements.container) {
            this.elements.summary = this.elements.container.querySelector('.test-summary');
            this.elements.tableBody = this.elements.container.querySelector('#test-results-body');
            this.elements.searchInput = this.elements.summary ? this.elements.summary.querySelector('.search-input') as HTMLInputElement | null : null;
        }
        this.setupEventListeners();
    }

    // Render table rows; when grouped, produce header + rows (no nested tbody)
    renderTable() {
        if (!this.elements?.tableBody) return;
        const tbody = this.elements.tableBody as HTMLElement;

        if (!this.groupBySuite) {
            tbody.innerHTML = this.results.map((test, index) => this.generateTestRow(test, index)).join('');
            this.applyFilter();
            return;
        }

        const groups: Record<string, any[]> = {};
        this.results.forEach(r => {
            const key = this.getGroupKey(r) || 'Ungrouped';
            groups[key] ||= [];
            groups[key].push(r);
        });

        let html = '';
        Object.keys(groups).forEach(groupKey => {
            const tests = groups[groupKey];
            const pass = tests.filter(t => t.status === 'pass').length;
            const fail = tests.length - pass;
            // group header (store data-group to identify rows)
            html += `
                <tr class="group-header" data-group="${this.escapeHtml(groupKey)}" data-collapsed="false">
                    <td colspan="3">
                        <span class="group-title">${this.escapeHtml(groupKey)}</span>
                        <span class="group-meta"> — ${tests.length} tests (${pass} passed, ${fail} failed)</span>
                    </td>
                </tr>
            `;
            // individual rows
            tests.forEach((t, idx) => {
                html += this.generateTestRow(t, idx, groupKey);
            });
        });

        tbody.innerHTML = html;
        this.applyFilter();
    }

    // Single test row generator; includes a data-search attribute (lowercased)
    generateTestRow(test: any, index: any, groupKey?: string) {
        const statusClass = test.status === 'pass' ? 'status-pass' : 'status-fail';
        const statusIcon = test.status === 'pass' ? '✅' : '❌';
        const statusText = test.status === 'pass' ? 'PASS' : 'FAIL';

        const sanitizedPath = this.sanitizePath(test.testPath);
        const displayPath = sanitizedPath.length ? sanitizedPath.join(' > ') : (test.name || 'Unnamed Test');
        const testName = (test.name || (sanitizedPath[sanitizedPath.length - 1]) || 'Unnamed Test');

        const errorHtml = test.status === 'fail' && test.errors?.length ? `
            <button class="toggle-error">Show Error Details</button>
            <div class="error-details"><pre>${this.escapeHtml(test.errors.join('\n\n'))}</pre></div>
        ` : '';

        const searchValue = this.escapeHtml((testName + ' ' + displayPath).toLowerCase());
        return `
            <tr class="group-row" data-status="${this.escapeHtml(test.status)}" data-group="${this.escapeHtml(groupKey || '')}" data-search="${searchValue}">
                <td><span class="status-indicator ${statusClass}">${statusIcon} ${statusText}</span></td>
                <td>
                    <div class="test-path">${this.escapeHtml(displayPath)}</div>
                    <div class="test-name">${this.escapeHtml(testName)}</div>
                    ${errorHtml}
                </td>
                <td><span class="duration">${this.escapeHtml(String(test.duration || 0))}ms</span></td>
            </tr>
        `;
    }

    // Apply filters and search; updates group meta counts and header visibility
    applyFilter() {
        if (!this.elements?.tableBody) return;
        const container = this.elements.tableBody;
        const rowsAll = Array.from(container.querySelectorAll('tr.group-row')) as HTMLElement[];

        // If not grouped, simply toggle rows
        const hasGroupHeaders = !!container.querySelector('tr.group-header');
        if (!hasGroupHeaders) {
            rowsAll.forEach(row => {
                const status = row.getAttribute('data-status') || '';
                const searchAttr = row.getAttribute('data-search') || '';
                const matchesFilter = this.currentFilter === 'all' || status === this.currentFilter;
                const matchesSearch = !this.currentSearch || searchAttr.indexOf(this.currentSearch) !== -1;
                row.style.display = (matchesFilter && matchesSearch) ? '' : 'none';
            });
            return;
        }

        // grouped: process each header and its rows
        const headers = Array.from(container.querySelectorAll('tr.group-header')) as HTMLElement[];
        headers.forEach(header => {
            const groupKey = header.getAttribute('data-group') || '';
            const safeSelector = this.escapeForSelector(groupKey);
            const groupRows = Array.from(container.querySelectorAll(`tr.group-row[data-group="${safeSelector}"]`)) as HTMLElement[];
            let visibleCount = 0;
            let passed = 0;

            groupRows.forEach(row => {
                const status = row.getAttribute('data-status') || '';
                const searchAttr = row.getAttribute('data-search') || '';
                const matchesFilter = this.currentFilter === 'all' || status === this.currentFilter;
                const matchesSearch = !this.currentSearch || searchAttr.indexOf(this.currentSearch) !== -1;
                const shouldShow = matchesFilter && matchesSearch;
                const collapsed = header.getAttribute('data-collapsed') === 'true';

                // If header collapsed, hide rows regardless of search/filter (but still compute counts)
                row.style.display = collapsed ? 'none' : (shouldShow ? '' : 'none');

                if (shouldShow) {
                    visibleCount++;
                    if (status === 'pass') passed++;
                }
            });

            // Update header meta and visibility
            const meta = header.querySelector('.group-meta') as HTMLElement | null;
            if (meta) meta.textContent = ` — ${visibleCount} tests (${passed} passed, ${visibleCount - passed} failed)`;
            header.style.display = visibleCount > 0 ? '' : 'none';
        });
    }

    // Remove technical parts like ROOT_DESCRIBE_BLOCK from path
    sanitizePath(path: any): string[] {
        if (!Array.isArray(path)) return [];
        return path.filter((p: string) => !!p && p !== 'ROOT_DESCRIBE_BLOCK');
    }

    // Decide a group key for a test (first non-root describe)
    getGroupKey(test: any): string {
        const sanitized = this.sanitizePath(test.testPath);
        if (sanitized.length >= 2) {
            return sanitized[0];
        }
        if (sanitized.length === 1) {
            return sanitized[0];
        }
        if (test.testPath && Array.isArray(test.testPath) && test.testPath.length) {
            return String(test.testPath.join(' > '));
        }
        return test.name || 'Ungrouped';
    }

    // Simple HTML escape for safe insertion
    escapeHtml(value: string) {
        if (!value) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Escape string for use inside attribute selector (basic)
    escapeForSelector(value: string) {
        if (!value) return '';
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    // Debounce helper
    debounce(fn: (e: Event) => void, wait: number) {
        let timeout: number | null = null;
        return (e: Event) => {
            if (timeout) window.clearTimeout(timeout);
            timeout = window.setTimeout(() => {
                fn(e);
                timeout = null;
            }, wait);
        };
    }

    // Remove UI
    destroy() {
        this.dipose();
    }

    dipose() {
        if (!this.elements || !this.elements.container) return;
        if (this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }
    }
}

// Global registration for script tag usage
if (typeof window !== 'undefined') {
    (window as any).JestBrowserReporter = JestBrowserReporter;
}
