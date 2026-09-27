function fetchUser(api, id) {
    return api.get(`/users/${id}`).then(response => response.name);
}

describe('Mocks', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('records calls of jest.fn()', () => {
        const onClick = jest.fn();
        onClick('left');
        onClick('right');

        expect(onClick).toHaveBeenCalledTimes(2);
        expect(onClick).toHaveBeenLastCalledWith('right');
        expect(onClick.mock.calls).toEqual([['left'], ['right']]);
    });

    it('stubs results', async () => {
        const api = { get: jest.fn().mockResolvedValue({ name: 'Ann' }) };

        await expect(fetchUser(api, 7)).resolves.toBe('Ann');
        expect(api.get).toHaveBeenCalledWith('/users/7');
    });

    it('spies on an existing method and restores it', () => {
        const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

        expect(Math.random()).toBe(0.5);
        expect(spy).toHaveBeenCalled();
        // afterEach calls jest.restoreAllMocks(), which puts Math.random back.
    });

    it('matches loosely with asymmetric matchers', () => {
        const track = jest.fn();
        track({ id: 42, at: Date.now(), tags: ['a', 'b'] });

        expect(track).toHaveBeenCalledWith({
            id: expect.any(Number),
            at: expect.anything(),
            tags: expect.arrayContaining(['b']),
        });
    });
});
