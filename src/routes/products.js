const express = require('express');
const Product = require('../models/Product');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const writableFields = ['name', 'slug', 'brand', 'description', 'price', 'category', 'images', 'stock', 'featured', 'active'];

function productInput(body, partial = false) {
  const input = {};
  for (const field of writableFields) {
    if (Object.hasOwn(body, field)) input[field] = body[field];
  }
  if (!partial && ['name', 'brand', 'description', 'price', 'category'].some((field) => !Object.hasOwn(input, field))) return null;
  if (input.name && !input.slug) {
    input.slug = input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  if ('price' in input && (!Number.isFinite(input.price) || input.price < 0)) return null;
  if ('stock' in input && (!Number.isInteger(input.stock) || input.stock < 0)) return null;
  if ('images' in input && (!Array.isArray(input.images) || input.images.some((image) => typeof image !== 'string'))) return null;
  return input;
}

router.get('/', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const filter = { active: true };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.brand) filter.brand = req.query.brand;
  if (req.query.featured === 'true') filter.featured = true;
  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    filter.price = {};
    if (Number.isFinite(minPrice)) filter.price.$gte = minPrice;
    if (Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const term = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'brand', 'description'].map((field) => ({ [field]: new RegExp(term, 'i') }));
  }
  const sortOptions = { newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, name: { name: 1 } };
  const sort = sortOptions[req.query.sort] || sortOptions.newest;
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  return res.json({ products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/:idOrSlug', async (req, res) => {
  const identity = req.params.idOrSlug;
  const query = /^[a-f\d]{24}$/i.test(identity) ? { _id: identity } : { slug: identity };
  const product = await Product.findOne({ ...query, active: true });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  return res.json({ product });
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const input = productInput(req.body || {});
  if (!input) return res.status(400).json({ message: 'Provide valid product details.' });
  const product = await Product.create(input);
  return res.status(201).json({ product });
});

router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const input = productInput(req.body || {}, true);
  if (!input || Object.keys(input).length === 0) {
    return res.status(400).json({ message: 'Provide valid product fields to update.' });
  }
  const product = await Product.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  return res.json({ product });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  return res.json({ message: 'Product archived.', product });
});

module.exports = router;