describe('Modifiers', () => {
    it('runs normally', () => {
        expect(true).toBe(true);
    });

    // Reported as SKIP. `xit` and `xtest` are aliases.
    it.skip('is skipped', () => {
        throw new Error('never runs');
    });

    // A placeholder for a test to be written; reported as SKIP.
    it.todo('handles unicode file names');

    describe.skip('a skipped group', () => {
        it('is skipped with its group', () => { });
    });

    // it.only / describe.only (or fit / fdescribe) would run only the focused tests on the
    // page — handy while debugging, but don't commit them.
});
