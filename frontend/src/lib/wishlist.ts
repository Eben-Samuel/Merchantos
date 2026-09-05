/** Wishlist helpers — persisted in localStorage, synced across components via a custom event. */
const KEY = 'merchantos_wishlist';

export interface WishItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
}

export function getWishlist(): WishItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function isWishlisted(id: string): boolean {
  return getWishlist().some((w) => w.id === id);
}

/** Toggle an item; returns the new state (true = now wishlisted). */
export function toggleWishlist(item: WishItem): boolean {
  const list = getWishlist();
  const exists = list.some((w) => w.id === item.id);
  const next = exists ? list.filter((w) => w.id !== item.id) : [...list, item];
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('merchantos:wishlist'));
  return !exists;
}

export function removeFromWishlist(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getWishlist().filter((w) => w.id !== id)));
  window.dispatchEvent(new CustomEvent('merchantos:wishlist'));
}
