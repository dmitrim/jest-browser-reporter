import { runJestLite } from "./JestLiteUtils";
import { ERRORS_STYLES, formatErrorsHtml, formatSourceCodeHtml } from "./utils/SourceCodeFormat";

export { setupJestLiteGlobals } from "./JestLiteUtils";

// Enhanced Jest Browser Reporter with Source Code Display
// - Added source code display functionality
// - Source code button appears for all tests when available
// - Similar styling and behavior as error details

export type JestBrowserReporterOptions = {
    container: HTMLElement;
    showBackLink?: boolean;
    groupBySuite?: boolean;
    autoRun?: boolean;
};

const STYLES = `
/* Base styles */
.jest-browser-reporter * { box-sizing: border-box; margin: 0; padding: 0; }
.jest-browser-reporter { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f5f7fa; padding: 20px; min-height: 100vh; }
.jest-browser-reporter .back-link { display: inline-flex; align-items: center; margin-bottom: 20px; text-decoration: none; color: #4a6ee0; font-weight: 500; padding: 8px 16px; border-radius: 6px; transition: all 0.2s; border: 1px solid transparent; }
.jest-browser-reporter .back-link:hover { background-color: #eef2ff; border-color: #4a6ee0; }

/* Test results container */
.jest-browser-reporter .test-results { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; margin-bottom: 20px; transition: all 0.3s ease; }

/* Summary section */
.jest-browser-reporter .test-summary { padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
.jest-browser-reporter .summary-stats { display: flex; gap: 24px; flex-wrap: wrap; }
.jest-browser-reporter .stat { display: flex; flex-direction: column; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); min-width: 80px; }
.jest-browser-reporter .stat-value { font-size: 28px; font-weight: 700; line-height: 1; }
.jest-browser-reporter .stat-label { font-size: 13px; color: #64748b; font-weight: 500; margin-top: 4px; }
.jest-browser-reporter .pass .stat-value { color: #10b981; }
.jest-browser-reporter .fail .stat-value { color: #ef4444; }
.jest-browser-reporter .skip .stat-value { color: #f59e0b; }
.jest-browser-reporter .total .stat-value { color: #4a6ee0; }

/* Controls section */
.jest-browser-reporter .controls-container { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-left: auto; }

/* Filter & grouping controls */
.jest-browser-reporter .filter-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.jest-browser-reporter .filter-btn, .jest-browser-reporter .group-toggle-btn { 
    padding: 8px 16px; 
    border: 1px solid #cbd5e1; 
    background: white; 
    border-radius: 6px; 
    cursor: pointer; 
    font-size: 14px; 
    font-weight: 500;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.jest-browser-reporter .filter-btn:hover, .jest-browser-reporter .group-toggle-btn:hover { 
    background: #f8fafc; 
    border-color: #94a3b8; 
}
.jest-browser-reporter .filter-btn.active, .jest-browser-reporter .group-toggle-btn.active { 
    background: #4a6ee0; 
    color: white; 
    border-color: #4a6ee0; 
}

/* Search input with enhanced styling */
.jest-browser-reporter .search-container { position: relative; display: inline-flex; align-items: center; }
.jest-browser-reporter .search-input { 
    padding: 8px 40px 8px 16px; 
    border: 1px solid #cbd5e1; 
    border-radius: 6px; 
    font-size: 14px; 
    width: 280px; 
    transition: all 0.2s;
    background: white;
}
.jest-browser-reporter .search-input:focus { 
    outline: none; 
    border-color: #4a6ee0; 
    box-shadow: 0 0 0 3px rgba(74, 110, 224, 0.1); 
}
.jest-browser-reporter .search-input::placeholder { color: #94a3b8; }
.jest-browser-reporter .search-clear { 
    position: absolute; 
    right: 12px; 
    top: 50%; 
    transform: translateY(-50%); 
    background: none; 
    border: none; 
    font-size: 18px; 
    cursor: pointer; 
    color: #94a3b8; 
    padding: 0; 
    width: 20px; 
    height: 20px; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    border-radius: 50%;
    transition: all 0.2s;
}
.jest-browser-reporter .search-clear:hover { 
    background: #f1f5f9; 
    color: #64748b; 
}
.jest-browser-reporter .search-clear.hidden { display: none; }

/* Test table with enhanced styling */
.jest-browser-reporter .test-table { width: 100%; border-collapse: collapse; }
.jest-browser-reporter .test-table th { 
    text-align: left; 
    padding: 16px 20px; 
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); 
    font-weight: 600; 
    color: #475569; 
    border-bottom: 2px solid #e2e8f0; 
    font-size: 14px;
}
.jest-browser-reporter .test-table td { 
    padding: 16px 20px; 
    border-bottom: 1px solid #f1f5f9; 
    vertical-align: top;
}
.jest-browser-reporter .test-table tr:last-child td { border-bottom: none; }
.jest-browser-reporter .test-table tr:hover { background-color: #f8fafc; }

/* Enhanced status indicators */
.jest-browser-reporter .status-indicator { 
    display: inline-flex; 
    align-items: center; 
    gap: 8px; 
    padding: 6px 12px; 
    border-radius: 6px; 
    font-size: 13px; 
    font-weight: 600; 
    border: 1px solid transparent;
}
.jest-browser-reporter .status-pass { 
    background-color: #d1fae5; 
    color: #065f46; 
    border-color: #a7f3d0;
}
.jest-browser-reporter .status-fail { 
    background-color: #fee2e2; 
    color: #991b1b; 
    border-color: #fca5a5;
}
.jest-browser-reporter .status-skip { 
    background-color: #fef3c7; 
    color: #92400e; 
    border-color: #fcd34d;
}

/* Enhanced test information styling */
.jest-browser-reporter .test-info { flex: 1; min-width: 0; }
.jest-browser-reporter .test-path { 
    color: #64748b; 
    font-size: 13px; 
    margin-bottom: 4px;
    font-family: 'Consolas', 'Monaco', monospace;
}
.jest-browser-reporter .test-name { 
    font-weight: 600; 
    margin-bottom: 8px; 
    font-size: 15px;
    color: #1e293b;
}

/* error details */
${ERRORS_STYLES}

/* Source code display */
.jest-browser-reporter .source-code { 
    display: none; 
    margin-top: 12px; 
    padding: 12px; 
    background-color: #f8fafc; 
    border-radius: 6px; 
    border-left: 4px solid #4a6ee0; 
}
.jest-browser-reporter .source-code pre { 
    white-space: pre-wrap; 
    font-family: 'Consolas', 'Monaco', monospace; 
    font-size: 13px; 
    color: #374151; 
    overflow-x: auto; 
    line-height: 1.4;
    margin: 0;
}

.jest-browser-reporter .toggle-error,
.jest-browser-reporter .toggle-source { 
    background: none; 
    border: none; 
    color: #4a6ee0; 
    cursor: pointer; 
    font-size: 13px; 
    padding: 4px 0; 
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: 16px;
}
.jest-browser-reporter .toggle-error:hover,
.jest-browser-reporter .toggle-source:hover { text-decoration: underline; }

/* Enhanced grouping */
.jest-browser-reporter .group-header { 
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); 
    font-weight: 700; 
    cursor: pointer; 
    transition: background-color 0.2s;
}
.jest-browser-reporter .group-header:hover { background: #e2e8f0; }
.jest-browser-reporter .group-meta { 
    color: #64748b; 
    font-weight: 500; 
    font-size: 13px; 
    margin-left: 8px; 
    font-style: italic;
}
.jest-browser-reporter .group-title { color: #1e293b; }

/* Enhanced duration indicator */
.jest-browser-reporter .duration { 
    color: #64748b; 
    font-size: 14px; 
    font-weight: 500;
    font-family: 'Consolas', 'Monaco', monospace;
}
.jest-browser-reporter .duration.skipped { color: #94a3b8; font-style: italic; }

/* Enhanced running indicator */
.jest-browser-reporter .running-indicator {
    padding: 24px;
    text-align: center;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    margin-bottom: 20px;
    font-size: 16px;
    color: #4a6ee0;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border: 2px dashed #e2e8f0;
    min-height: 74px; /* Fixed height to prevent layout jumps */
}
.jest-browser-reporter .running-indicator.hidden { display: none; }

.jest-browser-reporter .running-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #4a6ee0;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    flex-shrink: 0; /* Prevent spinner from shrinking */
}

.jest-browser-reporter .running-text {
    text-align: left;
    min-width: 0; /* Allow text to shrink if needed */
    flex: 1;
}

.jest-browser-reporter .running-main-text {
    display: block;
    margin-bottom: 4px;
}

.jest-browser-reporter .running-status-text {
    display: block;
    font-size: 14px;
    font-weight: normal;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 500px;
}

/* Enhanced run buttons */
.jest-browser-reporter .run-btn {
    padding: 6px 12px;
    border: 1px solid #cbd5e1;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #475569;
    text-decoration: none;
}
.jest-browser-reporter .run-btn:hover {
    background: #4a6ee0;
    color: white;
    border-color: #4a6ee0;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(74, 110, 224, 0.3);
}
.jest-browser-reporter .run-btn:active {
    transform: translateY(0);
}
.jest-browser-reporter .run-btn.running {
    background: #f59e0b;
    color: white;
    border-color: #f59e0b;
    cursor: not-allowed;
    opacity: 0.7;
}

.jest-browser-reporter .run-all-btn {
    padding: 8px 16px;
    border: 1px solid #4a6ee0;
    background: #4a6ee0;
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.jest-browser-reporter .run-all-btn:hover {
    background: #374acb;
    border-color: #374acb;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(74, 110, 224, 0.3);
}
.jest-browser-reporter .run-all-btn:active {
    transform: translateY(0);
}
.jest-browser-reporter .run-all-btn.running {
    background: #f59e0b;
    border-color: #f59e0b;
    cursor: not-allowed;
}

/* Test actions container */
.jest-browser-reporter .test-actions {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-top: 8px;
}

/* Enhanced row layout */
.jest-browser-reporter .test-row-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
}

.jest-browser-reporter .test-main-content {
    flex: 1;
    min-width: 0;
}

.jest-browser-reporter .test-side-content {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    min-width: 140px;
}

/* Responsive design */
@media (max-width: 768px) {
    .jest-browser-reporter { padding: 12px; }
    .jest-browser-reporter .test-summary { padding: 16px; flex-direction: column; align-items: stretch; }
    .jest-browser-reporter .controls-container { margin-left: 0; justify-content: center; }
    .jest-browser-reporter .summary-stats { justify-content: center; }
    .jest-browser-reporter .search-input { width: 100%; max-width: 300px; }
    .jest-browser-reporter .test-table th, 
    .jest-browser-reporter .test-table td { padding: 12px; }
    .jest-browser-reporter .test-row-content { flex-direction: column; gap: 12px; }
    .jest-browser-reporter .test-side-content { align-items: stretch; width: 100%; }
    .jest-browser-reporter .run-btn { justify-content: center; }
    .jest-browser-reporter .test-actions { flex-direction: column; align-items: flex-start; }
    .jest-browser-reporter .toggle-error,
    .jest-browser-reporter .toggle-source { margin-right: 0; margin-bottom: 8px; }
    .jest-browser-reporter .running-status-text {
        max-width: 200px;
    }
}

/* Keyboard shortcut hint */
.jest-browser-reporter .keyboard-hint {
    font-size: 11px;
    color: #94a3b8;
    margin-left: 4px;
    font-weight: normal;
}

/* Empty state */
.jest-browser-reporter .empty-state {
    padding: 40px 20px;
    text-align: center;
    color: #64748b;
    font-size: 16px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Focus styles for accessibility */
.jest-browser-reporter button:focus-visible {
    outline: 2px solid #4a6ee0;
    outline-offset: 2px;
}

/* Print styles */
@media print {
    .jest-browser-reporter .run-btn,
    .jest-browser-reporter .run-all-btn,
    .jest-browser-reporter .back-link,
    .jest-browser-reporter .filter-controls {
        display: none !important;
    }
    
    .jest-browser-reporter {
        background: white;
        padding: 0;
    }
    
    .jest-browser-reporter .test-results {
        box-shadow: none;
        border: 1px solid #ccc;
    }
}`;

