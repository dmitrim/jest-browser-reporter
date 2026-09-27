describe('DOM', function () {
    it('creates elements', function () {
        var div = document.createElement('div');
        div.textContent = 'hello';
        expect(div.outerHTML).toBe('<div>hello</div>');
    });

    it('finds the reporter container', function () {
        expect(document.getElementById('app')).not.toBeNull();
    });
});

describe('JSON', function () {
    it('round-trips an object', function () {
        var data = { list: [1, 2, 3], nested: { ok: true } };
        expect(JSON.parse(JSON.stringify(data))).toEqual(data);
    });
});
