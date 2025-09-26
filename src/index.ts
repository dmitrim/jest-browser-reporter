/**
 * Jest Browser Reporter - Auto-generates complete HTML structure
 */

const STYLES = `
/* Base styles */
.jest-browser-reporter * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

.jest-browser-reporter {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f5f7fa;
    padding: 20px;
}

.jest-browser-reporter .back-link {
    display: inline-block;
    margin-bottom: 20px;
    text-decoration: none;
    color: #4a6ee0;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.jest-browser-reporter .back-link:hover {
    background-color: #eef2ff;
}

/* Test results container */
.jest-browser-reporter .test-results {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    margin-bottom: 20px;
}

/* Summary section */
.jest-browser-reporter .test-summary {
    padding: 20px;
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
}

.jest-browser-reporter .summary-stats {
    display: flex;
    gap: 20px;
}

.jest-browser-reporter .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.jest-browser-reporter .stat-value {
    font-size: 24px;
    font-weight: bold;
}

.jest-browser-reporter .stat-label {
    font-size: 14px;
    color: #64748b;
}

.jest-browser-reporter .passed .stat-value {
    color: #10b981;
}

.jest-browser-reporter .failed .stat-value {
    color: #ef4444;
}

.jest-browser-reporter .total .stat-value {
    color: #4a6ee0;
}

/* Filter controls */
.jest-browser-reporter .filter-controls {
    display: flex;
    gap: 10px;
}

.jest-browser-reporter .filter-btn {
    padding: 6px 12px;
    border: 1px solid #cbd5e1;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
}

.jest-browser-reporter .filter-btn.active {
    background: #4a6ee0;
    color: white;
    border-color: #4a6ee0;
}

/* Test table */
.jest-browser-reporter .test-table {
    width: 100%;
    border-collapse: collapse;
}

.jest-browser-reporter .test-table th {
    text-align: left;
    padding: 12px 16px;
    background-color: #f1f5f9;
    font-weight: 600;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
}

.jest-browser-reporter .test-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
}

.jest-browser-reporter .test-table tr:last-child td {
    border-bottom: none;
}

.jest-browser-reporter .test-table tr:hover {
    background-color: #f8fafc;
}

/* Status indicators */
.jest-browser-reporter .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
}

.jest-browser-reporter .status-pass {
    background-color: #d1fae5;
    color: #065f46;
}

.jest-browser-reporter .status-fail {
    background-color: #fee2e2;
    color: #991b1b;
}

/* Test path styling */
.jest-browser-reporter .test-path {
    color: #64748b;
    font-size: 14px;
}

.jest-browser-reporter .test-name {
    font-weight: 500;
    margin-top: 4px;
}

/* Error details */
.jest-browser-reporter .error-details {
    display: none;
    margin-top: 10px;
    padding: 10px;
    background-color: #fef2f2;
    border-radius: 4px;
    border-left: 4px solid #ef4444;
}

.jest-browser-reporter .error-details pre {
    white-space: pre-wrap;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    color: #991b1b;
    overflow-x: auto;
}

.jest-browser-reporter .toggle-error {
    background: none;
    border: none;
    color: #4a6ee0;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    margin-top: 5px;
}

.jest-browser-reporter .toggle-error:hover {
    text-decoration: underline;
}

/* Duration indicator */
.jest-browser-reporter .duration {
    color: #64748b;
    font-size: 14px;
}

/* Responsive design */
@media (max-width: 768px) {
    .jest-browser-reporter .test-summary {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }

    .jest-browser-reporter .test-table {
        display: block;
        overflow-x: auto;
    }
}
`;


export type JestBrowserReporterOptions = { container: HTMLElement; showBackLink: boolean };

