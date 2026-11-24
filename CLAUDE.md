# CLAUDE.md

Kouture Life OS: a single-owner personal + business OS (Next.js 16, Supabase, shadcn/ui on Base UI, Tailwind v4). Read [AGENTS.md](./AGENTS.md) and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) first.

## Non-negotiables

- **Auth is Supabase**, not Clerk. Any older starter docs or skills that mention Clerk are out of date.
- Pages call `requireOwnerPage()` and server actions call `requireOwnerAction()` (`src/server/session.ts`). Actions validate input with Zod through `runAction()`.
- Data access goes through repositories (`src/server/data`). Keep the Supabase and sample-data implementations in sync, including their rules.
- **Never** use the Supabase `service_role` key in app code. Every new table needs `owner_id`, RLS, grants that keep `life` and `kouture` apart, and the `core.audit_row_change()` trigger. Add a case to `supabase/tests/10_security.test.sql`.
- Agents never perform outward or irreversible actions directly. They create a `core.approvals` row.
- "Today" comes from `todayKey(profile.timezone)` (`src/lib/dates.ts`), never from UTC.
- Money is integer cents; format with `formatCents`.
- Icons only via `@/components/icons`. Colours via theme tokens (`text-rose`, `bg-blush`, `text-gold-ink`, …). Charts use `--chart-1..3`, which are validated for colour-blind safety.
- Formatting: single quotes, JSX single quotes, no trailing commas, 2 spaces.

## Checks before committing

`bun run typecheck && bun run lint && bun run test && bun run test:db`
