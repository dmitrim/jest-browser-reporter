describe('Hooks', () => {
    const log = [];
    let db;

    beforeAll(async () => {
        // Async hooks are awaited before the tests start.
        db = await Promise.resolve(new Map());
        log.push('beforeAll');
    });

    beforeEach(() => {
        db.set('user', { name: 'Ann' });
        log.push('beforeEach');
    });

    afterEach(() => {
        db.clear();
        log.push('afterEach');
    });

    afterAll(() => {
        console.log('Hook order:', log.join(' → '));
    });

    it('sees the data prepared by beforeEach', () => {
        expect(db.get('user')).toEqual({ name: 'Ann' });
        db.delete('user');
    });

    it('gets fresh data again', () => {
        expect(db.has('user')).toBe(true);
    });

    describe('nested describe', () => {
        beforeEach(() => db.set('role', 'admin'));

        it('runs the outer beforeEach first, then its own', () => {
            expect([...db.keys()]).toEqual(['user', 'role']);
        });
    });
});
