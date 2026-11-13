-- VELNORA HR: secure, tenant-scoped employee document expiry notifications.
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.hr_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'hr',
  notification_type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  due_date date,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint hr_notifications_category_check check (category in ('hr','system','security')),
  constraint hr_notifications_type_check check (notification_type in ('document_expiry')),
  constraint hr_notifications_dedupe_unique unique (organization_id, recipient_user_id, dedupe_key)
);

create index if not exists hr_notifications_recipient_inbox_idx
  on public.hr_notifications (organization_id, recipient_user_id, read_at, created_at desc);

alter table public.hr_notifications enable row level security;
revoke all on public.hr_notifications from anon, authenticated;
grant select on public.hr_notifications to authenticated;
grant update (read_at) on public.hr_notifications to authenticated;

drop policy if exists hr_notifications_recipient_select on public.hr_notifications;
create policy hr_notifications_recipient_select
  on public.hr_notifications for select to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.organization_id = hr_notifications.organization_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and o.status = 'active'
    )
  );

drop policy if exists hr_notifications_recipient_update on public.hr_notifications;
create policy hr_notifications_recipient_update
  on public.hr_notifications for update to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.organization_id = hr_notifications.organization_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and o.status = 'active'
    )
  )
  with check (
    recipient_user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.organization_id = hr_notifications.organization_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and o.status = 'active'
    )
  );

create or replace function private.generate_hr_document_expiry_notifications()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.hr_notifications (
    organization_id, recipient_user_id, category, notification_type,
    title, message, entity_type, entity_id, due_date, dedupe_key
  )
  select
    d.organization_id,
    m.user_id,
    'hr',
    'document_expiry',
    case x.days_until
      when 90 then 'Employee document expires in 90 days'
      when 60 then 'Employee document expires in 60 days'
      when 30 then 'Employee document expires in 30 days'
      when 7 then 'Employee document expires in 7 days'
      when 0 then 'Employee document expires today'
      when -1 then 'Employee document has expired'
    end,
    e.full_name || ' — ' || d.document_name || ' ' ||
      case when x.days_until = -1 then 'expired on ' else 'expires on ' end ||
      to_char(d.expiry_date, 'DD Mon YYYY') || '. Please arrange renewal or update the employee record.',
    'hr_employee_document',
    d.id,
    d.expiry_date,
    'document-expiry:' || d.id::text || ':' || x.days_until::text
  from public.hr_employee_documents d
  join public.hr_employees e
    on e.id = d.employee_id and e.organization_id = d.organization_id
  join public.organizations o
    on o.id = d.organization_id and o.status = 'active'
  join public.organization_members m
    on m.organization_id = d.organization_id
   and m.status = 'active'
   and m.role in ('owner', 'hr_manager')
  cross join lateral (select d.expiry_date - current_date as days_until) x
  where d.expiry_date is not null
    and x.days_until in (90, 60, 30, 7, 0, -1)
    and d.verification_status <> 'rejected'
    and e.employment_status <> 'terminated'
  on conflict (organization_id, recipient_user_id, dedupe_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.generate_hr_document_expiry_notifications() from public, anon, authenticated;

select cron.schedule(
  'velnora-hr-document-expiry-daily',
  '0 4 * * *',
  'select private.generate_hr_document_expiry_notifications();'
);

select private.generate_hr_document_expiry_notifications();
