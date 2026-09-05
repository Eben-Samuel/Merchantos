import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { sessionStore } from '../store/sessionStore';
import { catalogAgent } from '../ai/catalogSearch';

const router = Router();

/** GET /api/cart/:sessionId — Get cart contents */
router.get('/:sessionId', asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const items = await Promise.all(session.cart.map(async (item) => {
    const product = await catalogAgent.getProduct(item.product_id);
    return { ...item, product_name: product?.name || 'Unknown', product: product };
  }));
  res.json({ items, total: session.cartTotal, session_id: req.params.sessionId });
}));

/** POST /api/cart/:sessionId/add — Add item to cart */
router.post('/:sessionId/add', asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;
  const session = sessionStore.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const product = await catalogAgent.getProduct(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock <= 0) return res.status(400).json({ error: 'Product out of stock' });
  session.cart.push({ product_id, quantity: quantity || 1, price: Math.round(product.price * (1 - (product.discount_percent || 0) / 100)) });
  session.cartTotal = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  res.json({ items: session.cart, total: session.cartTotal });
}));

/** POST /api/cart/:sessionId/remove — Remove item from cart */
router.post('/:sessionId/remove', asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  const session = sessionStore.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.cart = session.cart.filter(i => i.product_id !== product_id);
  session.cartTotal = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  res.json({ items: session.cart, total: session.cartTotal });
}));

/** POST /api/cart/:sessionId/clear — Clear cart */
router.post('/:sessionId/clear', asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.cart = []; session.cartTotal = 0; session.approvalState = 'none';
  res.json({ items: [], total: 0, message: 'Cart cleared' });
}));

export default router;
