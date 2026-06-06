-- =====================================================================
-- Spendr — database schema
-- Run this ONCE in your Supabase project:  SQL Editor → New query → paste
-- everything below → Run.  It is safe to re-run.
-- =====================================================================

-- ---------- Tables ----------

-- A "bucket" is a spending space. It can be personal (just you) or shared
-- (you invite others by email). Every expense belongs to exactly one bucket.
create table if not exists public.buckets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Untitled',
  emoji      text default '💼',
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Who can access a bucket. Invites are stored by email; access is granted as
-- soon as that person signs in with the matching email (see my_bucket_ids()).
create table if not exists public.bucket_members (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  uuid not null references public.buckets(id) on delete cascade,
  email      text not null,
  user_id    uuid references auth.users(id) on delete set null,
  role       text not null default 'member',  -- 'owner' | 'member'
  created_at timestamptz not null default now(),
  unique (bucket_id, email)
);

-- Per-bucket settings: custom categories and the people list (for "paid by").
create table if not exists public.bucket_settings (
  bucket_id  uuid primary key references public.buckets(id) on delete cascade,
  categories jsonb not null default '[]'::jsonb,
  people     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- The expenses themselves.
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   uuid not null references public.buckets(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      numeric not null check (amount >= 0),
  category    text not null default 'other',
  description text default '',
  date        date not null default current_date,
  method      text not null default 'upi',
  paid_by     text not null default 'Me',
  created_at  timestamptz not null default now()
);

create index if not exists expenses_bucket_idx on public.expenses(bucket_id);
create index if not exists members_email_idx   on public.bucket_members (lower(email));

-- ---------- Helper functions (SECURITY DEFINER avoids RLS recursion) ----------

-- All bucket ids the current user may access (owns or is invited to by email).
create or replace function public.my_bucket_ids()
returns setof uuid
language sql security definer set search_path = public stable
as $$
  select bucket_id from public.bucket_members
  where user_id = auth.uid()
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Is the current user the owner of bucket b?
create or replace function public.is_bucket_owner(b uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (select 1 from public.buckets where id = b and owner_id = auth.uid())
$$;

-- ---------- Row Level Security ----------

alter table public.buckets         enable row level security;
alter table public.bucket_members  enable row level security;
alter table public.bucket_settings enable row level security;
alter table public.expenses        enable row level security;

-- buckets
drop policy if exists buckets_select on public.buckets;
create policy buckets_select on public.buckets for select
  using (owner_id = auth.uid() or id in (select public.my_bucket_ids()));
  -- owner_id check matters: the app creates a bucket with insert+returning
  -- BEFORE the membership row exists, and RETURNING must pass this policy.

drop policy if exists buckets_insert on public.buckets;
create policy buckets_insert on public.buckets for insert
  with check (owner_id = auth.uid());

drop policy if exists buckets_update on public.buckets;
create policy buckets_update on public.buckets for update
  using (public.is_bucket_owner(id)) with check (public.is_bucket_owner(id));

drop policy if exists buckets_delete on public.buckets;
create policy buckets_delete on public.buckets for delete
  using (public.is_bucket_owner(id));

-- bucket_members
drop policy if exists members_select on public.bucket_members;
create policy members_select on public.bucket_members for select
  using (bucket_id in (select public.my_bucket_ids()));

drop policy if exists members_insert on public.bucket_members;
create policy members_insert on public.bucket_members for insert
  with check (public.is_bucket_owner(bucket_id));

drop policy if exists members_update on public.bucket_members;
create policy members_update on public.bucket_members for update
  using (public.is_bucket_owner(bucket_id)
         or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (true);

drop policy if exists members_delete on public.bucket_members;
create policy members_delete on public.bucket_members for delete
  using (public.is_bucket_owner(bucket_id)
         or user_id = auth.uid()
         or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- bucket_settings
drop policy if exists settings_all on public.bucket_settings;
create policy settings_all on public.bucket_settings for all
  using (bucket_id in (select public.my_bucket_ids()))
  with check (bucket_id in (select public.my_bucket_ids()));

-- expenses
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select
  using (bucket_id in (select public.my_bucket_ids()));

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert
  with check (bucket_id in (select public.my_bucket_ids()) and user_id = auth.uid());

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update
  using (bucket_id in (select public.my_bucket_ids()))
  with check (bucket_id in (select public.my_bucket_ids()));

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete
  using (bucket_id in (select public.my_bucket_ids()));

-- ---------- Realtime (so shared buckets update live across devices) ----------

do $$ begin
  alter publication supabase_realtime add table public.expenses;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.bucket_settings;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.bucket_members;
exception when duplicate_object then null; end $$;

-- Done.
