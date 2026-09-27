// These tests fail on purpose, to show how failures look.
// Click "Show Error Details" / "Show Source Code" on their rows, then try "Run Failed".
describe('Failure display', () => {
    it('fails an assertion on purpose', () => {
        expect({ status: 'ok', items: [1, 2] }).toEqual({ status: 'ok', items: [1, 2, 3] });
    });

    it('throws on purpose', () => {
        JSON.parse('{ not json }');
    });
});
