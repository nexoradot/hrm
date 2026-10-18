-- Company-specific HRM workspace branding and feature entitlements.
-- Safe to apply after 001_core_platform.sql.
alter table public.organizations
  add column if not exists workspace_settings jsonb not null default
  '{"display_name":null,"brand_color":"#17365d","logo_url":null,"language":"en","modules":{"core_hr":true,"leave":true,"payroll":true,"recruitment":true,"performance":true,"learning":true,"welfare":true,"consultancy":false}}'::jsonb;

comment on column public.organizations.workspace_settings is
  'Tenant-specific branding and HRM feature entitlements. Reads/writes are governed by organizations RLS.';
