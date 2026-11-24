# Setup

## Preview locally with sample data

```bash
bun install
cp .env.example .env.local     # KOUTURE_DEMO_MODE=true is already set
bun run dev                    # http://localhost:3000 → "Enter preview"
```

Sample data lives in memory and resets when the server restarts. Sample mode is ignored by production builds.

## Go live

**On an iPad?** Follow [SETUP-IPAD.md](SETUP-IPAD.md): same steps, written for Safari.

### 1. Supabase (database + sign-in)

1. Create an account at supabase.com and a project named `kouture-life-os`. Pick a strong database password and store it in your password manager.
2. **SQL Editor:** paste the whole of `supabase/setup.sql` (all migrations bundled) and run it once.
3. **Project Settings → API → Exposed schemas:** add `core`, `life` and `kouture`.
4. **Authentication → Sign In / Providers:**
   - Email: enabled. Turn **off** "Allow new users to sign up" *after* your first sign-in. The database already refuses a second account, but this closes the door earlier.
5. **Authentication → URL Configuration:**
   - Site URL: your app URL (e.g. `https://kouture.vercel.app`)
   - Redirect URLs: `https://kouture.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
6. **Project Settings → API:** copy the Project URL and the **anon/publishable** key. Do **not** use the `service_role` key anywhere in this app.
7. Before going live, upgrade to **Pro** for daily backups and point-in-time recovery.

### 2. Vercel (hosting)

1. Sign up at vercel.com with GitHub and import this repository.
2. Environment variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OWNER_EMAIL`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
   - `NAILZY_BOOKING_URL` (optional; defaults to the public Kouture Nailzy page)
   - Do **not** set `KOUTURE_DEMO_MODE` in Vercel.
3. Deploy, open `/login`, and enter your owner email.

### 3. Anthropic (Phase 5)

Create an account at console.anthropic.com, add credit, and **set a monthly spend limit**. The key is added in Phase 5. It stays server-side and is never committed.

## Checks

```bash
bun run typecheck
bun run lint
bun run test      # unit tests
bun run test:db   # checks setup.sql is current, applies it, runs database security tests
bun run db:bundle # rebuild supabase/setup.sql after adding a migration
```
