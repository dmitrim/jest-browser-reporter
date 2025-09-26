// Improved Jest Browser Reporter
// - Adds grouping by suite (first non-root describe block)
// - Hides technical path elements like ROOT_DESCRIBE_BLOCK
// - Uses event delegation instead of inline onclick handlers
// - Shows collapsible group sections with per-group pass/fail counts
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
.jest-browser-reporter .test-summary { padding: 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
.jest-browser-reporter .summary-stats { display: flex; gap: 20px; }
.jest-browser-reporter .stat { display: flex; flex-direction: column; align-items: center; }
.jest-browser-reporter .stat-value { font-size: 24px; font-weight: bold; }
.jest-browser-reporter .stat-label { font-size: 14px; color: #64748b; }
.jest-browser-reporter .pass .stat-value { color: #10b981; }
.jest-browser-reporter .fail .stat-value { color: #ef4444; }
.jest-browser-reporter .total .stat-value { color: #4a6ee0; }

/* Filter & grouping controls */
.jest-browser-reporter .filter-controls { display: flex; gap: 10px; align-items: center; }
.jest-browser-reporter .filter-btn, .jest-browser-reporter .group-toggle-btn { padding: 6px 12px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.jest-browser-reporter .filter-btn.active, .jest-browser-reporter .group-toggle-btn.active { background: #4a6ee0; color: white; border-color: #4a6ee0; }

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
.jest-browser-reporter .group-header td { padding: 10px 16px; }
.jest-browser-reporter .group-meta { color: #64748b; font-weight: 500; font-size: 13px; margin-left: 8px; }
.jest-browser-reporter .group-toggle { margin-left: 8px; }

/* Duration indicator */
.jest-browser-reporter .duration { color: #64748b; font-size: 14px; }

/* Responsive design */
@media (max-width: 768px) { .jest-browser-reporter .test-summary { flex-direction: column; align-items: flex-start; gap: 15px; } .jest-browser-reporter .test-table { display: block; overflow-x: auto; } }
`;

export class JestBrowserReporter {
    options: JestBrowserReporterOptions;
    results: any[];
    currentFilter: string;
    groupBySuite: boolean;
    elements: { container: HTMLElement; summary: Element | null; tableBody: Element | null; } | undefined;

    constructor(options: JestBrowserReporterOptions) {
        if (!options) options = {} as any;
        if (!options.container) options.container = document.body as HTMLElement;
        this.options = options;
        this.results = [];
        this.currentFilter = 'all';
        this.groupBySuite = !!options.groupBySuite;
        this.init();
    }

    // Initialize the reporter UI and bind events
    init() {
        this.injectStyles();
        this.createHTMLStructure();
        this.setupEventListeners();
    }

    // Inject stylesheet once
    injectStyles() {
        if (document.getElementById('jest-browser-reporter-styles')) return;
        const style = document.createElement('style');
        style.id = 'jest-browser-reporter-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    // Create the initial HTML layout
    createHTMLStructure() {
        const container = document.createElement('div');
        container.className = 'jest-browser-reporter';
        container.innerHTML = this.generateHTML();
        this.options.container.appendChild(container);

        this.elements = {
            container: container,
            summary: container.querySelector('.test-summary'),
            tableBody: container.querySelector('#test-results-body')
        };

        // Attach delegated listeners for dynamic content
        this.attachDelegatedListeners(container);
    }

    // Generate full HTML for the component (initial)
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
                        <button class="filter-btn active" data-filter="all">All Tests</button>
                        <button class="filter-btn" data-filter="pass">Passed Only</button>
                        <button class="filter-btn" data-filter="fail">Failed Only</button>
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

    // Setup event listeners for filter buttons (recalled on summary update)
    setupEventListeners() {
        if (!this.elements) return;
        const filterButtons = this.elements.container.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.removeEventListener('click', this.onFilterClick as any);
            btn.addEventListener('click', this.onFilterClick.bind(this));
        });

        const groupBtn = this.elements.container.querySelector('.group-toggle-btn');
        if (groupBtn) {
            groupBtn.removeEventListener('click', this.onGroupToggleClick as any);
            groupBtn.addEventListener('click', this.onGroupToggleClick.bind(this));
        }
    }

    // Event handler for filter buttons
    onFilterClick(e: Event) {
        const target = e.currentTarget as HTMLElement;
        if (!this.elements) return;
        const filterButtons = this.elements.container.querySelectorAll('.filter-btn');
        filterButtons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.currentFilter = (target.dataset.filter as string) || 'all';
        this.applyFilter();
    }

    // Event handler for group toggle button
    onGroupToggleClick(e: Event) {
        const target = e.currentTarget as HTMLElement;
        this.groupBySuite = !this.groupBySuite;
        if (this.elements) {
            const groupBtn = this.elements.container.querySelector('.group-toggle-btn');
            if (groupBtn) groupBtn.classList.toggle('active', this.groupBySuite);
        }
        // Re-render table to apply grouping
        this.renderTable();
    }

    // Attach delegated listeners for dynamic UI elements (error toggles, group headers)
    attachDelegatedListeners(container: HTMLElement) {
        // Toggle error details
        container.addEventListener('click', (ev) => {
            const btn = (ev.target as HTMLElement).closest('.toggle-error') as HTMLElement | null;
            if (btn) {
                const details = btn.nextElementSibling as HTMLElement | null;
                if (details && details.classList.contains('error-details')) {
                    const isVisible = details.style.display === 'block';
                    details.style.display = isVisible ? 'none' : 'block';
                    btn.textContent = isVisible ? 'Show Error Details' : 'Hide Error Details';
                }
                ev.preventDefault();
                return;
            }

            // Group header toggle (collapse/expand)
            const groupHeader = (ev.target as HTMLElement).closest('.group-header') as HTMLElement | null;
            if (groupHeader) {
                const tbody = groupHeader.parentElement as HTMLTableSectionElement | null;
                if (!tbody) return;
                const collapsed = tbody.getAttribute('data-collapsed') === 'true';
                tbody.setAttribute('data-collapsed', (!collapsed).toString());
                // Toggle visibility of rows except the header
                const rows = Array.from(tbody.querySelectorAll('tr.group-row')) as HTMLElement[];
                rows.forEach(r => r.style.display = (!collapsed) ? 'none' : 'table-row');
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

    // Update top summary counters
    updateSummary() {
        const total = this.results.length;
        const pass = this.results.filter(t => t.status === 'pass').length;
        const fail = total - pass;
        if (!this.elements || !this.elements.summary) return;
        this.elements.summary.innerHTML = `
            <div class="summary-stats">
                <div class="stat total"><span class="stat-value">${total}</span><span class="stat-label">Total Tests</span></div>
                <div class="stat pass"><span class="stat-value">${pass}</span><span class="stat-label">Passed</span></div>
                <div class="stat fail"><span class="stat-value">${fail}</span><span class="stat-label">Failed</span></div>
            </div>
            <div class="filter-controls">
                <button class="filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All Tests</button>
                <button class="filter-btn ${this.currentFilter === 'pass' ? 'active' : ''}" data-filter="pass">Passed Only</button>
                <button class="filter-btn ${this.currentFilter === 'fail' ? 'active' : ''}" data-filter="fail">Failed Only</button>
                <button class="group-toggle-btn ${this.groupBySuite ? 'active' : ''}" data-group-by="suite">Group by Suite</button>
            </div>
        `;
        this.setupEventListeners();
    }

    // Render the table body, grouped or flat depending on settings
    renderTable() {
        if (!this.elements || !this.elements.tableBody) return;
        const tbody = this.elements.tableBody as HTMLElement;
        if (!this.groupBySuite) {
            // flat list
            tbody.innerHTML = this.results.map((test, index) => this.generateTestRow(test, index)).join('');
            this.applyFilter();
            return;
        }

        // Group by first non-root path element
        const groups: Record<string, any[]> = {};
        this.results.forEach(r => {
            const key = this.getGroupKey(r) || 'Ungrouped';
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });

        // Build HTML with multiple tbodies: each group gets its own tbody
        let html = '';
        Object.keys(groups).forEach(groupKey => {
            const tests = groups[groupKey];
            const pass = tests.filter(t => t.status === 'pass').length;
            const fail = tests.length - pass;
            // By default groups are expanded
            html += `<tbody data-group="${this.escapeHtml(groupKey)}" data-collapsed="false">`;
            // Group header row spans all columns
            html += `
                <tr class="group-header">
                    <td colspan="3">
                        <span class="group-title">${this.escapeHtml(groupKey)}</span>
                        <span class="group-meta"> — ${tests.length} tests (${pass} passed, ${fail} failed)</span>
                    </td>
                </tr>
            `;
            // Individual rows
            tests.forEach((t, idx) => {
                html += this.generateTestRow(t, idx, groupKey);
            });
            html += `</tbody>`;
        });

        tbody.innerHTML = html;
        this.applyFilter();
    }

    // Generate a single test row. If groupKey is provided, add a data-group attribute.
    generateTestRow(test: any, index: any, groupKey?: string) {
        const statusClass = test.status === 'pass' ? 'status-pass' : 'status-fail';
        const statusIcon = test.status === 'pass' ? '✅' : '❌';
        const statusText = test.status === 'pass' ? 'PASS' : 'FAIL';

        // Sanitize the test path to remove technical parts
        const sanitizedPath = this.sanitizePath(test.testPath);
        const displayPath = sanitizedPath.length ? sanitizedPath.join(' > ') : (test.name || 'Unnamed Test');
        const testName = (sanitizedPath.length ? sanitizedPath[sanitizedPath.length - 1] : (test.name || 'Unnamed Test'));

        const errorHtml = test.status === 'fail' && test.errors && test.errors.length ? `
            <button class="toggle-error">Show Error Details</button>
            <div class="error-details"><pre>${this.escapeHtml(test.errors.join('\n\n'))}</pre></div>
        ` : '';

        // Each test row has class group-row to allow collapsing inside its tbody
        return `
            <tr class="group-row" data-status="${this.escapeHtml(test.status)}" data-group="${this.escapeHtml(groupKey || '')}">
                <td>
                    <span class="status-indicator ${statusClass}">${statusIcon} ${statusText}</span>
                </td>
                <td>
                    <div class="test-path">${this.escapeHtml(displayPath)}</div>
                    <div class="test-name">${this.escapeHtml(testName)}</div>
                    ${errorHtml}
                </td>
                <td>
                    <span class="duration">${this.escapeHtml(String(test.duration || 0))}ms</span>
                </td>
            </tr>
        `;
    }

    // Apply the selected filter to rows and update group visibility and counts
    applyFilter() {
        if (!this.elements || !this.elements.tableBody) return;
        const container = this.elements.tableBody;
        // If grouped (multiple tbody), we need to check rows inside each tbody
        const tbodies = Array.from(container.querySelectorAll('tbody')) as HTMLTableSectionElement[];
        tbodies.forEach(tbody => {
            const groupRows = Array.from(tbody.querySelectorAll('tr.group-row')) as HTMLElement[];
            let anyVisible = false;
            groupRows.forEach(row => {
                const status = row.getAttribute('data-status') || '';
                const shouldShow = this.currentFilter === 'all' || status === this.currentFilter;
                row.style.display = shouldShow ? '' : 'none';
                if (shouldShow) anyVisible = true;
            });

            // If this tbody is a logical group (has group-header), show or hide header based on children
            const header = tbody.querySelector('tr.group-header') as HTMLElement | null;
            if (header) {
                header.style.display = anyVisible ? '' : 'none';
                // Update group counts meta text
                const groupName = tbody.getAttribute('data-group') || '';
                const visibleCount = groupRows.filter(r => r.style.display !== 'none').length;
                const totalCount = groupRows.length;
                const passed = groupRows.filter(r => r.style.display !== 'none' && r.getAttribute('data-status') === 'pass').length;
                const failed = visibleCount - passed;
                const meta = header.querySelector('.group-meta') as HTMLElement | null;
                if (meta) meta.textContent = ` — ${visibleCount} tests (${passed} passed, ${failed} failed)`;
            }
        });

        // If not grouped, plain table rows
        if (tbodies.length === 0) {
            const rows = Array.from(container.querySelectorAll('tr')) as HTMLElement[];
            rows.forEach(row => {
                const status = row.getAttribute('data-status') || '';
                const shouldShow = this.currentFilter === 'all' || status === this.currentFilter;
                row.style.display = shouldShow ? '' : 'none';
            });
        }
    }

    // Remove technical elements like ROOT_DESCRIBE_BLOCK from the path
    sanitizePath(path: any): string[] {
        if (!Array.isArray(path)) return [];
        return path.filter((p: string) => !!p && p !== 'ROOT_DESCRIBE_BLOCK');
    }

    // Helper to get group key (first non-root describe block)
    getGroupKey(test: any): string {
        const sanitized = this.sanitizePath(test.testPath);
        if (sanitized.length >= 2) {
            // If path has describe + test name, group by first describe
            return sanitized[0];
        }
        if (sanitized.length === 1) {
            // Single element: treat as group name
            return sanitized[0];
        }
        // Fallback: use file path or a generic string
        if (test.testPath && Array.isArray(test.testPath) && test.testPath.length) {
            return String(test.testPath.join(' > '));
        }
        return test.name || 'Ungrouped';
    }

    // Basic HTML escape to avoid injection and preserve pre formatting
    escapeHtml(value: string) {
        if (!value) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Destroy reporter and remove DOM elements
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
