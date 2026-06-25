# Student Store API — System Spec

Source of truth for the schema and routes. Field names match `seed.js` and `/data`.

---

## Section 1: Data Models

Three models: **Product**, **Order**, **OrderItem**. Every `id` is `Int @id @default(autoincrement())`.

### Product
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `id` | Int | yes | autoincrement |
| `name` | String | yes | — |
| `description` | String | yes | — |
| `price` | Float | yes | — |
| `imageUrl` | String | no | — |
| `category` | String | yes | — |
| `orderItems` | OrderItem[] | — | back-relation |

### Order
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `id` | Int | yes | autoincrement |
| `customer` | String | yes | — |
| `totalPrice` | Float | yes | `0` |
| `status` | String | yes | `"pending"` |
| `createdAt` | DateTime | yes | `now()` |
| `orderItems` | OrderItem[] | — | back-relation |

### OrderItem
Join table between Order and Product.

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `id` | Int | yes | autoincrement |
| `orderId` | Int | yes | FK → Order.id |
| `productId` | Int | yes | FK → Product.id |
| `quantity` | Int | yes | `1` |
| `price` | Float | yes | unit price at order time |

### Cascade Delete Rules
- Delete a **Product** → delete its OrderItems (`onDelete: Cascade`).
- Delete an **Order** → delete its OrderItems (`onDelete: Cascade`).

**Edge case:** deleting a Product mid-order removes the OrderItem line but keeps the Order, so `Order.totalPrice` goes stale. We accept this — each OrderItem snapshots its own `price`, so orders stay valid historical records.

---

## Section 2: API Contract

All errors use the shape `{ "error": "message" }`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/products` | List products (filter + sort) |
| GET | `/products/:id` | Get one product |
| POST | `/products` | Create a product |
| PUT | `/products/:id` | Update a product |
| DELETE | `/products/:id` | Delete a product |
| GET | `/orders` | List orders + items |
| GET | `/orders/:id` | Get one order + items |
| POST | `/orders` | Create order + items |

### GET /products
Optional query params (combinable):
- `category=<string>` — filter by category (case-insensitive)
- `sort=price|name` — sort ascending

Defaults to all products, unordered.

- **200:** `[ { id, name, description, price, imageUrl, category }, ... ]`
- **400:** bad `sort` value → `{ "error": "Invalid sort field: <value>. Allowed: price, name" }`
- A category with no matches returns `200 []`, not an error.

### GET /products/:id
- **200:** the product
- **404:** `{ "error": "Product not found" }`

### POST /products
- **Body:** `{ name, description, price, imageUrl?, category }`
- **201:** the created product
- **400:** `{ "error": "Missing required field: <field>" }`

### PUT /products/:id
- **Body:** any product fields to update
- **200:** the updated product
- **404:** `{ "error": "Product not found" }`

### DELETE /products/:id
- **204:** no content
- **404:** `{ "error": "Product not found" }`

### GET /orders
- **200:** array of orders, each with nested `orderItems`

### GET /orders/:id
- **200:** the order with nested `orderItems`
- **404:** `{ "error": "Order not found" }`

### POST /orders
Server computes `totalPrice` and looks up each item's `price` from the Product (client values are ignored).

- **Body:**
  ```json
  { "customer": "Jane", "status": "pending",
    "items": [ { "productId": 1, "quantity": 2 } ] }
  ```
- **201:** the created order with nested `orderItems`
- **400:** `{ "error": "Order must contain at least one item" }`
- **404:** `{ "error": "Product 999 does not exist" }`

---

## Section 3: Transactional Flow — POST /orders

Create the Order, its OrderItems, and the total atomically — all or nothing.

1. **Validate:** `items` is non-empty; each has a `productId` and positive `quantity`. Else → `400`.
2. **Start a transaction** (`prisma.$transaction`). Anything that throws rolls back everything.
3. **Look up the products** by id. If any is missing → throw → `404`, nothing saved.
4. **Compute the total** from the looked-up prices: `Σ (price × quantity)`.
5. **Create the Order** with a nested `orderItems.create`, so a bad item fails the whole write.
6. **Commit** and return the order with items → `201`.

A nonexistent `productId` is caught at step 3 → rollback → `404`, zero rows written.

---

## Spec Reconciliation — Milestone 4 (Schema Audit)

### Schema vs. spec gaps found
- **No field gaps.** Product, Order, and OrderItem match the Data Models section exactly — same fields, types, optionality, and defaults (`totalPrice=0`, `status="pending"`, `createdAt=now()`, `quantity=1`).
- The spec table doesn't list OrderItem's `order`/`product` relation fields, but Prisma requires them to express the `orderId`/`productId` foreign keys the spec does describe — so not a true gap.
- Added a comment on `OrderItem.price` noting it's the unit-price snapshot at order time (matches the spec wording); field type `Float` was already correct.

### Cascade delete verification
- Both relations use `onDelete: Cascade` — confirmed in the generated client's DMMF (`order → Cascade`, `product → Cascade`).
- Deleting a Product removes associated OrderItems: ⏳ pending live DB test (no database connected yet)
- Deleting an Order removes associated OrderItems: ⏳ pending live DB test (no database connected yet)

---

## Decisions Log — Product Model

- **Smooth translation:** `imageUrl` → `String?`; the `?` matched the optional spec field directly, everything else stayed required.
- **Off-spec choice:** left the `orderItems` back-relation commented out until the OrderItem model exists, keeping this migration to a clean `products` table.
- **Spec fill-in:** added `PUT` and `DELETE /products/:id` (the spec implied five endpoints but only detailed three) following REST conventions.
