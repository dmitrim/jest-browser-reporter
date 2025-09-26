import { Summary } from './Summary.js';
import { TestTable } from './TestTable.js';
import { FilterControls } from './FilterControls.js';

export type TestResultsOptions = { containerId: string; summaryId: string; tableBodyId: string; };

/**
 * Main test results component
 */
export class TestResults {
    options: TestResultsOptions;
    results: never[];
    summary: Summary;
    testTable: TestTable;
    filterControls: FilterControls;
    constructor(options: TestResultsOptions) {
        if (!options) {
            options = {} as any;
        }
        if (!options.containerId)
            options.containerId = 'test-results';
        if (!options.summaryId)
            options.summaryId = 'test-summary';
        if (!options.tableBodyId)
            options.tableBodyId = 'test-results-body';
        this.options = options;
        this.results = [];
        this.summary = new Summary(this.options.summaryId);
        this.testTable = new TestTable(this.options.tableBodyId);
        this.filterControls = new FilterControls(this.applyFilter.bind(this));
        
        this.initialize();
    }
    
    /**
     * Initializes the component
     */
    initialize() {
        // Load CSS styles
        this.loadStyles();
        
        // Set up filter controls after summary is rendered
        setTimeout(() => {
            const filterContainer = document.querySelector('.filter-controls');
            if (filterContainer) {
                this.filterControls.setup(filterContainer);
            }
        }, 0);
    }
    
    /**
     * Loads CSS styles
     */
    loadStyles() {
        if (document.getElementById('jest-browser-reporter-styles')) {
            return;
        }
        
        // In production, this would load from external CSS file
        const style = document.createElement('style');
        style.id = 'jest-browser-reporter-styles';
        style.textContent = this.getStyles();
        document.head.appendChild(style);
    }
    
    /**
     * Returns CSS styles (in production, this would be loaded from file)
     * @returns {string} CSS styles
     */
    getStyles() {
        // This would be the content of reporter.css
        return `/* CSS styles from your original code */`;
    }
    
    /**
     * Renders test results
     * @param {Array} results - Test results array
     */
    render(results: never[]) {
        this.results = results;
        
        this.summary.render(results);
        this.testTable.render(results);
        
        // Set up filter controls
        const filterContainer = document.querySelector('.filter-controls');
        if (filterContainer) {
            this.filterControls.setup(filterContainer);
        }
    }
    
    /**
     * Applies filter to test results
     * @param {string} filter - Filter type
     */
    applyFilter(filter: any) {
        this.testTable.applyFilter(filter);
    }
    
    /**
     * Updates results with new data
     * @param {Array} results - New test results
     */
    update(results: never[]) {
        this.results = results;
        this.summary.update(results);
        this.testTable.render(results);
        this.applyFilter(this.filterControls.getCurrentFilter());
    }
    
    /**
     * Clears all results
     */
    clear() {
        this.results = [];
        this.summary.render([]);
        this.testTable.clear();
    }
}