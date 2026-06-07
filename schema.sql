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
  role       text not null default 'manager',  -- 'owner' | 'manager' | 'viewer' | 'payee'
  payee_name text,                             -- for role 'payee': which payee they are
  display_name text,                           -- set when the invitee signs in (claim_memberships)
  created_at timestamptz not null default now(),
  unique (bucket_id, email)
);

-- Per-bucket settings: custom categories, the people list (for "paid by"),
-- and the payees list (vendors/contractors, for "paid to").
create table if not exists public.bucket_settings (
  bucket_id  uuid primary key references public.buckets(id) on delete cascade,
  categories jsonb not null default '[]'::jsonb,
  people     jsonb not null default '[]'::jsonb,
  payees     jsonb not null default '[]'::jsonb,
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
  paid_to     text not null default '',   -- optional payee/vendor (e.g. a contractor)
  split       jsonb,                      -- optional custom shares: {"Name": amount, ...}
  attachments jsonb not null default '[]'::jsonb,  -- up to 2 receipt photo paths in storage
  created_at  timestamptz not null default now()
);

-- Upgrades for databases created before these columns existed (no-ops on fresh installs).
alter table public.expenses        add column if not exists paid_to text not null default '';
alter table public.expenses        add column if not exists split jsonb;
alter table public.expenses        add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.bucket_settings add column if not exists payees jsonb not null default '[]'::jsonb;
alter table public.bucket_members  add column if not exists payee_name text;
alter table public.bucket_members  add column if not exists display_name text;
update public.bucket_members set role = 'manager' where role = 'member';

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

