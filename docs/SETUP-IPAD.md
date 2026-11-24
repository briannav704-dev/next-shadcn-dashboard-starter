# Go live from your iPad

About 30 minutes, all in Safari. No computer or Terminal needed. You'll set up three free accounts:

| | What it does |
|---|---|
| **Supabase** | Your private database and sign-in |
| **Vercel** | Hosts the app at a web address |
| **GitHub** | Where the code already lives (you have this) |

> **Never paste passwords or keys into a chat**, including with Claude. They only go into the Supabase and Vercel settings screens below.

---

## Part 1 — Supabase (database)

1. In Safari, go to **supabase.com** and tap **Start your project**. Choose **Continue with GitHub**.
2. Tap **New project**:
   - **Name:** `kouture-life-os`
   - **Database password:** tap **Generate a password**, then save it in your iPad **Passwords** app.
   - **Region:** the one closest to you (e.g. *East US*)
   - **Plan:** Free (upgrade to Pro before you rely on it daily; Pro includes daily backups)
   - Tap **Create new project** and wait about 2 minutes.
3. **Copy the setup file.** In a new Safari tab:
   - Open **github.com/briannav704-dev/next-shadcn-dashboard-starter**.
   - Tap the branch menu (it says `main`) and choose the **Kouture** branch (`claude/…`).
   - Open the **supabase** folder, then **setup.sql**.
   - Tap the **Copy raw file** button (two overlapping squares, top-right of the file).
4. **Run it.** Back in Supabase:
   - Left menu → **SQL Editor** → **New query**.
   - Long-press in the editor → **Paste** → tap **Run**.
   - You should see **"Success. No rows returned."** Run it only once.
5. **Turn on the app's data areas.** Left menu → **Project Settings** → **Data API**. Under **Exposed schemas**, add **core**, **life** and **kouture** (keep `public`), then tap **Save**.
6. **Get the two connection values** (Project Settings → **API Keys** / **Data API**):
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon / publishable key** (a long string)

   Keep this tab open; you'll copy them into Vercel next. Do **not** use the `service_role` / secret key anywhere.

## Part 2 — Vercel (hosting)

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub** (Hobby / free plan).
2. Tap **Add New… → Project** and **Import** `next-shadcn-dashboard-starter`.
3. Before deploying, open **Environment Variables** and add these four:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key |
   | `OWNER_EMAIL` | the email you'll sign in with |
   | `NEXT_PUBLIC_SENTRY_DISABLED` | `true` |

   Optional, any time later: `NAILZY_CALENDAR_URL` (your Nailzy bookings). The app's
   **Appointments → Show me how** page walks you through finding it.

4. Tap **Deploy**. When it finishes you'll get an address like `kouture-life-os.vercel.app`.
5. Vercel deploys `main` automatically; every merged update redeploys on its own.

## Part 3 — Connect sign-in

1. In Supabase: **Authentication → URL Configuration**
   - **Site URL:** your Vercel address, e.g. `https://kouture-life-os.vercel.app`
   - **Redirect URLs** → Add: `https://kouture-life-os.vercel.app/auth/callback`
2. Open your Vercel address in Safari, enter your owner email, and tap the link in the email.
3. **After you're in:** Supabase → **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up". Your account is the only one. The database would refuse a second one anyway; this just closes the door earlier.

## Part 4 — Make it an app

In Safari on your iPad and iPhone, open your Vercel address and tap **Share** → **Add to Home Screen**. It opens full-screen with the Kouture icon.

---

### Updating the database later

`supabase/setup.sql` is for a brand-new project. If you already ran it and a later
update adds a file in `supabase/migrations/`, paste only the new file(s) into the SQL
Editor, oldest first, and run them once.

### If something goes wrong

| You see | Do this |
|---|---|
| "Almost ready" page | A Vercel environment variable is missing or misspelled. Fix it, then **Redeploy**. |
| The sign-in email never arrives | Check spam. Supabase's free email allows only a few emails per hour, so wait a few minutes. |
| "That sign-in link was invalid or expired" | Request a new link. Make sure the Redirect URL in Part 3 matches your address exactly. |
| Pages say "This page didn't load" | Check step 5 of Part 1 (Exposed schemas: core, life, kouture). |
| The SQL said "already exists" | It was run twice; nothing is broken. |
