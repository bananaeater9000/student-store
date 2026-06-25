const prisma = require('../src/db/db')

/**
 * Product model — wraps Prisma Client calls for the Product table.
 * Each method maps to one CRUD operation from the API contract in planning.md.
 */
class Product {
  // GET /products → list all products
  static async findAll() {
    return prisma.product.findMany({ orderBy: { id: 'asc' } })
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
