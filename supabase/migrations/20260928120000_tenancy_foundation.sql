-- Fleetly foundation: tenants, profiles, memberships (RBAC) and tenant-isolation helpers.
--
-- Conventions for every tenant-scoped table added later:
--   tenant_id uuid not null references public.tenants(id) on delete cascade
--   RLS enabled, policies built on private.is_tenant_member / private.has_tenant_role

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'fleet_manager', 'desk_agent', 'accountant');
create type public.plan_tier as enum ('standard', 'enterprise');

-- Security-definer helpers live in a schema that is not exposed through the Data API.
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48),
  plan        public.plan_tier not null default 'standard',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function private.set_updated_at();

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,  -- copied from auth.users so teammates can see it; kept in sync by trigger
  full_name   text check (char_length(full_name) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.tenant_members (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  -- References profiles (which cascade from auth.users) so the API can embed member profiles.
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- RLS helpers look memberships up by user first.
create index tenant_members_user_id_idx on public.tenant_members (user_id, tenant_id);

create trigger tenant_members_set_updated_at
  before update on public.tenant_members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant-isolation helpers (used by RLS on every tenant-scoped table)
-- security definer so policies on tenant_members don't recurse into themselves.
-- ---------------------------------------------------------------------------
create function private.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members m
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
  );
$$;

create function private.has_tenant_role(p_tenant_id uuid, p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members m
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function private.shares_tenant_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members mine
    join public.tenant_members theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function private.is_tenant_member(uuid) from public;
revoke all on function private.has_tenant_role(uuid, public.app_role[]) from public;
revoke all on function private.shares_tenant_with(uuid) from public;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.has_tenant_role(uuid, public.app_role[]) to authenticated;
grant execute on function private.shares_tenant_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------

-- A tenant must always keep at least one admin, otherwise nobody can manage it.
create function private.ensure_tenant_keeps_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := old.tenant_id;
begin
  -- Tenant itself is being deleted (cascade): nothing to protect.
  if not exists (select 1 from public.tenants t where t.id = v_tenant_id) then
    return null;
  end if;

  -- Serialize concurrent demotions/removals within the same tenant.
  perform 1 from public.tenants t where t.id = v_tenant_id for update;

  if not exists (
    select 1 from public.tenant_members m
    where m.tenant_id = v_tenant_id and m.role = 'admin'
  ) then
    raise exception 'A tenant must keep at least one admin'
      using errcode = 'P0001', hint = 'LAST_ADMIN';
  end if;

  return null;
end;
$$;

create trigger tenant_members_keep_admin
  after update of role or delete on public.tenant_members
  for each row
  when (old.role = 'admin')
  execute function private.ensure_tenant_keeps_admin();

-- Create a profile row for every new auth user.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_members enable row level security;

-- tenants: members read; admins update. Creation only via public.create_tenant().
create policy "tenants_select_members" on public.tenants
  for select to authenticated
  using ((select private.is_tenant_member(id)));

create policy "tenants_update_admins" on public.tenants
  for update to authenticated
  using ((select private.has_tenant_role(id, array['admin']::public.app_role[])))
  with check ((select private.has_tenant_role(id, array['admin']::public.app_role[])));

-- Plan changes go through billing, never directly from clients.
revoke update on public.tenants from authenticated;
grant update (name) on public.tenants to authenticated;

-- profiles: see yourself and teammates; edit only your name (email is synced from auth).
create policy "profiles_select_self_or_teammates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.shares_tenant_with(id)));

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- tenant_members: members see the roster; admins manage it.
create policy "tenant_members_select_members" on public.tenant_members
  for select to authenticated
  using ((select private.is_tenant_member(tenant_id)));

create policy "tenant_members_insert_admins" on public.tenant_members
  for insert to authenticated
  with check ((select private.has_tenant_role(tenant_id, array['admin']::public.app_role[])));

create policy "tenant_members_update_admins" on public.tenant_members
  for update to authenticated
  using ((select private.has_tenant_role(tenant_id, array['admin']::public.app_role[])))
  with check ((select private.has_tenant_role(tenant_id, array['admin']::public.app_role[])));

create policy "tenant_members_delete_admins" on public.tenant_members
  for delete to authenticated
  using ((select private.has_tenant_role(tenant_id, array['admin']::public.app_role[])));

-- Only role changes are allowed on existing memberships.
revoke update on public.tenant_members from authenticated;
grant update (role) on public.tenant_members to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create a tenant and make the caller its first admin (atomic).
-- ---------------------------------------------------------------------------
create function public.create_tenant(p_name text, p_slug text)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tenant  public.tenants;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.tenants (name, slug)
  values (trim(p_name), lower(trim(p_slug)))
  returning * into v_tenant;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (v_tenant.id, v_user_id, 'admin');

  return v_tenant;
end;
$$;

revoke all on function public.create_tenant(text, text) from public, anon;
grant execute on function public.create_tenant(text, text) to authenticated;
