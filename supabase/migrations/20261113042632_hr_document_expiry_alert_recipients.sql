-- Include organisation directors in HR document expiry notifications and
-- use accurate past-tense wording for recently expired documents.
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
   and m.role in ('owner', 'hr_manager', 'director')
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
