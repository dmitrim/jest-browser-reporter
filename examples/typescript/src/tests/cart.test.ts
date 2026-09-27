import { Cart, type CartItem, type PriceListener } from '../cart';

describe('Cart', () => {
    let cart: Cart;

    beforeEach(() => {
        cart = new Cart();
    });

    it('starts empty', () => {
        expect(cart.total).toBe(0);
    });

    it.each<[CartItem, number]>([
        [{ name: 'pen', price: 2, quantity: 3 }, 6],
        [{ name: 'book', price: 15, quantity: 1 }, 15],
    ])('totals %j as %d', (item, total) => {
        cart.add(item);
        expect(cart.total).toBe(total);
    });

    it('rejects a non-positive quantity', () => {
        expect(() => cart.add({ name: 'pen', price: 2, quantity: 0 })).toThrow(RangeError);
    });

    it('notifies about price changes', () => {
        const listener = jest.fn<PriceListener>();
        const observed = new Cart(listener);

        observed.add({ name: 'pen', price: 2, quantity: 1 });

        expect(listener).toHaveBeenCalledWith(2);
        expect(listener.mock.calls).toEqual([[2]]);
    });
});
