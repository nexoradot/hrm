-- NEXORA core platform foundation. Idempotent where practical.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 organization_type text not null default 'company' check (organization_type in ('company','consultancy','platform')),
 status text not null default 'pending' check (status in ('pending','active','suspended','closed')),
 verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
 industry text,
 country text default 'Kenya',
 country_code text default 'KE',
 contact_name text,
 contact_email text,
 plan text not null default 'Growth',
 notes text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('owner','hr_manager','recruiter','consultant','member','viewer')),
 status text not null default 'pending' check (status in ('pending','active','suspended','revoked')),
 invited_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (organization_id,user_id)
);

create table if not exists public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'platform_admin' check (role in ('platform_admin','support_admin','billing_admin','security_admin')),
 status text not null default 'active' check (status in ('active','suspended')),
 created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
 id uuid primary key default gen_random_uuid(),
 actor_user_id uuid references auth.users(id) on delete set null,
 organization_id uuid references public.organizations(id) on delete set null,
 event_type text not null,
 target_type text,
 target_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.status='active') $$;

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.organization_members m where m.organization_id=target_org and m.user_id=auth.uid() and m.status='active') $$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists organizations_platform_admin_all on public.organizations;
create policy organizations_platform_admin_all on public.organizations for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations for select to authenticated using (public.is_org_member(id));

drop policy if exists members_platform_admin_all on public.organization_members;
create policy members_platform_admin_all on public.organization_members for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists members_self_read on public.organization_members;
create policy members_self_read on public.organization_members for select to authenticated using (user_id=auth.uid());

drop policy if exists platform_admin_self_read on public.platform_admins;
create policy platform_admin_self_read on public.platform_admins for select to authenticated using (user_id=auth.uid());
drop policy if exists audit_platform_admin_read on public.audit_events;
create policy audit_platform_admin_read on public.audit_events for select to authenticated using (public.is_platform_admin());
drop policy if exists audit_platform_admin_insert on public.audit_events;
create policy audit_platform_admin_insert on public.audit_events for insert to authenticated with check (public.is_platform_admin() and (actor_user_id is null or actor_user_id=auth.uid()));

grant select on public.organizations,public.organization_members,public.platform_admins,public.audit_events to authenticated;
grant insert,update,delete on public.organizations,public.organization_members to authenticated;
grant select,insert on public.audit_events to authenticated;
