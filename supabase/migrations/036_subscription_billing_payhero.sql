-- NEXORA subscription billing via PayHero (M-Pesa).
create table if not exists public.subscription_payments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 plan_code text not null check (plan_code in ('starter','growth')),
 plan_name text not null,
 amount_kes integer not null check (amount_kes > 0),
 billing_period text not null default 'monthly' check (billing_period in ('monthly','annual')),
 phone_number text not null,
 external_reference text not null unique,
 payhero_reference text,
 checkout_request_id text,
 mpesa_receipt_number text,
 status text not null default 'pending' check (status in ('pending','completed','failed','cancelled')),
 provider_response jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 updated_at timestamptz not null default now()
);
create index if not exists subscription_payments_org_created_idx on public.subscription_payments(organization_id,created_at desc);
create index if not exists subscription_payments_status_idx on public.subscription_payments(status,created_at desc);
create table if not exists public.organization_subscriptions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.organizations(id) on delete restrict,
 plan_code text not null check (plan_code in ('starter','growth','enterprise')),
 plan_name text not null,
 status text not null default 'pending' check (status in ('pending','active','past_due','cancelled','expired')),
 billing_period text not null default 'monthly' check (billing_period in ('monthly','annual')),
 current_period_start timestamptz,
 current_period_end timestamptz,
 last_payment_id uuid references public.subscription_payments(id) on delete set null,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
alter table public.subscription_payments enable row level security;
alter table public.organization_subscriptions enable row level security;
drop policy if exists subscription_payments_platform_admin_read on public.subscription_payments;
create policy subscription_payments_platform_admin_read on public.subscription_payments for select to authenticated using (exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.status='active'));
drop policy if exists subscription_payments_org_admin_read on public.subscription_payments;
create policy subscription_payments_org_admin_read on public.subscription_payments for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=subscription_payments.organization_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','hr_manager'))
);
drop policy if exists organization_subscriptions_platform_admin_read on public.organization_subscriptions;
create policy organization_subscriptions_platform_admin_read on public.organization_subscriptions for select to authenticated using (public.is_platform_admin());
drop policy if exists organization_subscriptions_org_member_read on public.organization_subscriptions;
create policy organization_subscriptions_org_member_read on public.organization_subscriptions for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=organization_subscriptions.organization_id and m.user_id=auth.uid() and m.status='active'));
grant select on public.subscription_payments,public.organization_subscriptions to authenticated;
comment on table public.subscription_payments is 'Server-verified PayHero M-Pesa subscription payment attempts. Writes are performed by the billing Edge Function.';
comment on table public.organization_subscriptions is 'Current subscription entitlement per organisation; updated only after verified PayHero payment callbacks.';
