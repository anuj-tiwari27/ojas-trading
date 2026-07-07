# Deployment & Production Best Practices

## 1. Build

```bash
npm install
npm run build          # builds @ojas/api (dist) and @ojas/web (.next standalone)
```

Container images are provided:

- `apps/api/Dockerfile` — multi-stage; runs `prisma migrate deploy` then `node dist/main.js`.
- `apps/web/Dockerfile` — multi-stage; Next.js **standalone** output.

```bash
docker compose up -d --build      # db, minio, api, web
```

## 2. Environment

Copy `.env.example` → `.env` and set production values. **Critical:**

| Variable | Production guidance |
| -------- | ------------------- |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Unique 48+ byte random secrets (`openssl rand -base64 48`). Never reuse the dev defaults. |
| `DATABASE_URL` | Managed Postgres (RDS/Cloud SQL), TLS on, connection pooling (PgBouncer). |
| `S3_*` | Real S3 bucket + scoped IAM keys; disable public access. |
| `WEB_ORIGIN` | Exact frontend origin for CORS. |
| `NEXT_PUBLIC_API_URL` | Public API URL (behind TLS). |

Secrets belong in a secret manager (AWS Secrets Manager, Vault), **not** in the
image or repo.

## 3. Database

```bash
# in CI/CD, before starting the API:
npx prisma migrate deploy        # applies committed migrations (no prompts)
# first-time only / staging:
npm run db:seed                  # creates company, roles, admin, master data
```

- Use **`prisma migrate deploy`** in production (never `migrate dev`).
- Enable automated backups + PITR.
- Add read replicas for reporting once volume grows; point heavy report queries
  at the replica.
- Create the recommended views / materialized views (see
  [ER-DIAGRAM.md](ER-DIAGRAM.md)) and schedule
  `REFRESH MATERIALIZED VIEW CONCURRENTLY` nightly.

## 4. Runtime topology

```
            ┌──────── CDN / TLS ────────┐
Internet ─▶ │  Load Balancer (HTTPS)    │
            └───┬───────────────┬───────┘
                ▼               ▼
          Next.js (web)   NestJS (api)  ── N replicas, stateless
                                │
                 ┌──────────────┼───────────────┐
                 ▼              ▼                ▼
            PostgreSQL     S3 bucket      (Redis – cache/queues, roadmap)
           (+ replicas)
```

- API and web are **stateless** → scale horizontally behind a load balancer.
- Sessions are JWT-based; the only DB session state is hashed refresh tokens.

## 5. Security checklist

- [x] argon2 password hashing; refresh tokens stored hashed + rotated.
- [x] Helmet-style hardening — add `helmet` middleware in `main.ts` for prod.
- [x] Global validation (`whitelist + forbidNonWhitelisted`) blocks unknown fields.
- [x] RBAC enforced server-side on every route (never trust the client).
- [x] Rate limiting (`@nestjs/throttler`).
- [ ] Put the API behind TLS; set secure cookies if you move tokens to cookies.
- [ ] Restrict CORS to known origins (`WEB_ORIGIN`).
- [ ] Rotate JWT secrets; short access TTL (15m) + refresh rotation already set.
- [ ] Audit-log retention & WORM storage for compliance.

## 6. Observability

- Structured logs (pino) — swap Nest logger for `nestjs-pino` in prod.
- Health endpoint `/api/v1/health` for liveness/readiness probes.
- Add metrics (Prometheus) + tracing (OpenTelemetry) at the interceptor layer.
- Ship audit logs to a separate immutable store / SIEM.

## 7. Performance targets & levers

Target **< 200 ms** typical API responses:

- Server-side pagination/filtering everywhere (already implemented).
- Composite indexes on hot paths (already in schema).
- Stored trade rollups (`grossValue/profit/marginPct`) avoid recompute.
- Add a Redis cache for dashboard aggregates (short TTL) and a job queue
  (BullMQ) for reminders, notifications, exports, and materialized-view refresh.
- Lazy-load + code-split on the web (Next.js does this per-route automatically).

## 8. CI/CD outline

1. `npm ci`
2. `npm run build` (type-checks both apps)
3. `npx prisma validate`
4. Run tests (add Jest/e2e).
5. Build & push Docker images.
6. `prisma migrate deploy` against the target DB.
7. Rolling deploy api + web; health-check gate.

## 9. Backups & DR

- Postgres: automated daily snapshots + WAL archiving (PITR).
- S3: versioning + lifecycle policies; cross-region replication for DR.
- Test restores regularly.
