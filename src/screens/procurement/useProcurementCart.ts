import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';

export interface Product { id: number; name: string; spec: string; price: number; supplier: string; note?: string; }
export interface CartItem { product: Product; quantity: number; subtotal: number; }

export function useProcurementCart(products: Product[]) {
  const [cart, setCart] = useState<Record<number, number>>({});

  // Load shared cart from server on mount
  useEffect(() => {
    api.getCart().then((data: any) => {
      if (Array.isArray(data)) {
        const map: Record<number, number> = {};
        data.forEach((item: any) => { map[item.product_id] = item.quantity; });
        setCart(map);
      }
    }).catch(() => {});
  }, []);

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([pid, qty]) => {
        const product = products.find(p => p.id === Number(pid));
        if (!product) return null;
        return { product, quantity: qty, subtotal: product.price * qty };
      }).filter(Boolean) as CartItem[];
  }, [cart, products]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.subtotal, 0), [cartItems]);
  const cartCount = cartItems.length;

  const updateQty = (pid: number, delta: number) => {
    setCart(prev => {
      const newQty = Math.max(0, (prev[pid] || 0) + delta);
      if (newQty === 0) {
        api.removeFromCart(pid).catch(() => {});
        const next = { ...prev };
        delete next[pid];
        return next;
      }
      api.addToCart(pid, newQty).catch(() => {});
      return { ...prev, [pid]: newQty };
    });
  };

  const clearCart = () => {
    setCart({});
    api.clearCart().catch(() => {});
  };

  return { cart, setCart, cartItems, cartTotal, cartCount, updateQty, clearCart };
}
