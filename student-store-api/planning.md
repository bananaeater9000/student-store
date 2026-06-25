# Student Store API — System Spec

> Source of truth for schema and route decisions across all milestones.
> Field names below match the shapes already used in `seed.js` and the JSON in `/data`.

---

## Section 1: Data Models

Three models: **Product**, **Order**, **OrderItem**. All primary keys are `Int @id @default(autoincrement())`.

### Product

| Field       | Prisma type | Required | Default      | Notes                         |
|-------------|-------------|----------|--------------|-------------------------------|
| `id`        | `Int`       | yes      | autoincrement | Primary key                  |
| `name`      | `String`    | yes      | —            |                               |
| `description` | `String`  | yes      | —            |                               |
| `price`     | `Float`     | yes      | —            | Unit price                    |
| `imageUrl`  | `String`    | no       | —            | Maps from `image_url` in seed |
| `category`  | `String`    | yes      | —            |                               |
| `orderItems`| `OrderItem[]` | —      | —            | Back-relation (no DB column)  |

- **Primary key:** `id`, auto-increments.
- **Relationships:** One Product → many OrderItems.

### Order

| Field        | Prisma type | Required | Default      | Notes                              |
|--------------|-------------|----------|--------------|------------------------------------|
| `id`         | `Int`       | yes      | autoincrement | Primary key                       |
| `customer`   | `String`    | yes      | —            | Customer identifier / name         |
| `totalPrice` | `Float`     | yes      | `0`          | Computed at create time            |
| `status`     | `String`    | yes      | `"pending"`  | e.g. pending / completed           |
| `createdAt`  | `DateTime`  | yes      | `now()`      |                                    |
| `orderItems` | `OrderItem[]` | —      | —            | Back-relation (no DB column)       |

- **Primary key:** `id`, auto-increments.
- **Relationships:** One Order → many OrderItems.

### OrderItem (the join / line-item table)

| Field       | Prisma type | Required | Default | Notes                              |
|-------------|-------------|----------|---------|------------------------------------|
| `id`        | `Int`       | yes      | autoincrement | Primary key                  |
| `orderId`   | `Int`       | yes      | —       | FK → `Order.id`                    |
| `productId` | `Int`       | yes      | —       | FK → `Product.id`                  |
| `quantity`  | `Int`       | yes      | `1`     |                                    |
| `price`     | `Float`     | yes      | —       | Unit price snapshot at order time  |
| `order`     | `Order`     | yes      | —       | Relation field                     |
| `product`   | `Product`   | yes      | —       | Relation field                     |

- **Primary key:** `id`, auto-increments.
- **Relationships:** OrderItem belongs to exactly one Order and one Product. It sits at the intersection of both.

### Cascade Delete Rules (most important part)

In plain language:

1. **Delete a Product → delete every OrderItem that references it.**
   The `product` relation on OrderItem uses `onDelete: Cascade`.
2. **Delete an Order → delete every OrderItem that references it.**
   The `order` relation on OrderItem uses `onDelete: Cascade`.

So OrderItem is downstream of **two** cascade rules at once.

**The hard question: what happens to an Order if one of its Products is deleted mid-order?**

- The cascade only removes the *OrderItem* line, not the Order itself. The Order survives but loses a line item.
- Consequence: `Order.totalPrice` becomes stale — it no longer equals the sum of its remaining items, because a line silently vanished.
- **Decision for this project:** I accept the stale total rather than block product deletion or recompute on cascade. Rationale: `price` is snapshotted onto each OrderItem, so historical orders are meant to be immutable records. A deleted product removing a line is an edge case; an admin recompute/report job can reconcile totals later if needed. Documented here so the behavior is a choice, not a surprise.

---

## Section 2: API Contract

**Consistent error shape for the entire API:**
```json
{ "error": "human-readable message" }
```

| Method | Path            | Purpose                  |
|--------|-----------------|--------------------------|
| GET    | `/products`     | List all products        |
| GET    | `/products/:id` | Get one product          |
| POST   | `/products`     | Create a product         |
| GET    | `/orders`       | List all orders + items  |
| GET    | `/orders/:id`   | Get one order + items    |
| POST   | `/orders`       | Create order + its items |

### GET /products
- **Request:** none required.
- **Query Parameters** (all optional, combinable):
  | Param      | Values                          | Effect                                                        |
  |------------|---------------------------------|---------------------------------------------------------------|
  | `category` | any string, e.g. `Apparel`      | Filters to products whose `category` matches (case-insensitive) |
  | `sort`     | `price` \| `name`               | Sorts results ascending by that field                         |
  - **Default behavior (no params):** return **all** products, unordered (insertion/`id` order).
  - **Combining:** `category` and `sort` can be used together, e.g. `?category=Apparel&sort=price`.
  - **Invalid `category`:** a category with no matching products is not an error → returns `200` with an empty array `[]`.
  - **Invalid `sort`:** an unrecognized `sort` value (anything other than `price`/`name`) → `400 { "error": "Invalid sort field: <value>. Allowed: price, name" }`.
