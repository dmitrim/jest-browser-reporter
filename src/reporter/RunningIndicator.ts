import { escapeHtml } from '../utils/dom';

/** Banner above the results: idle hint, run progress, or an error. */
export class RunningIndicator {
    private statusText: HTMLElement | null = null;
    private progressBar: HTMLElement | null = null;
    private progressText: HTMLElement | null = null;
    private mainText: HTMLElement | null = null;
    private estimateText: HTMLElement | null = null;

    constructor(private readonly element: HTMLElement) { }

    /** A hint without a spinner, shown while no run is in progress. */
    showIdle(message: string): void {
        this.render('idle', `<span class="running-text">${escapeHtml(message)}</span>`);
    }

    /** Spinner, message, progress bar and the current test. */
    showRunning(message: string): void {
        this.render('running', `
            <div class="running-spinner"></div>
            <div class="running-text">
                <div class="running-line">
                    <span class="running-main-text">${escapeHtml(message)}</span>
                    <span class="running-progress-text"></span>
                    <span class="running-estimate"></span>
                </div>
                <div class="running-progress"><div class="running-progress-bar"></div></div>
                <span class="running-status-text"></span>
            </div>
        `);
        this.mainText = this.element.querySelector('.running-main-text');
        this.statusText = this.element.querySelector('.running-status-text');
        this.progressBar = this.element.querySelector('.running-progress-bar');
        this.progressText = this.element.querySelector('.running-progress-text');
        this.estimateText = this.element.querySelector('.running-estimate');
    }

    /** Estimated time left, e.g. "≈ 2min left"; empty to hide it. */
    setEstimate(text: string): void {
        if (this.estimateText) this.estimateText.textContent = text;
    }

    setMessage(message: string): void {
        if (this.mainText) this.mainText.textContent = message;
    }

    /** The secondary line, e.g. the name of the current test. */
    setStatus(status: string): void {
        if (this.statusText) this.statusText.textContent = status;
    }

    setProgress(done: number, total: number): void {
        if (!this.progressBar || !this.progressText) return;
        this.progressText.textContent = total ? `${done} / ${total}` : '';
        this.progressBar.style.width = total ? `${Math.min(100, (done / total) * 100)}%` : '0';
    }

    showError(message: string): void {
        this.render('error', `
            <span class="error-icon">⚠</span>
            <span class="running-text">${escapeHtml(message)}</span>
        `);
    }

    hide(): void {
        this.element.classList.add('hidden');
        this.mainText = this.statusText = this.progressBar = this.progressText = this.estimateText = null;
    }

    private render(mode: 'idle' | 'running' | 'error', html: string): void {
        this.element.className = `running-indicator ${mode}`;
        this.element.innerHTML = html;
        this.mainText = this.statusText = this.progressBar = this.progressText = this.estimateText = null;
    }
}
