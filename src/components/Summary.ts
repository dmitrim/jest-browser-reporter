import { calculateStats } from '../utils/helpers.js';

/**
 * Summary component displaying test statistics
 */
export class Summary {
    container: HTMLElement | null;
    stats: { total: number; passed: number; failed: number; };
    constructor(containerId: string) {
        this.container = document.getElementById(containerId);
        this.stats = { total: 0, passed: 0, failed: 0 };
    }
    
    /**
     * Renders summary with current statistics
     * @param {Array} results - Test results array
     */
    render(results: never[]) {
        this.stats = calculateStats(results);
        if (!this.container) {
            console.error("no container");
            return;
        }
        this.container.innerHTML = `
            <div class="summary-stats">
                <div class="stat total">
                    <span class="stat-value">${this.stats.total}</span>
                    <span class="stat-label">Total Tests</span>
                </div>
                <div class="stat passed">
                    <span class="stat-value">${this.stats.passed}</span>
                    <span class="stat-label">Passed</span>
                </div>
                <div class="stat failed">
                    <span class="stat-value">${this.stats.failed}</span>
                    <span class="stat-label">Failed</span>
                </div>
            </div>
            <div class="filter-controls">
                <button class="filter-btn active" data-filter="all">All Tests</button>
                <button class="filter-btn" data-filter="passed">Passed Only</button>
                <button class="filter-btn" data-filter="failed">Failed Only</button>
            </div>
        `;
    }
    
    /**
     * Updates statistics
     * @param {Array} results - Test results array
     */
    update(results: TestResult[]) {
        this.stats = calculateStats(results);
        if (!this.container) {
            console.error("no container");
            return;
        }
        const totalEl = this.container.querySelector('.stat.total .stat-value');
        const passedEl = this.container.querySelector('.stat.passed .stat-value');
        const failedEl = this.container.querySelector('.stat.failed .stat-value');

        if (totalEl) totalEl.textContent = String(this.stats.total);
        if (passedEl) passedEl.textContent = String(this.stats.passed);
        if (failedEl) failedEl.textContent = String(this.stats.failed);
    }
}

interface TestResult {
    // тут можно описать структуру одного результата теста
    passed: boolean;
    name: string;
    duration: number;
}