- **Success — 200:** `[ { id, name, description, price, imageUrl, category }, ... ]`
- **Examples:**
  - `GET /products` → all products, unordered
  - `GET /products?category=Apparel` → only Apparel products
  - `GET /products?sort=price` → all products, cheapest first
  - `GET /products?category=Supplies&sort=name` → Supplies, alphabetical by name

### GET /products/:id
- **Request:** route param `id` (int).
- **Success — 200:** `{ id, name, description, price, imageUrl, category }`
- **Error — 404:** `{ "error": "Product not found" }`

### POST /products
- **Request body:**
  ```json
  { "name": "string", "description": "string", "price": 9.99,
    "imageUrl": "string (optional)", "category": "string" }
  ```
- **Success — 201:** the created product object.
- **Error — 400:** `{ "error": "Missing required field: name" }`

### GET /orders
- **Request:** none.
- **Success — 200:** array of orders, each with nested `orderItems`.

### GET /orders/:id
- **Request:** route param `id` (int).
- **Success — 200:** order object with nested `orderItems`.
- **Error — 404:** `{ "error": "Order not found" }`

### POST /orders  (the complex one)
- **Request body** — order metadata **plus** an array of items:
  ```json
  {
    "customer": "Jane Student",
    "status": "pending",
    "items": [
      { "productId": 1, "quantity": 2 },
      { "productId": 4, "quantity": 1 }
    ]
  }
  ```
  Note: `totalPrice` is **not** sent by the client — the server computes it. Item `price` is looked up from the Product, not trusted from the client.
- **Success — 201:** the created order with its nested items:
  ```json
  {
    "id": 7,
    "customer": "Jane Student",
    "status": "pending",
    "totalPrice": 61.97,
    "createdAt": "2026-06-24T...",
    "orderItems": [
      { "id": 21, "orderId": 7, "productId": 1, "quantity": 2, "price": 29.99 },
      { "id": 22, "orderId": 7, "productId": 4, "quantity": 1, "price": 1.99 }
    ]
  }
  ```
- **Error — 400:** `{ "error": "Order must contain at least one item" }`
- **Error — 404:** `{ "error": "Product 999 does not exist" }` (an item references a nonexistent product)

---

## Section 3: Transactional Flow — POST /orders

POST /orders must be **atomic**: create the Order, create all its OrderItems, compute the total — or do none of it.

**Request body:** `{ customer, status?, items: [{ productId, quantity }, ...] }`

**Step-by-step at the data layer:**

1. **Validate input** (before touching the DB): `items` exists and is non-empty; each item has a `productId` and a positive `quantity`. Fail → `400`.
2. **Open a transaction** with `prisma.$transaction(async (tx) => { ... })`. Everything below runs on `tx`; if anything throws, the whole thing rolls back automatically.
3. **Look up every referenced product** via `tx.product.findMany({ where: { id: { in: productIds } } })`.
   - If any requested `productId` is missing from the result, **throw** → transaction rolls back → handler returns `404 { error: "Product <id> does not exist" }`. Nothing is persisted.
4. **Compute line prices and total** from the *server-side* product prices:
   `lineTotal = product.price * quantity`, `totalPrice = Σ lineTotal`. Never trust a client-sent price.
5. **Create the Order** with a nested write that creates its items in the same call:
   ```js
   tx.order.create({
     data: {
       customer,
       status: status ?? 'pending',
       totalPrice,
       orderItems: {
         create: items.map(i => ({
           productId: i.productId,
           quantity: i.quantity,
           price: priceLookup[i.productId],
         })),
       },
     },
     include: { orderItems: true },
   })
   ```
   Because the items are created as a nested write inside the order's `create`, if any single item insert fails the **entire** `order.create` fails — no half-created order.
6. **Commit** — transaction returns the order (with items included).
7. **Respond `201`** with the created order + nested `orderItems`.

**What if an item references a nonexistent product?** Caught at step 3 → throw inside the transaction → rollback → `404`, and zero rows are written (no orphaned Order, no partial items).

---

## Decisions Log — Product Model

- **Schema translation that went smoothly**: `imageUrl` translated directly to `String?` — the `?` optional modifier matched the "Required: no" column in the spec one-to-one, while every other field stayed non-null. `prisma validate` passed on the first try.

- **Field decision I made during implementation that wasn't in the original spec**: Kept the `orderItems` back-relation **commented out** in `schema.prisma` for this milestone. It's a virtual field (not a real column), so it can't exist until the `OrderItem` model does — deferring it keeps the migration to a clean single `products` table without changing what a Product contains.

- **Route behavior that needed a spec update**: The contract only fully detailed `GET /products`, `GET /products/:id`, and `POST /products`, but the milestone requires five endpoints. Added `PUT /products/:id` (200 with the updated product, 404 if missing) and `DELETE /products/:id` (204 No Content, 404 if missing) following REST convention — no contradiction with the spec, just filling in the two it left implicit.
