# AGENTS.md

Guide for AI coding agents working on Kouture Life OS.

## Stack

Next.js 16 (App Router, `src/proxy.ts`), React 19, TypeScript, Tailwind v4, shadcn/ui (Base UI primitives), Recharts, TanStack Query/Form, Zod, Supabase (`@supabase/ssr`), Vitest, Bun.

## Structure

```
src/app/(app)/...         authenticated routes: life, kouture, approvals, activity
src/app/login|setup|auth  public routes
src/features/<domain>/    lib (pure, tested) · server (loaders, actions) · components
src/server/               env, session, errors, action wrapper, data repositories
src/components/lux        design-system pieces (SectionCard, StatCard, ProgressRing, EmptyNote)
src/styles/theme.css      the single Kouture theme (light + dark tokens)
supabase/migrations       SQL schema + RLS + guards
supabase/tests            security tests (bun run test:db)
tests/unit                Vitest
```

## Adding a module

1. Migration: a table in `life` or `kouture` with `owner_id`, RLS, grants and the audit trigger, then `bun run db:bundle`. The catalog test checks RLS, grants and auditing on every table automatically.
2. Add the record type to `src/server/entities/definitions.ts` (row + input Zod schemas, paths, refs). Both data paths and the generic create/update/delete actions pick it up automatically. Add sample rows to the demo seed.
3. Pure calculations in `features/<domain>/lib` with unit tests.
4. Loader and actions in `features/<domain>/server`.
5. Page under `src/app/(app)/...`; remove `comingInPhase` from its entry in `src/config/nav-config.ts`.

## Commands

```bash
bun run dev | build | typecheck | lint | test | test:db
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
