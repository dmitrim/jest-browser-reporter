describe('Browser APIs', () => {
    it('has TextEncoder', () => {
        expect(new TextEncoder().encode('hi')).toEqual(new Uint8Array([104, 105]));
    });

    it('has crypto.randomUUID', () => {
        expect(crypto.randomUUID()).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('draws on a canvas', () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 1, 1);
        expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([255, 0, 0, 255]);
    });
});
