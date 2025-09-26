import { formatDuration, escapeHtml } from '../utils/helpers';

/**
 * Test table component
 */
export class TestTable {
    container: HTMLElement | null;
    rows: Map<any, any>;
    constructor(containerId: string) {
        this.container = document.getElementById(containerId);
        this.rows = new Map(); // Store row elements for filtering
    }
    
    /**
     * Renders test results table
     * @param {Array} results - Test results array
     */
    render(results: any[]) {
        this.rows.clear();
        if (!this.container) {
            console.error("no container");
            return;
        }
        this.container.innerHTML = '';
        
        results.forEach((test: { status: string; duration: any; }, index: any) => {
            const row = this.createTestRow(test, index);
            if (!this.container) {
                console.error("no container");
                return;
            }
            this.container.appendChild(row);
            this.rows.set(index, { element: row, status: test.status });
        });
    }
    
    /**
     * Creates a single test row
     * @param {Object} test - Test result object
     * @param {number} index - Row index
     * @returns {HTMLElement} Table row element
     */
    createTestRow(test: { status: string; duration: any; }, index: string) {
        const row = document.createElement('tr');
        row.setAttribute('data-status', test.status);
        row.setAttribute('data-index', index);
        
        // Status cell
        const statusCell = document.createElement('td');
        statusCell.innerHTML = this.createStatusIndicator(test.status);
        
        // Test info cell
        const testCell = document.createElement('td');
        testCell.innerHTML = this.createTestInfo(test as any);
        
        // Duration cell
        const durationCell = document.createElement('td');
        durationCell.innerHTML = `<span class="duration">${formatDuration(test.duration)}</span>`;
        
        row.appendChild(statusCell);
        row.appendChild(testCell);
        row.appendChild(durationCell);
        
        return row;
    }
    
    /**
     * Creates status indicator HTML
     * @param {string} status - Test status
     * @returns {string} HTML string
     */
    createStatusIndicator(status: string) {
        const isPass = status === 'pass';
        const icon = isPass ? '✅' : '❌';
        const text = isPass ? 'PASS' : 'FAIL';
        const className = isPass ? 'status-pass' : 'status-fail';
        
        return `<span class="status-indicator ${className}">${icon} ${text}</span>`;
    }
    
    /**
     * Creates test information HTML
     * @param {Object} test - Test result object
     * @returns {string} HTML string
     */
    createTestInfo(test: { testPath: any[]; name: any; status: string; errors: any; }) {
        const testPath = test.testPath ? test.testPath.join(' > ') : test.name;
        const errorDetails = test.status === 'fail' && test.errors ? this.createErrorDetails(test.errors) : '';
        
        return `
            <div class="test-path">${escapeHtml(testPath)}</div>
            <div class="test-name">${escapeHtml(test.name || 'Unnamed Test')}</div>
            ${errorDetails}
        `;
    }
    
    /**
     * Creates error details HTML for failed tests
     * @param {Array} errors - Array of error messages
     * @returns {string} HTML string
     */
    createErrorDetails(errors: any[]) {
        const escapedErrors = errors.map((error: string | null) => escapeHtml(error)).join('\n\n');
        
        return `
            <button class="toggle-error" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'; this.textContent = this.nextElementSibling.style.display === 'block' ? 'Hide Error Details' : 'Show Error Details'">
                Show Error Details
            </button>
            <div class="error-details">
                <pre>${escapedErrors}</pre>
            </div>
        `;
    }
    
    /**
     * Applies filter to table rows
     * @param {string} filter - Filter type ('all', 'passed', 'failed')
     */
    applyFilter(filter: string) {
        this.rows.forEach((rowData: { status: any; element: { style: { display: string; }; }; }, index: any) => {
            const shouldShow = filter === 'all' || rowData.status === filter;
            rowData.element.style.display = shouldShow ? '' : 'none';
        });
    }
    
    /**
     * Clears all rows
     */
    clear() {
        if (!this.container) {
            console.error("no container");
            return;
        }
        this.container.innerHTML = '';
        this.rows.clear();
    }
}