require('dotenv').config()

const express = require('express')
const cors = require('cors')

const Product = require('../models/product')

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

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`)
})

module.exports = app
