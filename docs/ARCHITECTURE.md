# Architecture

Kouture Life OS is one Next.js app with two environments, **My Life** (personal) and **Kouture Nail Bar** (business), plus an AI management team that works only on the business side.

## Decisions (Phase 1)

| Reference | What we took | What we left |
|---|---|---|
| `next-shadcn-dashboard-starter` (MIT) | The base: Next.js 16, shadcn/ui on Base UI, Tailwind v4, TanStack Query/Form, Sentry, Recharts | Clerk auth, demo features, multi-theme switcher, Docker files |
| `jakebrm/personal-os` (MIT) | Module ideas: habits with streaks, goals with progress, journal, timezone-correct "today" | Shared-password auth, `user_id = 'owner'` text tags, service-role key in app code |
| `gobeyondfj-cmd/agent-company-ai` (MIT) | Ideas only: YAML-style role definitions, delegation, `report_result`, cost caps, a human-approval queue | All code (Python/SQLite). Its email and social tools act without approval, it ships shell/code-exec tools, and its dashboard has no auth |
| `cal.diy` (MIT) | Reference for appointment and availability modeling (Phase 4) | Not merged; too large |
| `twenty` (AGPL) | UI ideas only | No code copied (license) |

## Layout

```
src/
  app/
    (app)/life, (app)/kouture   environment dashboards (behind the owner check)
    (app)/approvals, activity   shared oversight
    login, setup, auth/callback
  features/<domain>/
    lib/        pure logic (unit tested)
    server/     loaders + server actions ('use server', validated with Zod)
  server/entities/
    definitions.ts  one Zod definition per record type (shared by both data paths)
    supabase-collection.ts / demo-collection.ts  the two implementations
  components/entity  config-driven add/edit dialog, row actions, check toggles
    components/
  server/
    env.ts          validated env; decides supabase | demo | unconfigured
    session.ts      requireOwnerPage / requireOwnerAction
    data/           repository interfaces + Supabase and sample-data implementations
supabase/
  migrations/   schema, RLS, roles, audit and approval guards
  tests/        security tests run against a real Postgres
```

Pages never touch tables directly. They call `requireOwnerPage()`, which returns the session and repositories; components receive plain DTOs (`src/server/data/types.ts`).

## Security model

- **One owner.** Sign-in is a Supabase magic link, accepted only for `OWNER_EMAIL`. A database trigger refuses any second account, even if sign-ups are left on by mistake.
- **No service-role key in the app.** Every query runs as the signed-in owner under Row Level Security (`owner_id = auth.uid()` on every table).
- **Three schemas.** `life` (personal), `kouture` (business) and `core` (profiles, approvals, audit).
- **Agents get their own database roles.** `kouture_agent` is granted `kouture` only, and `life_assistant` is granted `life` only. A prompt-injected agent can't read the other side, because the database refuses it.
- **Approvals.** Agents can only *insert* a pending request into `core.approvals`. The payload is frozen at creation, only the owner can approve or decline, transitions are one-way (`pending → approved/rejected → executed/failed`), and requests expire after 7 days.
- **Audit log.** Triggers log every insert, update and delete on every data table, with the actor (owner, agent key, or system) taken from the signed JWT. The log is append-only for every role, including `service_role`.
- **Sample mode** works only in non-production builds, and never when Supabase is configured.

Run `bun run test:db` to apply the migrations to a throwaway Postgres and attack these rules.

## Phase roadmap

1. ✅ Inspect references, propose architecture
2. ✅ Design system, auth, data layer, dashboards, approvals inbox, audit log
3. ✅ My Life modules: planner, calendar, tasks, habits, budget, savings, fitness, workouts, meals, travel, self-care, goals, journal
4. ✅ Kouture modules: client CRM and notes, appointments (Nailzy bookings read from the Google Calendar iCal feed Nailzy syncs to), services, revenue/expenses/profit, inventory, marketing and social calendars, retention, analytics, policies
5. ✅ AI management team (rule-based first, no AI service; agents write only through `kouture.agent_file()`, which attributes each change to the agent in the audit log; an optional AI brain plugs in later): seven Kouture agents plus a personal assistant, each with a role, a scoped toolset, its own chat, task history and collaboration via the CEO
6. Integrations and executor: Stripe (deposits, refunds), Twilio SMS (10DLC, consent and STOP), Resend email (CAN-SPAM), Instagram, Nailzy. The executor runs only approved, unexpired requests, once
7. Security testing (RLS, prompt-injection, dependency audit), backups and restore drill, deployment