export class JestBrowserReporter {
    options: JestBrowserReporterOptions;
    results: any[];
    currentFilter: string;
    currentSearch: string;
    groupBySuite: boolean;
    isRunning: boolean;
    elements: {
        container: HTMLElement;
        summary: Element | null;
        tableBody: Element | null;
        searchInput: HTMLInputElement | null;
        searchClear: HTMLElement | null;
        runningIndicator?: HTMLElement | null;
        runningStatusText?: HTMLElement | null;
        runningMainText?: HTMLElement | null;
    } | undefined;
    private searchHandler?: (e: Event) => void;
    private clearHandler?: (e: Event) => void;
    private keydownHandler?: (e: KeyboardEvent) => void;

    constructor(options: JestBrowserReporterOptions) {
        this.options = options || {} as any;
        this.options.container ||= document.body as HTMLElement;
        this.results = [];
        this.currentFilter = 'all';
        this.currentSearch = '';
        this.groupBySuite = !!options.groupBySuite;
        this.isRunning = false;

        this.init();

        // Auto-run if enabled
        if (this.options.autoRun) {
            setTimeout(() => this.run(), 100);
        } else {
            this.showRunningIndicator('Ready to run tests - click "Run All" to start');
        }
    }

    /**
     * Asynchronously runs Jest Lite tests with enhanced UI feedback
     */
    public async run(testNameFilter?: string): Promise<any> {
        if (this.isRunning) {
            console.warn('Tests are already running');
            return [];
        }

        this.isRunning = true;
        this.updateRunButtonsState(true);

        this.bindJestEvents();

        (globalThis as any).__JESTLITE_TEST_NAME_FILTER__ = testNameFilter || undefined;
        this.showRunningIndicator(testNameFilter ? `Running tests matching: "${testNameFilter}"` : 'Running all tests...');

        try {
            const results = await runJestLite();
            this.render(results);
            return results;
        } catch (ex) {
            console.error('Test execution failed:', ex);
            this.showError('Test execution failed: ' + (ex instanceof Error ? ex.message : String(ex)));
            return [];
        } finally {
            this.isRunning = false;
            this.updateRunButtonsState(false);
            this.hideRunningIndicator();

            this.unbindJestEvents();
        }
    }

