const delay = (ms, value) => new Promise(resolve => setTimeout(() => resolve(value), ms));

describe('Async tests', () => {
    it('awaits a promise', async () => {
        expect(await delay(100, 42)).toBe(42);
    });

    it('uses resolves / rejects', async () => {
        await expect(delay(10, 'ok')).resolves.toBe('ok');
        await expect(Promise.reject(new Error('nope'))).rejects.toThrow('nope');
    });

    it('calls done when finished', (done) => {
        setTimeout(() => {
            expect(1).toBe(1);
            done();
        }, 50);
    });

    // The third argument overrides the default timeout (defaultTimeout / jest.setTimeout).
    it('gets a longer timeout', async () => {
        await delay(1500);
    }, 3000);
});
