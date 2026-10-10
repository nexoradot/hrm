-- Compatibility migration for organization administration fields.
alter table public.organizations add column if not exists industry text;
alter table public.organizations add column if not exists country text default 'Kenya';
alter table public.organizations add column if not exists country_code text default 'KE';
alter table public.organizations add column if not exists contact_name text;
alter table public.organizations add column if not exists contact_email text;
alter table public.organizations add column if not exists plan text not null default 'Growth';
alter table public.organizations add column if not exists notes text;
alter table public.organizations add column if not exists organization_type text not null default 'company';
alter table public.organizations add column if not exists verification_status text not null default 'pending';
alter table public.organizations add column if not exists updated_at timestamptz not null default now();