    _jestEventsHandler: any;

    bindJestEvents() {
        this._jestEventsHandler = (e: Event) => {
            const customEvent = e as CustomEvent;
            const data = customEvent.detail;

            let actionName = data.name;
            switch (actionName) {
                case "test_start":
                    actionName = "Running test";
                    break;
                default:
                    return;
            }
            const testObj = data.test;
            let currentStatusMsg = `${actionName}`;
            if (testObj) {
                currentStatusMsg += `: ${testObj.name}`;
            }
            this.updateRunningStatus(currentStatusMsg);
        };
        document.addEventListener("jestlite_event", this._jestEventsHandler);
    }

    unbindJestEvents() {
        document.removeEventListener("jestlite_event", this._jestEventsHandler);
    }

    /**
     * Update only the status text without replacing the entire indicator
     */
    private updateRunningStatus(statusMessage: string) {
        if (!this.elements?.runningStatusText) {
            // If elements not initialized yet, fall back to the old method
            this.showRunningIndicator(undefined, statusMessage);
            return;
        }

        this.elements.runningStatusText.textContent = this.escapeHtml(statusMessage);

        // Ensure indicator is visible
        if (this.elements.runningIndicator) {
            this.elements.runningIndicator.classList.remove('hidden');
        }
    }

    /**
     * Show error message in the UI
     */
    private showError(message: string) {
        if (!this.elements?.container) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'running-indicator';
        errorDiv.style.background = '#fef2f2';
        errorDiv.style.borderColor = '#fecaca';
        errorDiv.style.color = '#dc2626';
        errorDiv.innerHTML = `
            <span style="font-size: 24px; flex-shrink: 0;">⚠️</span>
            <span class="running-text">${this.escapeHtml(message)}</span>
        `;

        const existingIndicator = this.elements.container.querySelector('.running-indicator');
        if (existingIndicator) {
            existingIndicator.replaceWith(errorDiv);
        } else {
            this.elements.container.insertBefore(errorDiv, this.elements.container.firstChild);
        }
    }

