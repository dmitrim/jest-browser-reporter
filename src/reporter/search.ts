/** Search text → lower-case alternatives: `"Signature | Licensing"` → `['signature', 'licensing']`. */
export function parseSearch(text: string): string[] {
    return text.toLowerCase().split('|').map(term => term.trim()).filter(Boolean);
}

/** Whether `name` contains any of the alternatives, ignoring case; no alternatives match everything. */
export function matchesSearch(name: string, terms: readonly string[]): boolean {
    if (!terms.length) return true;
    const text = name.toLowerCase();
    return terms.some(term => text.includes(term));
}
