export interface CartItem {
    name: string;
    price: number;
    quantity: number;
}

export type PriceListener = (total: number) => void;

export class Cart {
    private readonly items: CartItem[] = [];

    constructor(private readonly onChange?: PriceListener) { }

    add(item: CartItem): void {
        if (item.quantity <= 0) throw new RangeError('Quantity must be positive');
        this.items.push(item);
        this.onChange?.(this.total);
    }

    get total(): number {
        return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }
}
