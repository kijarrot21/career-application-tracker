# 03. Architecture

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), TypeScript strict |
| UI | Tailwind CSS v4, shadcn/ui style components on Radix primitives, lucide icons, Geist font |
| Data | Drizzle ORM. PGlite (embedded Postgres) when `DATABASE_URL` is empty; postgres-js for Supabase/Postgres otherwise |
| Auth | Better Auth, email/password, database sessions, rate limiting |
| Validation | Zod (shared by forms and server actions) |
| Interactions | dnd-kit (Kanban), TanStack Table, Recharts, react-hook-form, sonner |
| Tests | Vitest (unit + integration on in-memory PGlite), Playwright (E2E) |

## Layers
```
src/
  app/                 routes (RSC pages, route handlers)
  components/          UI (ui primitives, layout, feature components)
  server/
    queries/           read functions, always (userId, ...)
    actions/           server actions: requireUser, zod parse, domain checks, transaction
  lib/
    domain/            pure business rules (stages, suitability, kpi, business days, duplicates, follow-ups)
    auth.ts, session.ts, audit.ts, csv.ts, env.ts, format.ts
  db/
    schema/            drizzle tables
    migrations/        generated SQL
    seed/              system sources, default stages, demo data
```

## Request Flow
1. Page calls `requireUser()`, then query functions scoped by user id.
2. A mutation (Server Action) runs `requireUser()`, Zod parse, domain rule checks, then one transaction that writes the change, the history row (if a stage changed), and an `audit_logs` row.
3. `revalidatePath` refreshes affected routes. The Kanban uses optimistic updates with rollback.

## Data Isolation
1. **Application layer**: every query and mutation filters by `user_id`.
2. **Database layer**: child tables reference parents with composite foreign keys `(parent_id, user_id)`, so cross-user references are impossible.
3. **Supabase (Phase 6)**: optional Row Level Security SQL.
4. **Tests**: integration tests assert cross-user access fails.

## Configuration
Environment variables only (see `.env.example`). `npm run setup` generates local secrets. No credentials are committed.

## Deployment Modes
| Mode | DB | Notes |
|---|---|---|
| Local | PGlite on disk (`.data/pglite`) | Zero install, single process |
| Production | Supabase Postgres (pooler URL) | Set `DATABASE_URL`, run `npm run db:migrate` |