-- The current user's role in bucket b: 'owner' | 'manager' | 'viewer' | 'payee' | null.
-- (legacy 'member' rows count as 'manager')
create or replace function public.my_role(b uuid)
returns text
language sql security definer set search_path = public stable
as $$
  select case
    when exists (select 1 from public.buckets where id = b and owner_id = auth.uid()) then 'owner'
    else (
      select case when role = 'member' then 'manager' else role end
      from public.bucket_members
      where bucket_id = b
        and (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      limit 1
    )
  end
$$;

-- For a 'payee' member of bucket b: the payee name they're linked to.
create or replace function public.my_payee_name(b uuid)
returns text
language sql security definer set search_path = public stable
as $$
  select payee_name from public.bucket_members
  where bucket_id = b and role = 'payee'
    and (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  limit 1
$$;

-- Called by the app on every load: links any invites matching the signed-in
-- email to the account (user_id), records the display name (turns "Invited"
-- into "Active"), and auto-adds the new member to the bucket's payer list
-- (except payee-role members, who don't record payments).
create or replace function public.claim_memberships()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  dname text;
  r record;
begin
  select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name')
  into dname from auth.users u where u.id = auth.uid();

  for r in
    update public.bucket_members m
    set user_id = auth.uid(),
        display_name = coalesce(dname, split_part(m.email, '@', 1))
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (m.user_id is distinct from auth.uid() or m.display_name is null)
    returning m.bucket_id, m.role, coalesce(dname, split_part(m.email, '@', 1)) as nm
  loop
    if r.role <> 'payee' then
      update public.bucket_settings s
      set people = s.people || to_jsonb(r.nm), updated_at = now()
      where s.bucket_id = r.bucket_id
        and not exists (select 1 from jsonb_array_elements_text(s.people) p where lower(p) = lower(r.nm));
    end if;
  end loop;
end $$;

-- One-time backfill: members who already activated before the auto-add above
-- existed get their names added to the payer lists now (no duplicates).
update public.bucket_settings s
set people = s.people || sub.missing, updated_at = now()
from (
  select m.bucket_id, jsonb_agg(distinct m.display_name) as missing
  from public.bucket_members m
  join public.bucket_settings st on st.bucket_id = m.bucket_id
  where m.display_name is not null and m.role <> 'payee'
    and not exists (select 1 from jsonb_array_elements_text(st.people) p where lower(p) = lower(m.display_name))
  group by m.bucket_id
) sub
where sub.bucket_id = s.bucket_id;

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
  using (public.is_bucket_owner(bucket_id))
  with check (public.is_bucket_owner(bucket_id));
  -- owner only: otherwise a viewer/payee could change their own role

drop policy if exists members_delete on public.bucket_members;
create policy members_delete on public.bucket_members for delete
  using (public.is_bucket_owner(bucket_id)
         or user_id = auth.uid()
         or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- bucket_settings: everyone in the bucket can read; only owner/manager can write
drop policy if exists settings_all on public.bucket_settings;
drop policy if exists settings_select on public.bucket_settings;
create policy settings_select on public.bucket_settings for select
  using (bucket_id in (select public.my_bucket_ids()));

drop policy if exists settings_insert on public.bucket_settings;
create policy settings_insert on public.bucket_settings for insert
  with check (public.my_role(bucket_id) in ('owner','manager'));

drop policy if exists settings_update on public.bucket_settings;
create policy settings_update on public.bucket_settings for update
  using (public.my_role(bucket_id) in ('owner','manager'))
  with check (public.my_role(bucket_id) in ('owner','manager'));

drop policy if exists settings_delete on public.bucket_settings;
create policy settings_delete on public.bucket_settings for delete
  using (public.my_role(bucket_id) in ('owner','manager'));

-- expenses: owner/manager/viewer see everything; a 'payee' member sees ONLY
-- payments made to them; only owner/manager can add/edit/delete
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select
  using (
    public.my_role(bucket_id) in ('owner','manager','viewer')
    or (public.my_role(bucket_id) = 'payee'
        and lower(paid_to) = lower(coalesce(public.my_payee_name(bucket_id), '')))
  );

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert
  with check (public.my_role(bucket_id) in ('owner','manager') and user_id = auth.uid());

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update
  using (public.my_role(bucket_id) in ('owner','manager'))
  with check (public.my_role(bucket_id) in ('owner','manager'));

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete
  using (public.my_role(bucket_id) in ('owner','manager'));

-- ---------- Audit log ----------
-- Every insert/update/delete on the four data tables is recorded by a
-- trigger, with who did it and the before/after row. Owners, managers and
-- viewers of a bucket can read its log; nobody can write to it directly.

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  bucket_id   uuid,
  table_name  text not null,
  action      text not null,            -- 'insert' | 'update' | 'delete'
  actor       uuid,
  actor_email text,
  actor_name  text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_bucket_idx on public.audit_log (bucket_id, id desc);
alter table public.audit_log add column if not exists actor_name text;

create or replace function public.log_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  b uuid  := coalesce(
    (coalesce(n, o) ->> 'bucket_id')::uuid,
    case when tg_table_name = 'buckets' then (coalesce(n, o) ->> 'id')::uuid end);
begin
  insert into public.audit_log (bucket_id, table_name, action, actor, actor_email, actor_name, old_data, new_data)
  values (b, tg_table_name, lower(tg_op), auth.uid(), auth.jwt() ->> 'email',
          coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', auth.jwt() -> 'user_metadata' ->> 'full_name'),
          o, n);
  return coalesce(new, old);
end $$;

-- Backfill names on older log entries from known member display names.
update public.audit_log a
set actor_name = (
  select min(m.display_name) from public.bucket_members m
  where lower(m.email) = lower(a.actor_email) and m.display_name is not null)
where a.actor_name is null and a.actor_email is not null;

drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses after insert or update or delete on public.expenses
  for each row execute function public.log_audit();
drop trigger if exists audit_buckets on public.buckets;
create trigger audit_buckets after insert or update or delete on public.buckets
  for each row execute function public.log_audit();
drop trigger if exists audit_members on public.bucket_members;
create trigger audit_members after insert or update or delete on public.bucket_members
  for each row execute function public.log_audit();
drop trigger if exists audit_settings on public.bucket_settings;
create trigger audit_settings after insert or update or delete on public.bucket_settings
  for each row execute function public.log_audit();

alter table public.audit_log enable row level security;
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select
  using (public.my_role(bucket_id) in ('owner','manager','viewer'));
-- no insert/update/delete policies: only the trigger (security definer) writes

-- ---------- Receipt photo storage ----------
-- Private bucket; files live at  <bucket_id>/<expense_id>/<file>.jpg
-- Access mirrors the expense roles: owner/manager upload & delete, everyone in
-- the bucket can view, a 'payee' member can view only their own payments' photos.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select
  using (
    bucket_id = 'receipts' and (
      public.my_role(((storage.foldername(name))[1])::uuid) in ('owner','manager','viewer')
      or (
        public.my_role(((storage.foldername(name))[1])::uuid) = 'payee'
        and exists (
          select 1 from public.expenses e
          where e.id::text = (storage.foldername(name))[2]
            and lower(e.paid_to) = lower(coalesce(public.my_payee_name(((storage.foldername(name))[1])::uuid), ''))
        )
      )
    )
  );

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert
  with check (bucket_id = 'receipts' and public.my_role(((storage.foldername(name))[1])::uuid) in ('owner','manager'));

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete
  using (bucket_id = 'receipts' and public.my_role(((storage.foldername(name))[1])::uuid) in ('owner','manager'));

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
