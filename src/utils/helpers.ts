/**
 * Utility functions for jest-browser-reporter
 */

/**
 * Calculates test statistics from results
 * @param {Array} results - Test results array
 * @returns {Object} Statistics object
 */
export function calculateStats(results: any) {
    const total = results.length;
    const passed = results.filter((test: { status: string; }) => test.status === 'pass').length;
    const failed = total - passed;
    
    return { total, passed, failed };
}

/**
 * Formats duration in milliseconds
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms: any) {
    return `${ms || 0}ms`;
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text: string | null) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}