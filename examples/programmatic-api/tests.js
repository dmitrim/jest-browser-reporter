const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Math', () => {
    it('adds', () => expect(2 + 2).toBe(4));
    it('multiplies', () => expect(3 * 4).toBe(12));

    describe('Rounding', () => {
        it('rounds half up', () => expect(Math.round(2.5)).toBe(3));
        it('fails randomly', () => expect(Math.random()).toBeLessThan(0.5));
    });
});

describe('Slow suite', () => {
    for (let i = 1; i <= 6; i++) {
        it(`slow step ${i}`, () => delay(400));
    }
});
