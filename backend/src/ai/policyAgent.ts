import { getDb } from '../config/database';
import { generateId, now } from '../utils/helpers';

export type ActionCategory = 'green' | 'yellow' | 'red';

export interface PolicyCheckResult {
  allowed: boolean;
  requires_approval: boolean;
  category: ActionCategory;
  reason: string;
  policy_key: string;
}

/**
 * PolicyAgent — "AI Commerce Guard"
 * Checks every financial action against merchant-defined policies.
 * GREEN = automatically allowed, YELLOW = requires approval, RED = never autonomous.
 */
export class PolicyAgent {
  private cachedPolicies: Record<string, string> = {};
  private async loadPolicies(): Promise<Record<string, string>> {
    if (Object.keys(this.cachedPolicies).length > 0) return this.cachedPolicies;
    const db = await getDb();
    const rows = await db.all('SELECT key, value FROM policies');
    this.cachedPolicies = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return this.cachedPolicies;
  }

  async checkAction(action: string, amount?: number): Promise<PolicyCheckResult> {
    const policies = await this.loadPolicies();

    // Transaction amount check
    if (amount !== undefined && amount > 0) {
      const maxAmount = parseFloat(policies['max_transaction_amount'] || '500000');
      if (amount > maxAmount) {
        return { allowed: false, requires_approval: true, category: 'red', reason: `Amount ₹${amount} exceeds maximum transaction limit of ₹${maxAmount}`, policy_key: 'max_transaction_amount' };
      }
    }

    // Auto-purchase check
    const autoPurchase = policies['auto_purchase'] === 'true';
    const humanApproval = policies['human_approval_required'] === 'true';

    // RED zone actions (never autonomous)
    if (action === 'create_payment_order' || action === 'apply_discount' || action === 'process_payment') {
      if (!autoPurchase && humanApproval) {
        return { allowed: true, requires_approval: true, category: action === 'apply_discount' ? 'yellow' : 'red', reason: `Requires explicit customer approval (human_approval_required=true)`, policy_key: 'human_approval_required' };
      }
      if (!autoPurchase) {
        return { allowed: true, requires_approval: true, category: 'red', reason: 'Auto-purchase is disabled — approval required', policy_key: 'auto_purchase' };
      }
    }

    // Discount check
    if (action === 'apply_discount') {
      const maxDiscount = parseFloat(policies['max_discount_percent'] || '15');
      return { allowed: true, requires_approval: true, category: 'yellow', reason: `Discount must not exceed ${maxDiscount}%`, policy_key: 'max_discount_percent' };
    }

    // GREEN zone — safe, bounded actions
    const greenActions = ['search_products', 'compare_products', 'calculate_cart', 'generate_recommendations', 'check_inventory', 'create_audit_event', 'update_session', 'read_catalog'];
    if (greenActions.includes(action)) {
      return { allowed: true, requires_approval: false, category: 'green', reason: 'Automatically allowed — safe, read-only action', policy_key: 'safety' };
    }

    // Default: yellow — requires approval
    return { allowed: true, requires_approval: true, category: 'yellow', reason: 'Requires approval — not in green or red category', policy_key: 'default' };
  }

  async getPolicies(): Promise<any[]> {
    const db = await getDb();
    return db.all(`SELECT key, value, description, category FROM policies ORDER BY category, key`);
  }

  async getSafetyStatus(): Promise<any> {
    const policies = await this.loadPolicies();
    return {
      max_transaction: policies.max_transaction_amount || '500000',
      auto_payment: policies.auto_purchase || 'false',
      human_approval: policies.human_approval_required || 'true',
      discount_limit: `${policies.max_discount_percent || '15'}%`,
      out_of_stock_blocked: policies.out_of_stock_blocked || 'true',
      price_modification: policies.price_modification_blocked || 'true',
      refund_requires_merchant: policies.refund_requires_merchant || 'true',
      duplicate_protection: policies.duplicate_order_protection || 'true',
      webhook_verification: policies.webhook_signature_verification || 'true',
    };
  }
}

export const policyAgent = new PolicyAgent();
