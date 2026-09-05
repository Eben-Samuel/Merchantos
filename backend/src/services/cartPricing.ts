/** Bundle pricing engine — 5% OFF + FREE shipping when 2+ distinct items are in the cart. */
export const BUNDLE_DISCOUNT_PCT = 5;
export const SHIPPING_FEE = 49;
export const FREE_SHIPPING_THRESHOLD = 499;

export interface CartPricing {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  bundle_eligible: boolean;
  savings_pct: number;
  distinct_items: number;
}

export function computeCartPricing(cart: Array<{ product_id: string; quantity: number; price: number }>): CartPricing {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const distinctItems = new Set(cart.map((i) => i.product_id)).size;
  const bundleEligible = distinctItems >= 2 && subtotal > 0;
  const discount = bundleEligible ? Math.round((subtotal * BUNDLE_DISCOUNT_PCT) / 100) : 0;
  const shipping = bundleEligible || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : subtotal > 0 ? SHIPPING_FEE : 0;
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    bundle_eligible: bundleEligible,
    savings_pct: BUNDLE_DISCOUNT_PCT,
    distinct_items: distinctItems,
  };
}