    /**
     * Update state of all run buttons
     */
    private updateRunButtonsState(running: boolean) {
        if (!this.elements?.container) return;

        const buttons = this.elements.container.querySelectorAll('.run-btn, .run-all-btn');
        buttons.forEach(btn => {
            if (running) {
                btn.classList.add('running');
                btn.innerHTML = btn.classList.contains('run-all-btn')
                    ? '⏳ Running...'
                    : '⏳';
            } else {
                btn.classList.remove('running');
                if (btn.classList.contains('run-all-btn')) {
                    btn.innerHTML = '▶️ Run All';
                } else {
                    btn.innerHTML = '▶️ Run';
                }
            }
        });
    }

    _prevRunningMessage: any;

    /**
     * Show running indicator with custom message
     */
    private showRunningIndicator(message?: string, statusMessage?: string) {
        if (!this.elements || !this.elements.container) return;

        message = message || this._prevRunningMessage;
        if (!message)
            message = 'Running tests…';

        this._prevRunningMessage = message;

        let indicator = this.elements.container.querySelector('.running-indicator') as HTMLElement | null;
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'running-indicator';
            const backLink = this.elements.container.querySelector('.back-link');
            if (backLink && backLink.nextSibling) {
                this.elements.container.insertBefore(indicator, backLink.nextSibling);
            } else {
                this.elements.container.insertBefore(indicator, this.elements.container.firstChild);
            }
        }

        // Create structured HTML with separate elements for each part
        indicator.innerHTML = `
            <div class="running-spinner"></div>
            <div class="running-text">
                <span class="running-main-text">${this.escapeHtml(message)}</span>
                ${statusMessage ? `<span class="running-status-text">${this.escapeHtml(statusMessage)}</span>` : ''}
            </div>
        `;

        indicator.classList.remove('hidden');

        // Store references to important elements for later updates
        this.elements.runningIndicator = indicator;
        this.elements.runningMainText = indicator.querySelector('.running-main-text') as HTMLElement | null;
        this.elements.runningStatusText = indicator.querySelector('.running-status-text') as HTMLElement | null;

