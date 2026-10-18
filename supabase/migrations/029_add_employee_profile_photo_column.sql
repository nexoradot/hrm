-- Add the missing employee profile photo path column required by the self-service photo RPC.
alter table public.hr_employees
  add column if not exists profile_photo_url text;

comment on column public.hr_employees.profile_photo_url is
  'Private Storage object path for the employee profile photograph; use signed URLs for display.';

notify pgrst, 'reload schema';
