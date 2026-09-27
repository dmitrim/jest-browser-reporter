const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * Human-readable duration with the two most significant units:
 * `850ms`, `1sec 234ms`, `2min 5sec`, `1h 3min`. A zero second unit is left out (`2sec`, `3min`).
 */
export function formatDuration(ms: number): string {
    const total = Math.max(0, Math.round(ms));
    if (total < SECOND) return `${total}ms`;

    const units: Array<[size: number, label: string, next: number, nextLabel: string]> = [
        [HOUR, 'h', MINUTE, 'min'],
        [MINUTE, 'min', SECOND, 'sec'],
        [SECOND, 'sec', 1, 'ms'],
    ];
    for (const [size, label, next, nextLabel] of units) {
        if (total >= size) {
            const major = Math.floor(total / size);
            const minor = Math.floor((total % size) / next);
            return minor ? `${major}${label} ${minor}${nextLabel}` : `${major}${label}`;
        }
    }
    return `${total}ms`;
}
