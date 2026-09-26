describe('Math', () => {
    it('adds numbers', () => {
        expect(1 + 2).toBe(3);
    });

    it('compares floating point numbers', () => {
        expect(0.1 + 0.2).toBeCloseTo(0.3);
    });

    it('works with objects', () => {
        expect({ x: 1, y: { z: 2 } }).toEqual({ x: 1, y: { z: 2 } });
    });
});
