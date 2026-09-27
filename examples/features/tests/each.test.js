describe('Parameterized tests', () => {
    // Array rows are spread into the arguments; %i, %s, %j, %# … fill the name.
    it.each([
        [1, 1, 2],
        [2, 3, 5],
        [10, -4, 6],
    ])('%i + %i = %i', (a, b, sum) => {
        expect(a + b).toBe(sum);
    });

    // Object rows are passed as one argument; $property fills the name.
    it.each([
        { input: 'hello', length: 5 },
        { input: '', length: 0 },
    ])('"$input" has length $length', ({ input, length }) => {
        expect(input).toHaveLength(length);
    });

    describe.each([['Map'], ['Set']])('%s', (type) => {
        it('is a constructor', () => {
            expect(typeof globalThis[type]).toBe('function');
        });
    });
});
