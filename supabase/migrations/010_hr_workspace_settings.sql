-- Persistent organisation-scoped HR workspace settings.
-- Apply after migrations 001-006. Safe to rerun.
create table if not exists public.hr_workspace_settings (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 default_currency text not null default 'KES' check(default_currency in ('KES','USD','GBP','EUR')),
 timezone text not null default 'Africa/Nairobi',
 work_week_start text not null default 'Monday' check(work_week_start in ('Monday','Sunday')),
 standard_work_hours_per_week numeric(5,2) not null default 40 check(standard_work_hours_per_week between 1 and 80),
 attendance_tracking_mode text not null default 'manual' check(attendance_tracking_mode in ('manual','shift_based')),
 leave_approval_required boolean not null default true,
 overtime_approval_required boolean not null default true,
 performance_review_frequency text not null default 'quarterly' check(performance_review_frequency in ('monthly','quarterly','biannual','annual')),
 payroll_period_frequency text not null default 'monthly' check(payroll_period_frequency in ('weekly','biweekly','monthly')),
 notification_email text,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists hr_workspace_settings_updated_idx on public.hr_workspace_settings(updated_at desc);
alter table public.hr_workspace_settings enable row level security;
drop policy if exists hr_workspace_settings_hr_manage on public.hr_workspace_settings;
create policy hr_workspace_settings_hr_manage on public.hr_workspace_settings
 for all to authenticated
 using(public.can_manage_hr(organization_id))
 with check(public.can_manage_hr(organization_id));
grant select,insert,update,delete on public.hr_workspace_settings to authenticated;
comment on table public.hr_workspace_settings is 'Persistent tenant-scoped HR workspace preferences; does not control platform admin permissions, billing, payroll statutory calculations, or payment execution.';
