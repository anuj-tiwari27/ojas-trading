# System Architecture

## 1. Overview

Ojas Trading is a **multi-tenant, layered, audit-first** ERP for commodity
trading. It separates a stateless REST API (NestJS) from a server-rendered SPA
(Next.js), backed by PostgreSQL and S3-compatible object storage.

```
┌──────────────┐    HTTPS     ┌────────────────────────────┐   Prisma   ┌────────────┐
│  Next.js Web │ ───────────▶ │   NestJS API  (/api/v1)    │ ─────────▶ │ PostgreSQL │
│  (React 19)  │ ◀─────────── │  Controller→Service→Repo   │ ◀───────── │     16     │
└──────────────┘   JSON env   └────────────┬───────────────┘            └────────────┘
                                           │ presigned URLs
                                           ▼
                                   ┌────────────────┐
                                   │  S3 / MinIO    │  documents
                                   └────────────────┘
```

## 2. Backend layering

```
HTTP Request
   │
   ▼
[ Guards ]            JwtAuthGuard → ThrottlerGuard → PermissionsGuard
   │                  (authenticate, rate-limit, authorize)
   ▼
[ Controller ]        thin — validation (DTO + class-validator), routing
   │
   ▼
[ Service ]           business logic, transactions, financial computation,
   │                  timeline/audit emission
   ▼
[ Repository ]        tenant-scoped, soft-delete-aware data access
   │                  (BaseRepository / MasterCrudService)
   ▼
[ PrismaService ]     connection + query execution
```

Cross-cutting concerns:

- **TransformInterceptor** — wraps every success as `{ success: true, data }`.
- **AllExceptionsFilter** — normalizes errors (incl. Prisma `P2002/P2025`) to a
  consistent envelope with status codes.
- **AuditService** — central, immutable audit writer + field-diff helper.
- **NumberingService** — atomic, FY-aware document numbering inside transactions.

### Why these patterns

| Pattern                | Purpose |
| ---------------------- | ------- |
| Repository / generic CRUD service | One consistent, tenant-scoped, soft-delete + audit path for all master data; avoids 20× duplicated controllers. |
| Service layer          | Keeps transactions, profit/margin math and timeline emission out of controllers. |
| Guard-based RBAC       | Declarative `@RequirePermissions('trade:create')`; permissions flattened onto the JWT-derived request user. |
| Response envelope      | Predictable client parsing + uniform pagination `{ items, meta }`. |

## 3. Multi-tenancy

Every business row carries `companyId`. All repository reads are scoped by
`companyId` (derived from the authenticated user, never from the client body).
Unique business keys (codes, numbers) are **composite-unique per company**
(e.g. `@@unique([companyId, code])`), so two tenants can both have `CUST-001`.

## 4. Authentication & authorization

- **Access token** (JWT, 15 min) — bearer header, carries `sub`, `companyId`, `email`.
- **Refresh token** (JWT, 7 days) — only its **SHA-256 hash** is stored; rotated
  on every refresh; revoked on logout and on password change.
- Passwords hashed with **argon2**.
- On each request the JWT strategy hydrates the user's **roles + flattened
  permission keys**; `PermissionsGuard` enforces `@RequirePermissions`.
- `isSuperAdmin` bypasses permission checks.

## 5. Auditing & soft delete

- **Nothing is hard-deleted.** Business tables have `deletedAt`; deletes set the
  timestamp, reads exclude non-null, and `restore()` reverses it.
- **Global audit trail** (`audit_logs`): login/logout, CRUD, approve, export,
  password/settings changes — with actor, IP, user-agent and a JSON `diff`.
- **Trade activity log** (`trade_activity_logs`): field-level old→new with a
  reason, in addition to the human-readable **timeline** (`trade_timeline`).

## 6. Frontend architecture

- **App Router** with a route group `(app)` providing the authenticated shell
  (sidebar + topbar + client-side auth guard). `/login` sits outside it.
- **State**: TanStack Query for server state; a small Zustand store (persisted)
  for the session (tokens + user + `can(permission)` helper).
- **API client**: axios with request interceptor (bearer) and a single-flight
  response interceptor that transparently refreshes on `401`.
- **UI**: hand-rolled shadcn-style primitives (Button, Card, Table, Badge,
  Modal, Select…) on Tailwind tokens — white background, light-gray cards,
  minimal color. Tables use TanStack Table with sticky headers, server-side
  pagination, search and sorting.

## 7. Performance strategy

- Server-side **pagination, filtering and search** on every list endpoint.
- Targeted **indexes + composite indexes** for dashboard hot paths
  (e.g. `trades(companyId, deletedAt, statusId, tradeDate)`).
- **Stored rollups** on trades (`grossValue`, `profit`, `marginPct`) kept in
  sync by the service layer so dashboards avoid recomputation.
- Raw SQL `date_trunc` aggregation for the 12-month trend.
- Rate limiting via `@nestjs/throttler`.
- Ready for read replicas / materialized views as volume grows (see ER doc).

## 8. Module map

| Module       | State |
| ------------ | ----- |
| Auth / RBAC  | ✅ implemented |
| Master Data  | ✅ implemented (5 rich entities + 12 lookups) |
| Trades       | ✅ implemented (lifecycle, timeline, activity, financials) |
| Dashboard    | ✅ implemented |
| Audit        | ✅ implemented |
| Users        | ✅ implemented |
| Purchase / Sales / Inventory / Finance / Documents / Reports / Tasks / Reminders / Notifications | 🟡 modeled in schema, API foundation ready, UI stubbed |
