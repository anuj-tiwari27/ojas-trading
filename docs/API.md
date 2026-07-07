# API Reference

Base URL: `http://localhost:4000/api/v1`
Interactive docs (OpenAPI/Swagger): **`http://localhost:4000/api/docs`**

## Conventions

- **Auth**: send `Authorization: Bearer <accessToken>` on all routes except the
  public ones (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/health`).
- **Success envelope**: `{ "success": true, "data": ... }`.
- **Error envelope**: `{ "success": false, "statusCode", "message", "errors?", "path", "timestamp" }`.
- **Pagination**: list endpoints accept `?page=&limit=&search=&sortBy=&sortDir=`
  and return `{ items: [...], meta: { page, limit, total, totalPages, hasNext, hasPrev } }`.

## Auth

| Method | Path                     | Permission | Notes |
| ------ | ------------------------ | ---------- | ----- |
| POST   | `/auth/login`            | public     | → `{ accessToken, refreshToken, user }` |
| POST   | `/auth/refresh`          | public     | rotates tokens |
| POST   | `/auth/logout`           | public     | revokes refresh token |
| GET    | `/auth/me`               | auth       | current request user (roles + permissions) |
| POST   | `/auth/change-password`  | auth       | revokes all sessions |

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ojastrading.com","password":"Admin@12345"}'
```

## Dashboard  (`dashboard:read`)

`GET /dashboard/summary` · `/status-distribution` · `/monthly-trend` ·
`/top-customers` · `/top-products` · `/quick-stats` · `/recent-activity`

## Trades

| Method | Path                         | Permission     |
| ------ | ---------------------------- | -------------- |
| GET    | `/trades`                    | `trade:read`   |
| GET    | `/trades/:id`                | `trade:read`   |
| GET    | `/trades/:id/timeline`       | `trade:read`   |
| GET    | `/trades/:id/activity-log`   | `trade:read`   |
| POST   | `/trades`                    | `trade:create` |
| PATCH  | `/trades/:id`                | `trade:update` |
| POST   | `/trades/:id/notes`          | `trade:update` |
| DELETE | `/trades/:id`                | `trade:delete` (soft) |

Filters on `GET /trades`: `statusId, customerId, vendorId, brokerId, productId,
traderId, priority, side, dateFrom, dateTo` plus `search`.

```bash
# create (trade number auto-generated, timeline + audit written)
curl -X POST http://localhost:4000/api/v1/trades -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"side":"SALE","productId":"<id>","quantity":75,"price":1300}'

# update with reason (recorded in field-level activity log)
curl -X PATCH http://localhost:4000/api/v1/trades/<id> -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"price":1380,"changeReason":"Market revision"}'
```

## Master Data

Rich entities (own controllers, full DTOs):

| Resource    | Base path     | Permissions prefix |
| ----------- | ------------- | ------------------ |
| Customers   | `/customers`  | `customer:*`       |
| Vendors     | `/vendors`    | `vendor:*`         |
| Products    | `/products`   | `product:*`        |
| Brokers     | `/brokers`    | `broker:*`         |
| Warehouses  | `/warehouses` | `warehouse:*`      |

Each supports `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.

Lookup tables (generic controller, `masterdata:*`) at `/master/:resource`:

```
GET /master/_resources      # list valid resources
GET /master/:resource       # list (paginated, ?search=)
POST /master/:resource
PATCH /master/:resource/:id
DELETE /master/:resource/:id
```

`:resource` ∈ `product-categories, brands, packaging-types, units,
payment-terms, logistics-providers, currencies, tax-rates, trade-statuses,
departments, designations, branches`.

## Users & RBAC  (`user:*`)

| Method | Path                  | Notes |
| ------ | --------------------- | ----- |
| GET    | `/users`              | list |
| GET    | `/users/:id`          | detail |
| POST   | `/users`              | create (assign role ids) |
| PATCH  | `/users/:id`          | update / reset password |
| PUT    | `/users/:id/roles`    | reassign roles |
| DELETE | `/users/:id`          | deactivate (soft) |
| GET    | `/users/roles`        | roles + permissions |
| GET    | `/users/permissions`  | permission catalogue |

## Audit  (`audit:read`)

`GET /audit-logs?entityType=&action=&page=&limit=` — immutable trail.

## Health

`GET /health` (public) → `{ status, db, timestamp }`.

## Permission keys

Format `<resource>:<action>` with actions `read|create|update|delete` for:
`dashboard, masterdata, customer, vendor, product, broker, warehouse, trade,
invoice, payment, inventory, report, audit, user, settings`, plus
`trade:approve, invoice:approve, payment:approve, report:export`.
