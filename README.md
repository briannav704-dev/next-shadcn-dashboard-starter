# Kouture Life OS

A private, luxury operating system for one owner, with two environments:

- **My Life:** planner, calendar, tasks, habits, money, wellness, goals and journal
- **Kouture Nail Bar:** clients, appointments, services, revenue and profit, inventory, marketing, and a semi-autonomous **AI management team** that proposes and never acts without your approval

Built with Next.js 16, Supabase (Postgres, Auth, Row Level Security), shadcn/ui and Tailwind v4.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Repository review and architecture | Done, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 2 | Design system, auth, data layer, dashboards, approvals, audit log | Done |
| 3 | My Life modules: planner, calendar, tasks, habits, budget, savings, fitness, workouts, meals, travel, self-care, goals, journal | Done |
| 4 | Kouture business modules: appointments with Nailzy calendar sync, clients and notes, services, revenue and expenses, profit reports, analytics, inventory, marketing calendar, social planner, retention, policies | Done |
| 5 | AI management team | Next |
| 6 | Integrations and approval executor | |
| 7 | Security testing, backups, deployment | |

## Quick start

```bash
bun install
cp .env.example .env.local
bun run dev
```

Going live: [docs/SETUP-IPAD.md](docs/SETUP-IPAD.md) (iPad, no computer needed) or [docs/SETUP.md](docs/SETUP.md).

## Security at a glance

- One owner account, enforced in the database
- Row Level Security on every table; no service-role key in the app
- Business agents are database-restricted to business data, and the personal assistant to personal data
- Every outward action (message, post, appointment change, refund, purchase) waits in **Approvals**
- Append-only audit log of every change, by you or an agent
- No secrets in the repository (`.env*` is git-ignored)

## Credits

Built on [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) by Kiranism (MIT). See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
