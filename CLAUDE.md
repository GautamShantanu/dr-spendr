# CLAUDE.md — Spendr

Project context for Claude Code. Place this file at the **repository root**. It is
loaded automatically at the start of every session.

---

## What this is

**Spendr** — a personal **and** shared expense tracker. A single-page React app,
deployed as a static site on Vercel, backed by Supabase (Postgres + Auth + Realtime).
Designed to be installed on iPhone via Safari → "Add to Home Screen" (it's a PWA).

Core idea: **buckets**. A bucket is a spending space with its own expenses,
categories, and people. A bucket is *personal* until its owner invites others by
email, at which point it becomes *shared* (e.g. a couple's "Joint" bucket). Every
expense belongs to exactly one bucket. Users can belong to many buckets and switch
between them in the header.

Currency is **INR (₹)** throughout. Audience: India. Single primary user + people
they invite (small scale — not a public multi-tenant SaaS).

---

## Tech stack (do not swap without good reason)

- **React 18** + **Vite 6** (plain JS/JSX, no TypeScript)
- **Tailwind CSS v4** via the `@tailwindcss/vite` plugin — **core utility classes only**
  (no config file, no custom theme; styles live in `src/index.css` as `@import "tailwindcss";`)
- **@supabase/supabase-js v2** — database, auth, realtime
- **Recharts** — donut (category breakdown) + bar (6-month trend) charts
- **lucide-react** — all icons
- No other UI/component libraries. No state-management library (React state only).

## Commands

```bash
npm install          # install deps
npm run dev          # local dev server (http://localhost:5173)
npm run build        # production build to dist/
npm run preview      # preview the production build
```

There is no test suite or linter configured yet. The build (`npm run build`) is the
de-facto correctness check — keep it green.

## Environment variables

Required (read at **build time** by Vite, so a change needs a redeploy):

| Name | Purpose |
|------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

Local: `.env` (gitignored; see `.env.example`). Production: set in Vercel → Project
Settings → Environment Variables. The app shows a `ConfigScreen` if either is missing.
**Never commit `.env` or paste real keys into source.**

---

## Project layout

```
.
├── index.html                 # PWA meta tags (apple-touch-icon, manifest, theme-color, viewport-fit=cover)
├── vite.config.js             # react() + tailwindcss() plugins
├── schema.sql                 # FULL database schema + RLS + realtime — run once in Supabase SQL Editor
├── .env.example
├── public/
│   ├── manifest.webmanifest   # PWA manifest (standalone display)
│   ├── icon-192.png / icon-512.png / apple-touch-icon.png
└── src/
    ├── main.jsx               # React entry
    ├── index.css              # @import "tailwindcss";
    ├── supabaseClient.js      # exports `supabase` client + `isConfigured` flag
    └── App.jsx                # EVERYTHING else lives here (~one-file app, intentional)
```

`App.jsx` is deliberately one large file (the user prefers a single-file app). It
contains: auth screen, bucket switcher, manage/share modal, quick-add form, dashboard,
transactions list, settings, and the root `App` component with all data logic. Keep
new UI in this file unless it grows unmanageable; if splitting, keep `App.jsx` as the
orchestrator.

---

## Data model (Supabase / Postgres)

Defined in `schema.sql`. Four tables, all with Row Level Security enabled:

- **buckets** — `id` (uuid pk), `name`, `emoji`, `owner_id` → `auth.users`, `created_at`
- **bucket_members** — `id`, `bucket_id` → buckets (cascade), `email` (lowercased),
  `user_id` → auth.users (nullable), `role` (`'owner'` | `'member'`), `created_at`,
  `unique(bucket_id, email)`
- **bucket_settings** — `bucket_id` (pk) → buckets (cascade), `categories` (jsonb),
  `people` (jsonb), `updated_at`. One row per bucket; holds custom categories and the
  "paid by" people list.
- **expenses** — `id`, `bucket_id` → buckets (cascade), `user_id` → auth.users
  (cascade, = creator), `amount` (numeric ≥ 0), `category` (text = category id),
  `description`, `date`, `method` (`cash`|`card`|`upi`|`other`), `paid_by` (text),
  `created_at`

App ↔ DB field mapping: DB `paid_by` ↔ app `paidBy` (see `rowToExpense`). Categories
are stored by their string `id` on each expense; the human label/emoji/color come from
`bucket_settings.categories`.

### RLS — the privacy model (important)

Access is computed by two **SECURITY DEFINER** helper functions (they bypass RLS
internally, which **avoids infinite recursion** in policies — do not inline these
lookups into policies):

- `my_bucket_ids()` → all bucket ids the current user can access, matched by
  `user_id = auth.uid()` **OR** `lower(email) = lower(jwt email)`.
- `is_bucket_owner(bucket_id)` → boolean.

Consequences to respect when changing anything:
- A user sees a bucket if they own it **or** are a member by email. **Email-based
  invites work before the invitee has an account** — they gain access the moment they
  sign in with the matching email (the JWT email claim matches the invite row).
- Emails are **always stored and compared lowercased**.
- Members can read/write expenses + settings in their buckets (collaborative model).
  Only the **owner** can rename, manage members, or delete a bucket.
- Realtime publication includes `expenses`, `bucket_settings`, `bucket_members`.

If you add a table that holds user data, enable RLS and gate it with
`bucket_id in (select my_bucket_ids())` (or an equivalent owner check). Never ship a
table with RLS off.

---

## Key behaviors & conventions (match these)

- **Auth:** email + password (primary), Google OAuth (optional — needs Google Cloud +
  Supabase config; the button degrades gracefully if not set up). On the Supabase side,
  "Confirm email" is intentionally **disabled** for friction-free personal use.
- **Display name & "paid by":** a user's name lives in Supabase auth user metadata
  (`display_name`), defaulting to the email prefix. In the quick-add form, `paidBy`
  defaults to the **user's name (not "Me")** so the "Who paid" summary is unambiguous
  in shared buckets. When an expense is saved, its `paid_by` value is auto-added to the
  bucket's `people` list (`ensurePerson`).
- **First login** auto-creates a default **"Personal"** bucket. Bucket creation MUST
  insert in this order due to RLS dependencies: **bucket → owner membership row →
  settings row**.
- **Settings persistence:** `categories`/`people` are written with a **debounced
  (400 ms) upsert**, guarded by a `settingsHydrated` ref so the initial load doesn't
  immediately write back. Don't remove the guard.
- **Sync across devices:** on the selected bucket, the app subscribes to realtime
  `postgres_changes` on `expenses` (filtered by `bucket_id`) and also refetches on
  `visibilitychange`. Keep both — they make shared buckets feel live.
- **Optimistic UI:** add prepends the returned row; delete removes then rolls back on
  error. All Supabase calls are wrapped in try/catch with a small toast on failure.
- **Backup:** Settings → Backup offers Export/Import JSON per bucket (because the free
  Supabase tier has no automatic backups). Keep this feature working.
- **No browser storage in app code.** Do not use `localStorage`/`sessionStorage`
  directly. (The Supabase client manages its own session persistence internally — that's
  expected and fine.)

## Design language (keep it consistent)

- Calm, modern **fintech** aesthetic. Palette: slate neutrals + **emerald** accent;
  category colors from the `PALETTE` array. Rounded-2xl cards, soft borders, subtle
  shadows. Numbers should be glanceable.
- **Mobile-first.** Bottom tab nav on mobile, top nav on desktop. Respect
  `env(safe-area-inset-bottom)`. Forms must be fast (quick-add logs in seconds).
- Money formatting via `fmtINR` / `fmtINRshort` (₹, en-IN, lakh/crore short forms).
  Always use these helpers — don't format currency inline.

---

## Decisions already made (don't relitigate without reason)

- **Supabase over plain localStorage:** the app needs multi-device sync, which
  localStorage can't do (single-device only).
- **Supabase over Neon:** Spendr is a *backend-platform* problem (auth + RLS privacy +
  realtime), not a pure-database one. Neon is database-only and would require bolting on
  a separate auth provider + realtime. The Postgres layer in `schema.sql` is portable to
  Neon if ever needed, but auth/realtime would have to be rebuilt — not worth it here.
- **anon key in the frontend is fine:** it's designed to be public; data is protected by
  RLS + the user's login, not by hiding the key.
- **Single-file `App.jsx`:** intentional, per user preference.
- Hosting is **Vercel** (free Hobby tier), deployed from a **GitHub** repo.

## Known limitations / gotchas

- **Free Supabase tier pauses after ~7 days of inactivity** (wakes on next visit) and
  has **no automatic backups** → hence the Export/Import feature; nudge the user to use it.
- The production JS bundle is ~840 KB (Recharts is the bulk). This triggers Vite's
  chunk-size warning — it's only a warning and acceptable for a personal app. Don't add
  a build step to "fix" it unless asked.
- The full live flow (running `schema.sql`, real signups, cross-device sync) has not been
  end-to-end tested in an automated environment — treat the first real run as the test.
- Google OAuth is coded but **not configured** by default; don't assume it works until
  the user has set up the Google Cloud client + Supabase redirect URLs.

## Possible next steps (not yet done)

- Finish Google OAuth setup (or remove the button if unwanted).
- Per-bucket budgets / monthly limits with alerts.
- CSV export (in addition to JSON).
- Recurring expenses.
- Split-aware "who owes whom" settlement math for shared buckets (currently it only
  *reports* who paid, it doesn't compute settlements).

---

## Working agreements for Claude Code

- After any change, run `npm run build` and keep it passing.
- Preserve the RLS model and the SECURITY DEFINER helper pattern — security-sensitive.
- Don't introduce new dependencies casually; this stack is intentionally small.
- Don't hardcode secrets; use the `VITE_` env vars.
- Match the existing design tokens and the `fmtINR` formatting helpers.
- When unsure about Supabase/Vercel/Claude Code product specifics, check current docs
  rather than assuming — these change.
