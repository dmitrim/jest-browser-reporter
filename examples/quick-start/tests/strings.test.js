describe('Strings', () => {
    it('matches a pattern', () => {
        expect('jest-browser-reporter').toMatch(/browser/);
    });

    it('waits for async work', async () => {
        const value = await new Promise(resolve => setTimeout(() => resolve('done'), 50));
        expect(value).toBe('done');
    });
});