        const testResults = this.elements.container.querySelector('.test-results') as HTMLElement | null;
        if (testResults) {
            testResults.classList.add('hidden');
        }
    }

    /**
     * Hide the running indicator and show test results
     */
    private hideRunningIndicator() {
        if (!this.elements || !this.elements.container) return;

        const indicator = this.elements.container.querySelector('.running-indicator') as HTMLElement | null;
        if (indicator) {
            indicator.classList.add('hidden');
        }

        // Clear element references
        this.elements.runningIndicator = null;
        this.elements.runningMainText = null;
        this.elements.runningStatusText = null;

        const testResults = this.elements.container.querySelector('.test-results') as HTMLElement | null;
        if (testResults) {
            testResults.classList.remove('hidden');
        }
    }

    // Initialize UI and listeners
    private init() {
        this.injectStyles();
        this.createHTMLStructure();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }

    private injectStyles() {
        if (document.getElementById('jest-browser-reporter-styles')) return;
        const style = document.createElement('style');
        style.id = 'jest-browser-reporter-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    // Build DOM skeleton
    private createHTMLStructure() {
        const container = document.createElement('div');
        container.className = 'jest-browser-reporter';
        container.innerHTML = this.generateHTML();
        this.options.container.appendChild(container);

        this.elements = {
            container,
            summary: container.querySelector('.test-summary'),
            tableBody: container.querySelector('#test-results-body'),
            searchInput: container.querySelector('.search-input') as HTMLInputElement | null,
            searchClear: container.querySelector('.search-clear') as HTMLElement | null
        };

        this.attachDelegatedListeners(container);
    }

    private generateHTML() {
        const backLink = this.options.showBackLink ?
            '<a href="javascript:history.back()" class="back-link">← Back to Previous Page</a>' : '';

        return `
            ${backLink}
            <div class="test-results">
                <div class="test-summary">
                    <div class="summary-stats">
                        <div class="stat total"><span class="stat-value">0</span><span class="stat-label">Total Tests</span></div>
                        <div class="stat pass"><span class="stat-value">0</span><span class="stat-label">Passed</span></div>
                        <div class="stat fail"><span class="stat-value">0</span><span class="stat-label">Failed</span></div>
                        <div class="stat skip"><span class="stat-value">0</span><span class="stat-label">Skipped</span></div>
                    </div>
                    <div class="controls-container">
                        <div class="filter-controls">
                            <div class="search-container">
                                <input type="text" class="search-input" placeholder="Search tests…" />
                                <button class="search-clear hidden" type="button" title="Clear search">×</button>
                            </div>
                            <button class="filter-btn active" data-filter="all">All</button>
                            <button class="filter-btn" data-filter="pass">Passed</button>
                            <button class="filter-btn" data-filter="fail">Failed</button>
                            <button class="filter-btn" data-filter="skip">Skipped</button>
                            <button class="group-toggle-btn ${this.groupBySuite ? 'active' : ''}" data-group-by="suite">Group by Suite</button>
                        </div>
                        <button class="run-all-btn" data-action="run-all" title="Run all tests (Ctrl+Enter)">
                            ▶️ Run All
                        </button>
                    </div>
                </div>

                <table class="test-table">
                    <thead>
                        <tr>
                            <th width="140px">Status</th>
                            <th>Test Details</th>
                            <th width="140px">Duration</th>
                        </tr>
                    </thead>
                    <tbody id="test-results-body">
                        <tr>
                            <td colspan="3" class="empty-state">No test results yet. Click "Run All" to start testing.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    // Setup keyboard shortcuts
    private setupKeyboardShortcuts() {
        if (!this.elements?.container) return;

        this.keydownHandler = (e: KeyboardEvent) => {
            // Ctrl+F or Cmd+F for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.elements?.searchInput?.focus();
                return;
            }

            // Escape to clear search
            if (e.key === 'Escape' && this.elements?.searchInput) {
                if (this.elements.searchInput.value) {
                    this.onClearSearch();
                } else {
                    this.elements.searchInput.blur();
                }
                return;
            }

            // Ctrl+Enter to run all tests
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (!this.isRunning) {
                    this.run();
                }
                return;
            }
        };

        document.addEventListener('keydown', this.keydownHandler);
    }

    // Attach event listeners for filters/search
    private setupEventListeners() {
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
                this.updateClearButtonVisibility();
                this.applyFilter();
            }, 180);
            this.elements.searchInput.addEventListener('input', this.searchHandler);
            this.elements.searchInput.value = this.currentSearch || '';
        }

        // Clear button
        if (this.elements.searchClear) {
            if (this.clearHandler) {
                this.elements.searchClear.removeEventListener('click', this.clearHandler);
            }
            this.clearHandler = this.onClearSearch.bind(this);
            this.elements.searchClear.addEventListener('click', this.clearHandler);
        }

        this.updateClearButtonVisibility();
    }

    private onFilterClick(e: Event) {
        const target = e.currentTarget as HTMLElement;
        if (!this.elements) return;
        const filterButtons = this.elements.container.querySelectorAll('.filter-btn');
        filterButtons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.currentFilter = (target.dataset.filter as string) || 'all';
        this.applyFilter();
    }

    private onGroupToggleClick() {
        this.groupBySuite = !this.groupBySuite;
        if (this.elements) {
            const groupBtn = this.elements.container.querySelector('.group-toggle-btn');
            if (groupBtn) groupBtn.classList.toggle('active', this.groupBySuite);
        }
        this.renderTable();
    }

    private onClearSearch() {
        if (!this.elements?.searchInput) return;

        this.elements.searchInput.value = '';
        this.currentSearch = '';
        this.updateClearButtonVisibility();
        this.applyFilter();
        this.elements.searchInput.focus();
    }

    private updateClearButtonVisibility() {
        if (!this.elements?.searchClear) return;

        const hasText = this.currentSearch.length > 0;
        if (hasText) {
            this.elements.searchClear.classList.remove('hidden');
        } else {
            this.elements.searchClear.classList.add('hidden');
        }
    }

    // Delegated click handling
    private attachDelegatedListeners(container: HTMLElement) {
        container.addEventListener('click', (ev) => {
            const target = ev.target as HTMLElement;

            // Run single test
            if (target.matches('.run-btn[data-action="run-test"]')) {
                const testName = target.getAttribute('data-test-name') || '';
                if (testName && !this.isRunning) {
                    this.run(testName);
                }
                ev.preventDefault();
                return;
            }

            // Run all tests
            if (target.matches('.run-all-btn[data-action="run-all"]')) {
                if (!this.isRunning) {
                    this.run();
                }
                ev.preventDefault();
                return;
            }

            // Toggle error details
            const errorBtn = target.closest('.toggle-error') as HTMLElement | null;
            if (errorBtn) {
                this.toggleErrorDetails(errorBtn);
                ev.preventDefault();
                return;
            }

            // Toggle source code
            const sourceBtn = target.closest('.toggle-source') as HTMLElement | null;
            if (sourceBtn) {
                this.toggleSourceCode(sourceBtn);
                ev.preventDefault();
                return;
            }

            // Toggle group rows
            const header = target.closest('.group-header') as HTMLElement | null;
            if (header) {
                const groupKey = header.getAttribute('data-group') || '';
                const collapsed = header.getAttribute('data-collapsed') === 'true';
                header.setAttribute('data-collapsed', (!collapsed).toString());
                const safeSelector = this.escapeForSelector(groupKey);
                const rows = Array.from(container.querySelectorAll(`tr.group-row[data-group="${safeSelector}"]`)) as HTMLElement[];
                rows.forEach(r => r.style.display = collapsed ? '' : 'none');

                // Update header icon
                const icon = header.querySelector('.group-icon') as HTMLElement;
                if (icon) {
                    icon.textContent = collapsed ? '🔽' : '▶️';
                }
                ev.preventDefault();
                return;
            }
        });
    }

    /**
     * Toggle error details display
     */
    private toggleErrorDetails(button: HTMLElement) {
        const cell = button.closest('td');
        if (cell) {
            const details = cell.querySelector('.error-details') as HTMLElement | null;
            if (details) {
                const isVisible = details.style.display === 'block';
                details.style.display = isVisible ? 'none' : 'block';
                button.innerHTML = isVisible ?
                    '🔽 Show Error Details' :
                    '🔼 Hide Error Details';
            }
        }
    }

    /**
     * Toggle source code display
     */
    private toggleSourceCode(button: HTMLElement) {
        const cell = button.closest('td');
        if (cell) {
            const sourceCode = cell.querySelector('.source-code') as HTMLElement | null;
            if (sourceCode) {
                const isVisible = sourceCode.style.display === 'block';
                sourceCode.style.display = isVisible ? 'none' : 'block';
                button.innerHTML = isVisible ?
                    '📄 Show Source Code' :
                    '📋 Hide Source Code';
            }
        }
    }

    /**
     * Get source code for a test from the global map
     */
    private getTestSourceCode(testName: string): string | null {
        try {
            const sourceMap = (globalThis as any).__JESTLITE_TEST_SOURCE_MAP__;
            if (sourceMap && sourceMap.has(testName)) {
                const sourceInfo = sourceMap.get(testName);
                return sourceInfo?.formatted || sourceInfo?.source || null;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Render test results into the reporter
     */
    render(results: any[]) {
        this.results = results || [];
        this.hideRunningIndicator();
        this.updateSummary();
        this.renderTable();
    }

    // Update summary area
    private updateSummary() {
        const total = this.results.length;
        const pass = this.results.filter(t => t.status === 'pass').length;
        const fail = this.results.filter(t => t.status === 'fail').length;
        const skip = this.results.filter(t => t.status === 'skip').length;

        if (!this.elements || !this.elements.summary) return;
        this.elements.summary.innerHTML = `
        <div class="summary-stats">
            <div class="stat total"><span class="stat-value">${total}</span><span class="stat-label">Total</span></div>
            <div class="stat pass"><span class="stat-value">${pass}</span><span class="stat-label">Passed</span></div>
            <div class="stat fail"><span class="stat-value">${fail}</span><span class="stat-label">Failed</span></div>
            <div class="stat skip"><span class="stat-value">${skip}</span><span class="stat-label">Skipped</span></div>
        </div>
        <div class="controls-container">
            <div class="filter-controls">
                <div class="search-container">
                    <input type="text" class="search-input" placeholder="Search tests…" value="${this.escapeHtml(this.currentSearch)}"/>
                    <button class="search-clear ${this.currentSearch ? '' : 'hidden'}" type="button" title="Clear search">×</button>
                </div>
                <button class="filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                <button class="filter-btn ${this.currentFilter === 'pass' ? 'active' : ''}" data-filter="pass">Passed</button>
                <button class="filter-btn ${this.currentFilter === 'fail' ? 'active' : ''}" data-filter="fail">Failed</button>
                <button class="filter-btn ${this.currentFilter === 'skip' ? 'active' : ''}" data-filter="skip">Skipped</button>
                <button class="group-toggle-btn ${this.groupBySuite ? 'active' : ''}" data-group-by="suite">Group by Suite</button>
            </div>
            <button class="run-all-btn" data-action="run-all" title="Run all tests (Ctrl+Enter)">
                ▶️ Run All
            </button>
        </div>
    `;

        if (this.elements && this.elements.container) {
            this.elements.summary = this.elements.container.querySelector('.test-summary');
            this.elements.tableBody = this.elements.container.querySelector('#test-results-body');
            this.elements.searchInput = this.elements.summary?.querySelector('.search-input') as HTMLInputElement | null;
            this.elements.searchClear = this.elements.summary?.querySelector('.search-clear') as HTMLElement | null;
        }
        this.setupEventListeners();
    }

    // Render table rows
    private renderTable() {
        if (!this.elements?.tableBody) return;
        const tbody = this.elements.tableBody as HTMLElement;

        if (this.results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-state">
                        No tests found. Check your test configuration.
                    </td>
                </tr>
            `;
            return;
        }

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
            const fail = tests.filter(t => t.status === 'fail').length;
            const skip = tests.filter(t => t.status === 'skip').length;

            html += `
                <tr class="group-header" data-group="${this.escapeHtml(groupKey)}" data-collapsed="false">
                    <td colspan="3">
                        <span class="group-icon">🔽</span>
                        <span class="group-title">${this.escapeHtml(groupKey)}</span>
                        <span class="group-meta"> — ${tests.length} tests (${pass} passed, ${fail} failed, ${skip} skipped)</span>
                    </td>
                </tr>
            `;

            tests.forEach((t, idx) => {
                html += this.generateTestRow(t, idx, groupKey);
            });
        });

        tbody.innerHTML = html;
        this.applyFilter();
    }

    // Single test row generator
    private generateTestRow(test: any, index: any, groupKey?: string) {
        const statusClass = `status-${test.status}`;
        const statusIcons: any = { 'pass': '✅', 'fail': '❌', 'skip': '⏭️' };
        const statusTexts: any = { 'pass': 'PASS', 'fail': 'FAIL', 'skip': 'SKIP' };
        const statusIcon = statusIcons[test.status] || '❓';
        const statusText = statusTexts[test.status] || test.status.toUpperCase();

        const sanitizedPath = this.sanitizePath(test.testPath);
        const displayPath = sanitizedPath.length ? sanitizedPath.join(' › ') : (test.name || 'Unnamed Test');
        const testName = (test.name || (sanitizedPath[sanitizedPath.length - 1]) || 'Unnamed Test');

        // Get source code for this test
        const sourceCode = this.getTestSourceCode(testName);

        // Build actions section with source code button (always shown when source is available)
        const sourceButton = sourceCode ?
            `<button class="toggle-source">📄 Show Source Code</button>` : '';

        const errorButton = test.status === 'fail' && test.errors?.length ?
            `<button class="toggle-error">🔽 Show Error Details</button>` : '';

        const actionsHtml = sourceButton || errorButton ? `
            <div class="test-actions">
                ${errorButton}
                ${sourceButton}
            </div>
        ` : '';

        const errorHtml = test.status === 'fail' && test.errors?.length ? formatErrorsHtml(test.errors) : '';

        const sourceCodeHtml: string = formatSourceCodeHtml(sourceCode);

        const durationHtml = test.status === 'skip'
            ? '<span class="duration skipped">-</span>'
            : `<span class="duration">${this.escapeHtml(String(test.duration || 0))}ms</span>`;

        const searchValue = this.escapeHtml((testName + ' ' + displayPath).toLowerCase());

        return `
<tr class="group-row" data-status="${this.escapeHtml(test.status)}" 
    data-group="${this.escapeHtml(groupKey || '')}" 
    data-search="${searchValue}">
    <td>
        <span class="status-indicator ${statusClass}">${statusIcon} ${statusText}</span>
    </td>
    <td>
        <div class="test-row-content">
            <div class="test-main-content">
                <div class="test-path">${this.escapeHtml(displayPath)}</div>
                <div class="test-name">${this.escapeHtml(testName)}</div>
                ${actionsHtml}
                ${errorHtml}
                ${sourceCodeHtml}
            </div>
            <div class="test-side-content">
                ${durationHtml}
                <button class="run-btn" data-action="run-test" data-test-name="${this.escapeHtml(testName)}" 
                        title="Run this test individually">
                    ▶️ Run
                </button>
            </div>
        </div>
    </td>
    <td></td> <!-- Empty cell for alignment -->
</tr>
`;
    }

    // Apply filters and search
    private applyFilter() {
        if (!this.elements?.tableBody) return;
        const container = this.elements.tableBody;
        const rowsAll = Array.from(container.querySelectorAll('tr.group-row')) as HTMLElement[];

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

        const headers = Array.from(container.querySelectorAll('tr.group-header')) as HTMLElement[];
        headers.forEach(header => {
            const groupKey = header.getAttribute('data-group') || '';
            const safeSelector = this.escapeForSelector(groupKey);
            const groupRows = Array.from(container.querySelectorAll(`tr.group-row[data-group="${safeSelector}"]`)) as HTMLElement[];
            let visibleCount = 0;
            let passed = 0;
            let failed = 0;
            let skipped = 0;

            groupRows.forEach(row => {
                const status = row.getAttribute('data-status') || '';
                const searchAttr = row.getAttribute('data-search') || '';
                const matchesFilter = this.currentFilter === 'all' || status === this.currentFilter;
                const matchesSearch = !this.currentSearch || searchAttr.indexOf(this.currentSearch) !== -1;
                const shouldShow = matchesFilter && matchesSearch;
                const collapsed = header.getAttribute('data-collapsed') === 'true';

                row.style.display = collapsed ? 'none' : (shouldShow ? '' : 'none');

                if (shouldShow) {
                    visibleCount++;
                    if (status === 'pass') passed++;
                    else if (status === 'fail') failed++;
                    else if (status === 'skip') skipped++;
                }
            });

            const meta = header.querySelector('.group-meta') as HTMLElement | null;
            if (meta) meta.textContent = ` — ${visibleCount} tests (${passed} passed, ${failed} failed, ${skipped} skipped)`;
            header.style.display = visibleCount > 0 ? '' : 'none';
        });
    }

    // Remove technical parts like ROOT_DESCRIBE_BLOCK from path
    private sanitizePath(path: any): string[] {
        if (!Array.isArray(path)) return [];
        return path.filter((p: string) => !!p && p !== 'ROOT_DESCRIBE_BLOCK');
    }

    // Decide a group key for a test
    private getGroupKey(test: any): string {
        const sanitized = this.sanitizePath(test.testPath);
        if (sanitized.length >= 2) {
            return sanitized[0];
        }
        if (sanitized.length === 1) {
            return sanitized[0];
        }
        if (test.testPath && Array.isArray(test.testPath) && test.testPath.length) {
            return String(test.testPath.join(' › '));
        }
        return test.name || 'Ungrouped';
    }

    // Simple HTML escape for safe insertion
    private escapeHtml(value: string) {
        if (!value) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Escape string for use inside attribute selector
    private escapeForSelector(value: string) {
        if (!value) return '';
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    // Debounce helper
    private debounce(fn: (e: Event) => void, wait: number) {
        let timeout: number | null = null;
        return (e: Event) => {
            if (timeout) window.clearTimeout(timeout);
            timeout = window.setTimeout(() => {
                fn(e);
                timeout = null;
            }, wait);
        };
    }

    // Cleanup method
    destroy() {
        this.dispose();
    }

    private dispose() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }

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