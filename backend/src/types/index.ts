// Shared types for MERCHANTOS AI backend

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  discount_percent: number;
  stock: number;
  attributes: Record<string, string>;
  variants: ProductVariant[];
  tags: string;
  compatible_products: string; // comma-separated product IDs
  frequently_bought_together: string; // comma-separated product IDs
  target_use_cases: string;
  customer_segments: string;
  merchant_rule_json: string;
  ai_readiness_score: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  variant_id: string;
  name: string;
  price_modifier: number;
  stock: number;
}

export interface CartItem {
  product_id: string;
  quantity: number;
  price_at_add: number;
  variant_id?: string;
}

export interface Cart {
  session_id: string;
  items: CartItem[];
  total: number;
  currency: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  variant_id?: string;
}

export interface Order {
  id: string;
  session_id: string;
  customer_name: string;
  total_amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface AuditEvent {
  id: string;
  order_id?: string;
  session_id: string;
  actor: 'ai' | 'customer' | 'merchant' | 'system';
  action: string;
  reason: string;
  status: 'success' | 'failed' | 'pending' | 'blocked';
  details_json: string;
  timestamp: string;
}

export interface Policy {
  id: string;
  key: string;
  value: string;
  description: string;
  category: 'green' | 'yellow' | 'red';
}

export interface MerchantAnalytics {
  total_revenue: number;
  ai_assisted_revenue: number;
  ai_assisted_revenue_pct: number;
  upsell_revenue: number;
  cross_sell_revenue: number;
  average_order_value: number;
  conversion_rate: number;
  total_orders: number;
  abandoned_carts: number;
  payment_success_rate: number;
  daily_revenue: Array<{ date: string; revenue: number; ai_revenue: number }>;
}

export interface IntentResult {
  category?: string;
  budget?: number;
  budget_currency?: string;
  recipient?: string;
  occasion?: string;
  color?: string;
  brand?: string;
  keywords: string[];
  confidence: number;
  use_cases: string[];
  /** Extracted product specs, e.g. { storage: "1tb", gpu: "dedicated" } */
  specs?: Record<string, string>;
}

export interface Recommendation {
  product_id: string;
  product_name: string;
  price: number;
  score: number;
  reason: string;
  type: 'primary' | 'upsell' | 'cross-sell' | 'bundle' | 'alternative';
  matched_attributes: string[];
  in_stock: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface PaymentInfo {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  mock?: boolean;
  mock_payment_id?: string;
  mock_signature?: string;
}

export interface ChatResponse {
  message: string;
  recommendations?: Recommendation[];
  upsell?: Recommendation | null;
  cross_sells?: Recommendation[];
  cart_total?: number;
  budget?: number;
  next_action?: string;
  requires_approval?: boolean;
  action_type?: 'payment' | 'upsell' | 'cross_sell' | 'bundle' | 'none';
  action_details?: Record<string, unknown>;
  payment?: PaymentInfo;
  bundle_offer?: { items: Recommendation[]; subtotal: number; discount: number; total: number; free_shipping: true };
}