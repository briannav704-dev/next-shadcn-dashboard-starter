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

1. Migration: a table in `life` or `kouture` with `owner_id`, RLS, grants and the audit trigger. Add a security test.
2. DTO and repository methods in `src/server/data/types.ts`, implemented in both `supabase-repos.ts` and `demo-store.ts`.
3. Pure calculations in `features/<domain>/lib` with unit tests.
4. Loader and actions in `features/<domain>/server`.
5. Page under `src/app/(app)/...`; remove `comingInPhase` from its entry in `src/config/nav-config.ts`.

## Commands

```bash
bun run dev | build | typecheck | lint | test | test:db
```
