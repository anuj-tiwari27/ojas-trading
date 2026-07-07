# Ojas Trading — Enterprise Commodity Trading Platform

An ERP-grade platform for an **edible-oil commodity trading** company. It is the
single source of truth: every trade recorded, every change audited, every
payment traceable, every document searchable, everything on one dashboard.

Built as a multi-tenant, role-based, audit-first system designed to scale to
millions of trade records.

> **Status — Milestone 1 (foundation + vertical slice).**
> Fully working end-to-end: Auth/RBAC, Master Data, **Trade Management**
> (lifecycle, timeline, field-level activity log), and a live Dashboard.
> Purchase, Sales, Inventory, Finance, Documents, Reports are modeled in the
> database & API foundation and stubbed in the UI — see the roadmap below.

---

## Tech stack

| Layer        | Choice                                                       |
| ------------ | ----------------------------------------------------------- |
| Frontend     | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, shadcn-style UI, TanStack Table & Query, Recharts |
| Backend      | NestJS 11 (layered + repository + service + audit), REST, OpenAPI |
| Database     | PostgreSQL 16                                               |
| ORM          | Prisma 6                                                    |
| Auth         | JWT access + rotating refresh tokens (argon2 hashing)       |
| Storage      | S3-compatible (MinIO locally)                               |
| Dev runtime  | Docker Compose                                              |

## Architecture at a glance

```
Browser ──HTTP──> Next.js (web)  ──REST /api/v1──>  NestJS (api)  ──Prisma──> PostgreSQL
                                                        │
                                                        └── S3 (MinIO) for documents
```

Layered backend: **Controller → Service → Repository → Prisma**, with
cross-cutting **Guards** (JWT, RBAC), **Interceptors** (response envelope),
**Filters** (error normalization) and an **Audit** layer. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Quick start

Prerequisites: **Node ≥ 20**, **Docker Desktop**.

```bash
# 1. Configure
cp .env.example .env          # adjust ports/secrets if needed

# 2. Install (npm workspaces)
npm install

# 3. Start infrastructure (Postgres + MinIO)
docker compose up -d db minio minio-init

# 4. Create the schema + seed demo data
npm run db:migrate            # applies migrations
npm run db:seed               # company, roles, admin, master data, sample trades

# 5. Run the apps (api :4000, web :3000)
npm run dev
```

Then open:

- **Web app** — http://localhost:3000  (login: `admin@ojastrading.com` / `Admin@12345`)
- **API docs (Swagger)** — http://localhost:4000/api/docs
- **MinIO console** — http://localhost:9001

> If host port `5432` is busy, set `POSTGRES_PORT` (and the `DATABASE_URL` port)
> in `.env` to a free port — this repo ships defaulted to `5433` for that reason.

### Run everything in Docker

```bash
docker compose up -d --build      # db, minio, api, web
```

---

## Repository layout

```
ojas-trading/
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # full normalized schema (single source of truth)
│   │   │   └── seed.ts        # permissions, roles, master data, sample trades
│   │   └── src/
│   │       ├── auth/          # JWT + refresh, login, change-password
│   │       ├── common/        # guards, interceptors, filters, base repository, DTOs
│   │       ├── audit/         # immutable audit trail
│   │       ├── numbering/     # atomic per-company document numbering
│   │       ├── master-data/   # customers, vendors, products, brokers, warehouses + lookups
│   │       ├── trades/        # trade lifecycle, timeline, activity log
│   │       ├── dashboard/     # KPI + chart aggregations
│   │       ├── users/         # user management + roles/permissions
│   │       └── prisma/        # PrismaService (DI)
│   └── web/                   # Next.js frontend
│       └── src/
│           ├── app/(app)/     # authenticated shell (dashboard, trades, master, …)
│           ├── app/login/     # auth
│           ├── components/     # ui primitives, data-table, sidebar, charts
│           └── lib/            # api client (token refresh), auth store, formatters
├── docs/                      # architecture, ER diagram, API, deployment
└── docker-compose.yml
```

## Useful scripts (run from repo root)

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Run api + web together                       |
| `npm run db:migrate` | Apply Prisma migrations (dev)                |
| `npm run db:seed`    | Seed demo company, roles, master data, trades|
| `npm run db:studio`  | Open Prisma Studio                           |
| `npm run db:reset`   | Drop + recreate + reseed                     |
| `npm run build`      | Build both apps                              |

---

## What works today (verified end-to-end)

- **Auth**: login → JWT + refresh, `/auth/me`, transparent token refresh, password change (revokes sessions).
- **RBAC**: 7 seeded roles (Admin, Management, Trader, Finance, Accounts, Operations, Viewer) + per-route `@RequirePermissions`.
- **Master Data**: full CRUD for customers, vendors, products, brokers, warehouses, and 12 lookup tables — every dropdown is data-driven.
- **Trades**: create (auto trade-number `TRD-FY-#####`), update with **field-level activity log** (old → new + reason), **timeline** events, soft delete, filtering/search/pagination, back-to-back linkage with profit/margin.
- **Dashboard**: live KPIs, 12-month revenue/profit trend (raw SQL), status distribution, top products/customers, recent activity.
- **Audit**: every login/create/update/delete recorded immutably.

See the roadmap and design notes in [docs/](docs/).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [ER Diagram & schema](docs/ER-DIAGRAM.md)
- [API reference](docs/API.md)
- [Deployment & production best practices](docs/DEPLOYMENT.md)
