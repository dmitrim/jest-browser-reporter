/** The parts of the Navigation API `navigate` event used here. */
interface NavigateEvent extends Event {
    readonly cancelable: boolean;
    readonly userInitiated: boolean;
    readonly hashChange: boolean;
    readonly downloadRequest: string | null;
    readonly destination: { readonly url: string; readonly sameDocument: boolean };
}

/**
 * Cancels navigations started by page scripts — `location.href = …`, `location.reload()`, a
 * `location` assigned an object — and reports their URL. Downloads, same-document navigations and
 * navigations started by the user (back button, address bar, reload) are left alone.
 *
 * Needs the Navigation API (Chromium 102+, recent Firefox and Safari); elsewhere it does nothing.
 * @returns A function that removes the guard.
 */
export function guardNavigation(onBlocked: (url: string) => void): () => void {
    const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
    if (!navigation?.addEventListener) return () => undefined;

    const listener = (event: Event) => {
        const e = event as NavigateEvent;
        if (e.userInitiated || !e.cancelable || e.hashChange || e.downloadRequest !== null || e.destination?.sameDocument) return;
        e.preventDefault();
        onBlocked(e.destination?.url ?? '');
    };
    navigation.addEventListener('navigate', listener);
    return () => navigation.removeEventListener('navigate', listener);
}
