// ?delay=<ms> slows every test down, to observe a run in progress.
const delayMs = Number(new URLSearchParams(location.search).get('delay') || 0);
const wait = () => new Promise(resolve => setTimeout(resolve, delayMs));

describe('Math', () => {
    it('adds', async () => {
        await wait();
        expect(1 + 1).toBe(2);
    });

    it('fails', async () => {
        await wait();
        expect(1).toBe(2);
    });

    it.skip('skipped', () => { });
});

describe('Slow', () => {
    for (let i = 1; i <= 5; i++) {
        it(`step ${i}`, wait);
    }
});
