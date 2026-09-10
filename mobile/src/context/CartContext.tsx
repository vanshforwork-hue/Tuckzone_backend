import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { DailyMenuItemResponse } from '../api/types';

export interface CartLine {
  dayItem: DailyMenuItemResponse;
  quantity: number;
}

export type AddToCartResult =
  | { status: 'added' }
  | { status: 'stock-limit'; remaining: number };

export interface CartDateGroup {
  date: string;
  lines: CartLine[];
  subtotal: number;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  total: number;
  /** Lines grouped by menu date, sorted ascending — checkout places one order per group. */
  groupedByDate: CartDateGroup[];
  addToCart: (dayItem: DailyMenuItemResponse) => AddToCartResult;
  /** Decrements by one, dropping the line when it reaches zero. */
  removeFromCart: (dayItem: DailyMenuItemResponse) => void;
  /** Sets an exact quantity (e.g. from typing into the quantity field) rather than
   *  stepping by one. Clamped to [0, remainingQuantity]; 0 removes the line. */
  setQuantity: (dayItem: DailyMenuItemResponse, quantity: number) => void;
  /** Removes the whole line regardless of quantity. */
  removeLine: (dayItem: DailyMenuItemResponse) => void;
  quantityOf: (dayItem: DailyMenuItemResponse) => number;
  /** Drops every line for one date — used after that date's order is placed. */
  clearDate: (date: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

// A line's real identity is (menuDate, dayItem.id): the same menu item recurs across
// different days with the SAME id (only menuDate varies — see MenuScreen.toFixedCartItem
// for Daily Delights specifically), so matching on id alone would merge two different
// days' baskets into one line.
function sameLine(a: DailyMenuItemResponse, b: DailyMenuItemResponse): boolean {
  return a.id === b.id && a.menuDate === b.menuDate;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addToCart = useCallback((dayItem: DailyMenuItemResponse): AddToCartResult => {
    // Computed from the current state before the updater runs, so the caller gets a result
    // it can act on synchronously. `lines` is in the dependency list to keep it current.
    const currentQty = lines.find((line) => sameLine(line.dayItem, dayItem))?.quantity ?? 0;
    // Never let the cart exceed what is actually left in stock — the backend would reject
    // the excess anyway, but catching it here gives instant feedback instead of a
    // checkout failure.
    if (currentQty >= dayItem.remainingQuantity) {
      return { status: 'stock-limit', remaining: dayItem.remainingQuantity };
    }

    setLines((prev) => {
      const existing = prev.find((line) => sameLine(line.dayItem, dayItem));
      if (existing) {
        return prev.map((line) =>
          sameLine(line.dayItem, dayItem) ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...prev, { dayItem, quantity: 1 }];
    });
    return { status: 'added' };
  }, [lines]);

  const removeFromCart = useCallback((dayItem: DailyMenuItemResponse) => {
    setLines((prev) =>
      prev
        .map((line) => (sameLine(line.dayItem, dayItem) ? { ...line, quantity: line.quantity - 1 } : line))
        .filter((line) => line.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((dayItem: DailyMenuItemResponse) => {
    setLines((prev) => prev.filter((line) => !sameLine(line.dayItem, dayItem)));
  }, []);

  const setQuantity = useCallback((dayItem: DailyMenuItemResponse, quantity: number) => {
    const clamped = Math.max(0, Math.min(quantity, dayItem.remainingQuantity));
    setLines((prev) => {
      if (clamped === 0) return prev.filter((line) => !sameLine(line.dayItem, dayItem));
      const existing = prev.find((line) => sameLine(line.dayItem, dayItem));
      if (existing) {
        return prev.map((line) =>
          sameLine(line.dayItem, dayItem) ? { ...line, quantity: clamped } : line,
        );
      }
      return [...prev, { dayItem, quantity: clamped }];
    });
  }, []);

  const quantityOf = useCallback(
    (dayItem: DailyMenuItemResponse) => lines.find((line) => sameLine(line.dayItem, dayItem))?.quantity ?? 0,
    [lines],
  );

  const clearDate = useCallback((date: string) => {
    setLines((prev) => prev.filter((line) => line.dayItem.menuDate !== date));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const total = lines.reduce((sum, line) => sum + line.dayItem.menuItem.price * line.quantity, 0);

    const byDate = new Map<string, CartLine[]>();
    for (const line of lines) {
      const key = line.dayItem.menuDate;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(line);
    }
    const groupedByDate: CartDateGroup[] = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dateLines]) => ({
        date,
        lines: dateLines,
        subtotal: dateLines.reduce((s, l) => s + l.dayItem.menuItem.price * l.quantity, 0),
      }));

    return {
      lines,
      itemCount,
      total,
      groupedByDate,
      addToCart,
      removeFromCart,
      removeLine,
      setQuantity,
      quantityOf,
      clearDate,
      clearCart,
    };
  }, [lines, addToCart, removeFromCart, removeLine, setQuantity, quantityOf, clearDate, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
