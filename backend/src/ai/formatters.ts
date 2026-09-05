/* Response formatters for AI agent natural language responses */

export function formatPrice(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatRecommendationMessage(recs: any[], upsell: any | null, crossSells: any[], budget?: number): string {
  if (recs.length === 0) return 'I could not find any products matching your request. Could you try being more specific?';

  let msg = '';
  const top = recs[0];
  msg += `I recommend ${top.product_name} for ${formatPrice(top.price)}.`;
  if (top.reason) msg += ` ${top.reason}`;

  // Check if cross-sell would exceed budget
  if (crossSells && crossSells.length > 0 && budget) {
    const affordable = crossSells.filter(cs => cs.price <= budget);
    const unaffordable = crossSells.filter(cs => cs.price > budget);
    if (affordable.length > 0) {
      msg += `\n\nI also found a great match: ${affordable.map(c => `${c.product_name} (${formatPrice(c.price)})`).join(', ')}.`;
    }
    if (unaffordable.length > 0) {
      msg += `\n\n${unaffordable.map(u => `The ${u.product_name} (${formatPrice(u.price)}) is available but would exceed your budget.`).join(' ')}`;
    }
  }


  return msg;
}

export function formatBundleMessage(items: any[], total: number, budget?: number): string {
  const names = items.map(i => i.product_name).join(' + ');
  let msg = `I recommend the bundle: ${names} for a total of ${formatPrice(total)}.`;
  if (budget && total <= budget) msg += ` This fits within your budget of ${formatPrice(budget)}.`;
  if (budget && total > budget) msg += ` ⚠️ This exceeds your budget of ${formatPrice(budget)}.`;
  return msg;
}

export function formatOutOfStockMessage(productName: string, alternatives: any[]): string {
  let msg = `⚠️ "${productName}" is currently unavailable (out of stock).`;
  if (alternatives.length > 0) {
    msg += `\n\nI found ${alternatives.length} similar alternatives within your budget. Would you like to see them?`;
  }
  return msg;
}

export function formatApprovalMessage(total: number, currency: string = 'INR'): string {
  return `Your final total is ${formatPrice(total)}. I will not place the order until you approve the payment.`;
}

export function formatPaymentSuccess(orderId: string, amount: number, aiRevenue: number): string {
  return `✅ Payment verified\n✅ Order created (#${orderId})\n✅ Inventory updated\n💰 AI-assisted revenue: ${formatPrice(aiRevenue)}`;
}

export function formatPaymentFailure(reason: string): string {
  return `❌ Payment was unsuccessful.\n\n${reason}\n\nNo order was created. Would you like to try again or choose a different product?`;
}

