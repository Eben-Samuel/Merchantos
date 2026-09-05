/* MERCHANTOS AI — Merchant Policies / Guardrails */
export interface PolicyData {
  key: string;
  value: string;
  description: string;
  category: 'green' | 'yellow' | 'red';
}

export const defaultPolicies: PolicyData[] = [
  { key: 'max_transaction_amount', value: '500000', description: 'Maximum transaction amount per order (₹5,00,000)', category: 'yellow' },
  { key: 'auto_purchase', value: 'false', description: 'Auto-purchase is DISABLED — customer approval always required', category: 'red' },
  { key: 'max_discount_percent', value: '15', description: 'Maximum discount the AI can apply (15%)', category: 'yellow' },
  { key: 'human_approval_required', value: 'true', description: 'All payment orders require explicit human approval', category: 'red' },
  { key: 'out_of_stock_blocked', value: 'true', description: 'Out-of-stock purchases are BLOCKED', category: 'green' },
  { key: 'price_modification_blocked', value: 'true', description: 'Price modification is BLOCKED unless merchant rule permits', category: 'red' },
  { key: 'refund_requires_merchant', value: 'true', description: 'Refunds require merchant approval', category: 'red' },
  { key: 'max_upsell_multiplier', value: '1.5', description: 'Upsell recommendations capped at 1.5x original price', category: 'yellow' },
  { key: 'max_cross_sell_items', value: '2', description: 'Maximum cross-sell items per recommendation', category: 'green' },
  { key: 'allow_out_of_stock_search', value: 'true', description: 'Show out-of-stock items in search results (with warning)', category: 'green' },
  { key: 'duplicate_order_protection', value: 'true', description: 'Duplicate order/order creation is prevented via idempotency', category: 'green' },
  { key: 'webhook_signature_verification', value: 'true', description: 'All webhooks validated via HMAC signature', category: 'green' },
  { key: 'require_customer_approval', value: 'true', description: 'All transactions require explicit customer approval', category: 'red' },
  { key: 'max_daily_transactions', value: '1000', description: 'Maximum transactions per day', category: 'yellow' },
  { key: 'ai_cannot_modify_prices', value: 'true', description: 'AI agents cannot modify product prices', category: 'red' },
];
