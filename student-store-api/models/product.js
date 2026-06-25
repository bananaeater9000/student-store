const prisma = require('../src/db/db')

/**
 * Product model — wraps Prisma Client calls for the Product table.
 * Each method maps to one CRUD operation from the API contract in planning.md.
 */
class Product {
  // GET /products → list products, optionally filtered by category and/or sorted.
  // Accepts { category, sort } (both optional). See planning.md → GET /products.
  static async findAll({ category, sort } = {}) {
    const query = {}

    if (category) {
      // Case-insensitive exact match on category
      query.where = { category: { equals: category, mode: 'insensitive' } }
    }

    if (sort) {
      query.orderBy = { [sort]: 'asc' }
    }

    return prisma.product.findMany(query)
  }

  // GET /products/:id → one product, or null if not found
  static async findById(id) {
    return prisma.product.findUnique({ where: { id } })
  }

  // POST /products → create a product
  static async create({ name, description, price, imageUrl, category }) {
    return prisma.product.create({
      data: { name, description, price, imageUrl, category },
    })
  }

  // PUT /products/:id → update a product, returns the updated record
  static async update(id, data) {
    return prisma.product.update({ where: { id }, data })
  }

  // DELETE /products/:id → remove a product
  static async delete(id) {
    return prisma.product.delete({ where: { id } })
  }
}

module.exports = Product
