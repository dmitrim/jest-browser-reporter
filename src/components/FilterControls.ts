/**
 * Filter controls component
 */
export class FilterControls {
    onFilterChange: (filter: any) => void;
    currentFilter: string;
    constructor(onFilterChange: (filter: any) => void) {
        this.onFilterChange = onFilterChange;
        this.currentFilter = 'all';
    }
    
    /**
     * Sets up filter controls
     * @param {HTMLElement} container - Container element
     */
    setup(container: Element) {
        const filterButtons = container.querySelectorAll('.filter-btn');
        
        filterButtons.forEach((button: { addEventListener: (arg0: string, arg1: () => void) => void; classList: { add: (arg0: string) => void; }; getAttribute: (arg0: string) => any; }) => {
            button.addEventListener('click', () => {
                // Update active button
                filterButtons.forEach((btn: { classList: { remove: (arg0: string) => any; }; }) => btn.classList.remove('active'));
                button.classList.add('active');
                
                this.currentFilter = button.getAttribute('data-filter');
                this.onFilterChange(this.currentFilter);
            });
        });
    }
    
    /**
     * Gets current active filter
     * @returns {string} Current filter
     */
    getCurrentFilter() {
        return this.currentFilter;
    }
}