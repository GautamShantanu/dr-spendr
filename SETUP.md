# Spendr — Setup Guide

A personal **and** shared expense tracker. Each "bucket" is a spending space:
keep a **Personal** one for yourself and a **Joint** one you share with your wife
(or anyone) by email. Login is email + password (Google optional). Free to run on
Vercel + Supabase.

Total time: ~20 minutes. No coding required — just copy/paste.

---

## What you'll set up

1. **Supabase** — a free cloud database that stores your expenses and enforces
   privacy (only you + people you invite can see a bucket).
2. **Vercel** — free hosting that turns this code into a real website/app.
3. **iPhone** — "Add to Home Screen" so it behaves like an installed app.

---

## Step 1 — Create the database (Supabase)

1. Go to **https://supabase.com** → sign up (free) → **New project**.
   - Pick any name, set a strong database password (you won't need it again), choose
     the region closest to you (e.g. Mumbai / Singapore for India), create it.
2. Wait ~2 minutes for it to finish provisioning.
3. In the left sidebar open **SQL Editor** → **New query**.
4. Open the file **`schema.sql`** from this project, copy **everything**, paste it
   into the editor, and click **Run**. You should see "Success. No rows returned."
   This creates all tables, the privacy rules, and live-sync.
5. Turn off email confirmation (so you and your wife can sign in instantly without
   email setup): left sidebar **Authentication** → **Sign In / Providers** →
   **Email** → turn **OFF** "Confirm email" → Save.

### Get your two keys
Left sidebar → **Project Settings** (gear) → **API**. Copy:
- **Project URL** (looks like `https://abcd1234.supabase.co`)
- **anon public** key (a long string — this one is safe to ship in a frontend app;
  your data is still protected by the privacy rules and your password)

Keep these two values handy for Step 3.

> The `anon` key is **meant** to be public. Your expenses are protected by Row Level
> Security (in `schema.sql`) + your login — not by hiding the key.

---

## Step 2 — Put the code on GitHub

Vercel deploys from a GitHub repo and rebuilds automatically when you change anything.

1. Create a free account at **https://github.com** if you don't have one.
2. Click **New repository** → name it `spendr` → **Private** → Create.
3. On the next page choose **"uploading an existing file"** and drag in **all** the
   files from this project folder (the whole thing: `src/`, `public/`, `index.html`,
   `package.json`, `vite.config.js`, etc.). Commit.

*(Prefer the command line? `git init && git add . && git commit -m "spendr"` then push
to your new repo. Either way is fine.)*

---

## Step 3 — Deploy on Vercel (free)

1. Go to **https://vercel.com** → sign up with your GitHub account.
2. **Add New… → Project** → **Import** your `spendr` repo.
3. Vercel auto-detects Vite — leave the build settings as they are.
4. Expand **Environment Variables** and add these two (from Step 1):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |

5. Click **Deploy**. After ~1 minute you'll get a URL like
   `https://spendr-xxxx.vercel.app`. Open it — you should see the sign-in screen.

> If you ever change the env vars, hit **Redeploy** in Vercel (they're read at build time).

---

## Step 4 — Create accounts & your buckets

1. On your Vercel URL, click **Create account**, enter your name + email + password.
2. You'll land in a default **Personal** bucket.
3. Tap the bucket name (top-left) → **New bucket** → name it e.g. **Joint**.
4. In the **Joint** bucket, tap the bucket name → **Share / manage this bucket** →
   invite your wife by her email.
5. Your wife opens the same Vercel URL, creates an account **with that same email**,
   and the Joint bucket appears for her automatically. Anything either of you adds
   shows up for both — live.

Use the **Personal** bucket for your own expenses, the **Joint** bucket for shared
ones. In the Joint bucket, "paid by" defaults to your name, so the **Who paid**
summary clearly shows how much each of you covered.

### Roles, payees & splits

When inviting someone to a bucket you pick their role:

- **Manager** — can add/edit/delete expenses (the default; right for your wife).
- **Viewer** — sees everything, can change nothing.
- **Payee** — sees **only the payments made to them** (see below).

Other features useful for projects like building a house:

- **Paid to (payee):** every expense can optionally record who was paid — a
  contractor, an electrician, a materials vendor. Manage the list under
  **Manage → Payees** (new names typed on an expense are added automatically).
  The dashboard gets a **Paid to** panel totalling payments per vendor.
- **Payee access:** payees normally don't need an account — they're just names.
  But if you want e.g. your contractor to see a live record of what he's been
  paid, invite his email with role **Payee** and link it to his payee name. He
  signs in and sees only his own payments — nothing else. Enforced by the
  database, not just the UI.
- **Splits:** tick **Split this expense** to divide an expense between the
  people in the bucket with custom shares ("Split equally" fills them in one
  tap). The dashboard's **Balances** panel then shows who owes whom.

---

## Step 5 — Install on your iPhone 14

1. Open your Vercel URL in **Safari** (must be Safari for install to work).
2. Tap the **Share** icon → **Add to Home Screen** → **Add**.
3. You now have a **Spendr** icon that opens full-screen like a native app, stays
   logged in, and syncs across every device you and your wife install it on.

---

## (Optional) Google sign-in

Email + password works out of the box. To add the "Continue with Google" button:

1. In **Supabase → Authentication → Sign In / Providers → Google**, toggle it on.
   It shows a **Callback URL** — copy it.
2. In **Google Cloud Console** (https://console.cloud.google.com): create an OAuth
   2.0 Client ID (type: Web application). Under **Authorized redirect URIs**, paste
   the Supabase Callback URL from step 1. Copy the generated **Client ID** and
   **Client secret**.
3. Paste those into the Google provider settings in Supabase → Save.
4. Also add your Vercel URL under **Supabase → Authentication → URL Configuration →
   Redirect URLs** (e.g. `https://spendr-xxxx.vercel.app`).

The Google button will then work. Until configured, it shows a friendly note and you
can use email + password.

---

## Backups (important)

The free Supabase tier has **no automatic backups**, and pauses a project after ~1
week of zero activity (just reopen the app to resume). So occasionally:

- Open **Manage → Backup → Export JSON** to save a copy of a bucket's expenses.
- **Import** restores from that file.

---

## Running locally (optional, for tinkering)

```bash
npm install
cp .env.example .env      # then paste your two Supabase values into .env
npm run dev               # opens http://localhost:5173
```

---

## Free-tier limits (you won't hit these)

- **Vercel Hobby:** ~100 GB bandwidth/month — sized for ~100k visitors. A personal
  app uses a tiny fraction.
- **Supabase Free:** 500 MB database (millions of expense rows), unlimited API
  requests, pauses after a week idle (reopen to resume).

Everything here is free and yours — independent of any work/company account.
