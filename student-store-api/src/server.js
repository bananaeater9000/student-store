require('dotenv').config()

const express = require('express')
const cors = require('cors')

const Product = require('../models/product')
const Order = require('../models/order')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Student Store API is running 🎓' })
})

// ---------- Product routes (see planning.md → Section 2: API Contract) ----------

// GET /products → 200 with array of products.
// Optional query params: ?category=<string> (filter), ?sort=price|name (sort asc).
const ALLOWED_SORT_FIELDS = ['price', 'name']
app.get('/products', async (req, res) => {
  const { category, sort } = req.query

  if (sort !== undefined && !ALLOWED_SORT_FIELDS.includes(sort)) {
    return res.status(400).json({
      error: `Invalid sort field: ${sort}. Allowed: ${ALLOWED_SORT_FIELDS.join(', ')}`,
    })
  }

  try {
    const products = await Product.findAll({ category, sort })
    res.status(200).json(products)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

// GET /products/:id → 200 with one product, or 404 if not found
app.get('/products/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Product id must be an integer' })
  }
  try {
    const product = await Product.findById(id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.status(200).json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch product' })
  }
})

// POST /products → 201 with created product, or 400 on missing required field
app.post('/products', async (req, res) => {
  const { name, description, price, imageUrl, category } = req.body
  for (const field of ['name', 'description', 'price', 'category']) {
    if (req.body[field] === undefined || req.body[field] === null) {
      return res.status(400).json({ error: `Missing required field: ${field}` })
    }
  }
  try {
    const product = await Product.create({ name, description, price, imageUrl, category })
    res.status(201).json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create product' })
  }
})

// PUT /products/:id → 200 with updated product, or 404 if not found
app.put('/products/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Product id must be an integer' })
  }
  try {
    const existing = await Product.findById(id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    const { name, description, price, imageUrl, category } = req.body
    const updated = await Product.update(id, { name, description, price, imageUrl, category })
    res.status(200).json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update product' })
  }
})

// DELETE /products/:id → 204 no content, or 404 if not found
app.delete('/products/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Product id must be an integer' })
  }
  try {
    const existing = await Product.findById(id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    await Product.delete(id)
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete product' })
  }
})

// ---------- Order routes (see planning.md → Section 2 & 3) ----------

// GET /orders → 200 with all orders, each including its items
app.get('/orders', async (req, res) => {
  try {
    const orders = await Order.findAll()
    res.status(200).json(orders)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

// GET /orders/:id → 200 with the order + its items, or 404
app.get('/orders/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Order id must be an integer' })
  }
  try {
    const order = await Order.findById(id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.status(200).json(order)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

// POST /orders → 201 with the created order + items (atomic). 400/404 on bad input.
app.post('/orders', async (req, res) => {
  const { customer, status, items } = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' })
  }
  for (const item of items) {
    if (!Number.isInteger(item.productId) || !(item.quantity > 0)) {
      return res
        .status(400)
        .json({ error: 'Each item needs a productId and a positive quantity' })
    }
  }

  try {
    const order = await Order.create({ customer, status, items })
    res.status(201).json(order)
  } catch (err) {
    // A nonexistent productId throws from inside the transaction → 404, nothing saved.
    if (/does not exist/.test(err.message)) {
      return res.status(404).json({ error: err.message })
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to create order' })
  }
})

// PUT /orders/:id → 200 with the updated order (+ items), or 404 if not found
app.put('/orders/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Order id must be an integer' })
  }
  try {
    const existing = await Order.findById(id)
    if (!existing) return res.status(404).json({ error: 'Order not found' })

    const { customer, status, totalPrice } = req.body
    const updated = await Order.update(id, { customer, status, totalPrice })
    res.status(200).json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update order' })
  }
})

// DELETE /orders/:id → 204 no content, or 404 if not found
app.delete('/orders/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Order id must be an integer' })
  }
  try {
    const existing = await Order.findById(id)
    if (!existing) return res.status(404).json({ error: 'Order not found' })

    await Order.delete(id)
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete order' })
  }
})

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`)
})

module.exports = app
