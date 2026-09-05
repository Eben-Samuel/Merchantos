import { generateId, now } from '../utils/helpers';
import { seededProducts } from './seed';

/** Seed demo orders, sessions, intent trends, audit events, and abandoned carts. */
export async function seedDemoTransactions(db: any) {
  // Realistic customer names (no more "Demo Customer")
  const CUSTOMER_NAMES = [
    'Aarav Sharma', 'Priya Nair', 'Rohan Mehta', 'Sneha Iyer', 'Vikram Singh',
    'Ananya Rao', 'Karan Patel', 'Divya Menon', 'Arjun Reddy', 'Neha Gupta',
    'Siddharth Joshi', 'Pooja Desai', 'Rahul Verma', 'Ishita Bose', 'Manish Kumar',
  ];
  const productName = (pid: string) => seededProducts.find((p) => p.id === pid)?.name || pid.replace('p_', '').replace(/_/g, ' ');
  const daysAgoISO = (d: number) => new Date(Date.now() - Math.abs(d) * 86400000).toISOString();
  for (let i = 1; i <= 20; i++) {
    await db.run(`INSERT OR IGNORE INTO sessions (id, customer_id, started_at, last_active) VALUES (?, ?, ?, ?)`,
      `sess_${1000 + i}`, `cust_${1000 + i}`, now(), now());
  }

  const intents = [
    'I need a laptop for college under 80000','Formal shirt for office under 2000','Best gaming laptop',
    'Birthday gift for sister under 3000','Black formal shirt for interview','Laptop bag for 15 inch laptop',
    'Wireless mouse for office','Formal trousers for presentation','White t-shirt under 500',
    'Phone under 30000','Gaming headset for streaming','Coffee mug for office desk',
  ];
  for (let i = 0; i < intents.length; i++) {
    await db.run(`INSERT INTO intent_trends (id, query, parsed_intent, category, budget, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      generateId('it'), intents[i], JSON.stringify({ keywords: intents[i].split(' ') }), 'Electronics', 50000, now());
  }

  const demoOrders = [
    { id:'ORD-24201', total:3197, items:['p_shirt_01','p_trouser_01','p_belt_01'], ai:1, cross:1, date:'-14 days' },
    { id:'ORD-24202', total:74999, items:['p_laptop_01'], ai:1, cross:1, date:'-12 days' },
    { id:'ORD-24203', total:699, items:['p_book_03'], ai:0, cross:0, date:'-10 days' },
    { id:'ORD-24204', total:3299, items:['p_bag_02'], ai:1, cross:0, date:'-8 days' },
    { id:'ORD-24205', total:2499, items:['p_keyboard_01','p_mouse_01'], ai:1, cross:1, date:'-7 days' },
    { id:'ORD-24206', total:299, items:['p_mug_01','p_tea_01'], ai:1, cross:1, date:'-6 days' },
    { id:'ORD-24207', total:109999, items:['p_laptop_02','p_laptop_bag_01','p_headset_01'], ai:1, cross:1, date:'-5 days' },
    { id:'ORD-24208', total:399, items:['p_cover_01'], ai:0, cross:0, date:'-5 days' },
    { id:'ORD-24209', total:599, items:['p_tie_01'], ai:1, cross:0, date:'-4 days' },
    { id:'ORD-24210', total:94999, items:['p_laptop_03','p_laptop_bag_02'], ai:1, cross:1, date:'-3 days' },
    { id:'ORD-24211', total:1199, items:['p_jeans_01','p_tshirt_01'], ai:1, cross:1, date:'-3 days' },
    { id:'ORD-24212', total:1899, items:['p_earbuds_pro'], ai:0, cross:0, date:'-2 days' },
    { id:'ORD-24213', total:349, items:['p_belt_02'], ai:1, cross:0, date:'-2 days' },
    { id:'ORD-24214', total:74999, items:['p_phone_01','p_cover_02','p_headset_02'], ai:1, cross:1, date:'-1 day' },
    { id:'ORD-24215', total:1899, items:['p_laptop_bag_03','p_mouse_01','p_mousepad_01'], ai:1, cross:1, date:'-1 day' },
  ];
  for (const [oi, od] of demoOrders.entries()) {
    const customer = CUSTOMER_NAMES[oi % CUSTOMER_NAMES.length];
    const created = daysAgoISO(parseInt(od.date, 10) || oi);
    await db.run(`INSERT OR IGNORE INTO orders (id,session_id,customer_name,total_amount,currency,status,razorpay_order_id,razorpay_payment_id,is_ai_assisted,upsell_applied,cross_sell_applied,ai_confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      od.id, `sess_${1000 + (oi % 20) + 1}`, customer, od.total, 'INR', 'paid', `rp_${od.id}`, `pay_${od.id}`, od.ai, 0, od.cross, 0.89, created, created);
    for (const pid of od.items) {
      await db.run(`INSERT INTO order_items (id,order_id,product_id,product_name,quantity,price,variant_id,item_type) VALUES(?,?,?,?,?,?,?,?)`,
        generateId('oi'), od.id, pid, productName(pid), 1, Math.round(od.total/od.items.length), null, 'primary');
    }
    await db.run(`INSERT INTO payments (id,order_id,razorpay_payment_id,amount,currency,status,method,verified_at) VALUES(?,?,?,?,?,?,?,?)`,
      generateId('pay'), od.id, `pay_${od.id}`, od.total, 'INR', 'captured', 'card', now());
    await db.run(`INSERT INTO revenue_events (id,order_id,amount,revenue_type,created_at) VALUES(?,?,?,?,?)`,
      generateId('rev'), od.id, od.total, od.ai ? 'ai_assisted' : 'organic', now());
  }

  const auditEvents = [
    { sid:'sess_1001', actor:'ai', action:'intent_detected', reason:'budget=3000, category=Clothing', status:'success' },
    { sid:'sess_1001', actor:'ai', action:'catalog_searched', reason:'Search for formal shirts', status:'success' },
    { sid:'sess_1001', actor:'ai', action:'recommendations_generated', reason:'5 recommendations ranked', status:'success' },
    { sid:'sess_1001', actor:'customer', action:'payment_approved', reason:'Customer approved ₹3,197', status:'success' },
    { sid:'sess_1001', actor:'system', action:'payment_verified', reason:'Signature verified', status:'success' },
    { sid:'sess_1001', actor:'ai', action:'order_created', reason:'Order #ORD-24201', status:'success' },
    { sid:'sess_1001', actor:'system', action:'inventory_updated', reason:'Stock updated', status:'success' },
    { sid:'sess_1007', actor:'ai', action:'payment_verification_failed', reason:'Invalid signature', status:'failed' },
    { sid:'sess_1007', actor:'ai', action:'order_creation_failed', reason:'Payment failed', status:'failed' },
  ];
  for (const ae of auditEvents) {
    await db.run(`INSERT INTO audit_events (id,order_id,session_id,actor,action,reason,status,details_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
      generateId('evt'), ae.sid === 'sess_1001' ? 'ORD-24201' : null, ae.sid, ae.actor, ae.action, ae.reason, ae.status, '{}', now());
  }

  const abCarts = [
    { items:'["p_laptop_01","p_laptop_bag_01"]', total:76498, reason:'price_concern' },
    { items:'["p_laptop_03"]', total:94999, reason:'product_uncertainty' },
    { items:'["p_headset_02"]', total:3399, reason:'checkout_friction' },
  ];
  for (const ac of abCarts) {
    await db.run(`INSERT INTO abandoned_carts (id,session_id,items_json,total,reason,created_at,recovery_sent) VALUES(?,?,?,?,?,?,?)`,
      generateId('ac'), 'sess_1001', ac.items, ac.total, ac.reason, now(), 0);
  }
  // Store total orders count on db for analytics
  console.log('[DEMO] Seeded demo transactions');
}