export class JestBrowserReporter {
    options: JestBrowserReporterOptions;
    results: any[];
    currentFilter: string;
    elements: { container: HTMLElement; summary: Element | null; tableBody: Element | null; } | undefined;
    constructor(options: JestBrowserReporterOptions) {
        if (!options) options = {} as any;
        if (!options.container)
            options.container = document.body as HTMLElement;
        this.options = options;
        this.results = [];
        this.currentFilter = 'all';
        this.init();
    }

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
    }

    generateHTML() {
        const backLink = this.options.showBackLink ?
            '<a href="javascript:history.back()" class="back-link">&larr; Back</a>' : '';

        return `
            ${backLink}
            <div class="test-results">
                <div class="test-summary">
                    <div class="summary-stats">
                        <div class="stat total">
                            <span class="stat-value">0</span>
                            <span class="stat-label">Total Tests</span>
                        </div>
                        <div class="stat passed">
                            <span class="stat-value">0</span>
                            <span class="stat-label">Passed</span>
                        </div>
                        <div class="stat failed">
                            <span class="stat-value">0</span>
                            <span class="stat-label">Failed</span>
                        </div>
                    </div>
                    <div class="filter-controls">
                        <button class="filter-btn active" data-filter="all">All Tests</button>
                        <button class="filter-btn" data-filter="passed">Passed Only</button>
                        <button class="filter-btn" data-filter="failed">Failed Only</button>
                    </div>
                </div>
                
                <table class="test-table">
                    <thead>
                        <tr>
                            <th width="100px">Status</th>
                            <th>Test</th>
                            <th width="100px">Duration</th>
                        </tr>
                    </thead>
                    <tbody id="test-results-body"></tbody>
                </table>
            </div>
        `;
    }

    setupEventListeners() {
        if (!this.elements)
            return;
        const filterButtons = this.elements.container.querySelectorAll('.filter-btn');

        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                if (e.target) {
                    (e.target as HTMLElement).classList.add('active');
                    this.currentFilter = (e.target as HTMLElement).dataset.filter as string;
                }
                this.applyFilter();
            });
        });
    }

    render(results: any) {
        this.results = results;
        this.updateSummary();
        this.renderTable();
    }

    updateSummary() {
        const total = this.results.length;
        const passed = this.results.filter(t => t.status === 'pass').length;
        const failed = total - passed;
        if (!this.elements || !this.elements.summary)
            return;
        this.elements.summary.innerHTML = `
            <div class="summary-stats">
                <div class="stat total">
                    <span class="stat-value">${total}</span>
                    <span class="stat-label">Total Tests</span>
                </div>
                <div class="stat passed">
                    <span class="stat-value">${passed}</span>
                    <span class="stat-label">Passed</span>
                </div>
                <div class="stat failed">
                    <span class="stat-value">${failed}</span>
                    <span class="stat-label">Failed</span>
                </div>
            </div>
            <div class="filter-controls">
                <button class="filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All Tests</button>
                <button class="filter-btn ${this.currentFilter === 'passed' ? 'active' : ''}" data-filter="passed">Passed Only</button>
                <button class="filter-btn ${this.currentFilter === 'failed' ? 'active' : ''}" data-filter="failed">Failed Only</button>
            </div>
        `;

        this.setupEventListeners();
    }

    renderTable() {
        if (!this.elements || !this.elements.tableBody)
            return;
        this.elements.tableBody.innerHTML = this.results
            .map((test, index) => this.generateTestRow(test, index))
            .join('');

        this.applyFilter();
    }

    generateTestRow(test: any, index: any) {
        const statusClass = test.status === 'pass' ? 'status-pass' : 'status-fail';
        const statusIcon = test.status === 'pass' ? '✅' : '❌';
        const statusText = test.status === 'pass' ? 'PASS' : 'FAIL';

        const errorHtml = test.status === 'fail' && test.errors ? `
            <button class="toggle-error" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'; this.textContent = this.nextElementSibling.style.display === 'block' ? 'Hide Error Details' : 'Show Error Details'">
                Show Error Details
            </button>
            <div class="error-details">
                <pre>${test.errors.join('\n\n')}</pre>
            </div>
        ` : '';

        return `
            <tr data-status="${test.status}" data-index="${index}">
                <td>
                    <span class="status-indicator ${statusClass}">${statusIcon} ${statusText}</span>
                </td>
                <td>
                    <div class="test-path">${test.testPath ? test.testPath.join(' > ') : test.name}</div>
                    <div class="test-name">${test.name || 'Unnamed Test'}</div>
                    ${errorHtml}
                </td>
                <td>
                    <span class="duration">${test.duration || 0}ms</span>
                </td>
            </tr>
        `;
    }

    applyFilter() {
        if (!this.elements || !this.elements.tableBody)
            return;
        const rows = this.elements.tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const shouldShow = this.currentFilter === 'all' ||
                row.dataset.status === this.currentFilter;
            row.style.display = shouldShow ? '' : 'none';
        });
    }

    destroy() {
        return this.dipose();
    }

    dipose() {
        if (!this.elements || !this.elements.container)
            return;
        if (this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }        
    }
}

// Global registration for script tag usage
if (typeof window !== 'undefined') {
    (window as any).JestBrowserReporter = JestBrowserReporter;
}