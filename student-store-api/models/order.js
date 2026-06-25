const prisma = require('../src/db/db')

/**
 * Order model — wraps Prisma Client calls for the Order table.
 * See planning.md → Data Models and Section 3 (POST /orders transaction).
 */
class Order {
  // GET /orders → all orders, each with its items.
  static async findAll() {
    return prisma.order.findMany({
      include: { orderItems: true },
      orderBy: { id: 'asc' },
    })
  }

  // GET /orders/:id → one order with its associated items, or null.
  static async findById(id) {
    return prisma.order.findUnique({
      where: { id },
      include: { orderItems: true },
    })
  }

  // POST /orders → create an order and its items atomically.
  // Server computes totalPrice and snapshots each item's price from the Product;
  // a nonexistent productId rolls the whole thing back. (planning.md Section 3)
  static async create({ customer, status, items }) {
    return prisma.$transaction(async (tx) => {
      const productIds = items.map((i) => i.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      })

      const priceById = {}
      for (const p of products) priceById[p.id] = p.price

      // Ensure every referenced product exists; throw to roll back if not.
      for (const id of productIds) {
        if (priceById[id] === undefined) {
          throw new Error(`Product ${id} does not exist`)
        }
      }

      const totalPrice = items.reduce(
        (sum, i) => sum + priceById[i.productId] * i.quantity,
        0
      )

      return tx.order.create({
        data: {
          customer,
          status: status ?? 'pending',
          totalPrice,
          orderItems: {
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: priceById[i.productId],
            })),
          },
        },
        include: { orderItems: true },
      })
    })
  }
}

module.exports = Order
