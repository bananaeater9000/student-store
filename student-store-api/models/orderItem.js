const prisma = require('../src/db/db')

/**
 * OrderItem model — wraps Prisma Client calls for the OrderItem table.
 * Each OrderItem links one Order to one Product (see planning.md → Data Models).
 */
class OrderItem {
  // Create a single order item.
  static async create({ orderId, productId, quantity, price }) {
    return prisma.orderItem.create({
      data: { orderId, productId, quantity, price },
    })
  }

  // Fetch all order items, optionally scoped to one order.
  static async findAll({ orderId } = {}) {
    const where = orderId ? { orderId } : undefined
    return prisma.orderItem.findMany({ where })
  }

  // Fetch one order item by id, with its product included.
  static async findById(id) {
    return prisma.orderItem.findUnique({
      where: { id },
      include: { product: true },
    })
  }
}

module.exports = OrderItem
