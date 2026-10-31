# Perfume Store API

Node.js, Express, and MongoDB REST API for the perfume store. The workspace currently contains the server only; point the separate frontend's API base URL at this server to integrate it.

## Run locally

1. Install a local MongoDB instance or use a MongoDB connection string.
2. Copy `.env.example` to `.env`, set `MONGODB_URI` and a random `JWT_SECRET` (at least 32 characters), and add the frontend origin(s) to `CLIENT_ORIGINS`.
3. Run `npm install`, then `npm run dev`. The API listens on port 5000 by default.

Set the frontend API base URL to `http://localhost:5000/api`. The API returns JSON and permits browser requests only from origins listed in `CLIENT_ORIGINS`.

## Routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register `{ name, email, password }` |
| POST | `/api/auth/login` | Public | Login `{ email, password }` |
| GET | `/api/auth/me` | Signed in | Current user |
| GET | `/api/products` | Public | Browse/search/filter/paginate products |
| GET | `/api/products/:idOrSlug` | Public | Product detail |
| POST | `/api/products` | Admin | Create a product |
| PATCH | `/api/products/:id` | Admin | Update product fields |
| DELETE | `/api/products/:id` | Admin | Archive product |
| POST | `/api/orders` | Signed in | Create order with `{ items: [{ productId, quantity }], shippingAddress }` |
| GET | `/api/orders` | Signed in | Current user's orders; admins may pass `?all=true` |
| GET | `/api/orders/:id` | Owner/admin | Order detail |
| PATCH | `/api/orders/:id/status` | Admin | Set order status |

Send the access token returned by register/login as `Authorization: Bearer <token>`. Product listing accepts `search`, `category`, `brand`, `featured=true`, `minPrice`, `maxPrice`, `sort` (`newest`, `price_asc`, `price_desc`, `name`), `page`, and `limit`.

## Admin accounts

Registration deliberately creates customer accounts only. After registering the store owner, promote that account to `role: "admin"` in MongoDB using a trusted database administration tool. Never expose admin role assignment through public registration.

Order totals and product prices are calculated on the server. Stock is reserved when an order is created; use a MongoDB replica set and transactions if you need stronger atomicity across stock updates and order persistence in production.