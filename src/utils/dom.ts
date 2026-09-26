/** Escapes text for safe insertion into HTML content and attribute values. */
export function escapeHtml(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): (...args: A) => void {
    let timeout: number | undefined;
    return (...args: A) => {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(() => fn(...args), wait);
    };
}

/** `querySelector` that throws instead of returning null, for elements the reporter itself rendered. */
export function queryRequired<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`jest-browser-reporter: element "${selector}" not found`);
    return element;
}
