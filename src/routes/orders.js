const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { items, shippingAddress } = req.body || {};
  if (!Array.isArray(items) || items.length === 0 || !shippingAddress) {
    return res.status(400).json({ message: 'Order items and a shipping address are required.' });
  }
  const quantities = new Map();
  for (const item of items) {
    const id = item?.productId;
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      return res.status(400).json({ message: 'Each item needs a valid productId and quantity from 1 to 99.' });
    }
    quantities.set(id, (quantities.get(id) || 0) + item.quantity);
  }

  const products = await Product.find({ _id: { $in: [...quantities.keys()] }, active: true });
  if (products.length !== quantities.size) return res.status(400).json({ message: 'One or more products are unavailable.' });

  const orderItems = products.map((product) => ({
    product: product._id,
    name: product.name,
    image: product.images[0] || '',
    unitPrice: product.price,
    quantity: quantities.get(product.id),
  }));
  const reserved = [];
  for (const item of orderItems) {
    const result = await Product.updateOne(
      { _id: item.product, active: true, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } }
    );
    if (result.modifiedCount !== 1) {
      await Promise.all(reserved.map(({ product, quantity }) => Product.updateOne({ _id: product }, { $inc: { stock: quantity } })));
      return res.status(409).json({ message: 'Insufficient stock for one or more products.' });
    }
    reserved.push({ product: item.product, quantity: item.quantity });
  }

  try {
    const total = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const order = await Order.create({ user: req.user._id, items: orderItems, shippingAddress, total });
    return res.status(201).json({ order });
  } catch (error) {
    await Promise.all(reserved.map(({ product, quantity }) => Product.updateOne({ _id: product }, { $inc: { stock: quantity } })));
    throw error;
  }
});

router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.all === 'true' ? {} : { user: req.user._id };
  const orders = await Order.find(filter).sort({ createdAt: -1 }).populate('user', 'name email');
  return res.json({ orders });
});

router.get('/:id', async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (req.user.role !== 'admin' && order.user.id !== req.user.id) {
    return res.status(403).json({ message: 'You cannot view this order.' });
  }
  return res.json({ order });
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}.` });
  }
  const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  return res.json({ order });
});

module.exports = router;