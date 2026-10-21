-- Auditable employment status changes for HR, directors and workspace owners.
create table if not exists public.hr_employee_status_history (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 employee_id uuid not null references public.hr_employees(id) on delete cascade,
 previous_status text,
 new_status text not null check (new_status in ('active','inactive','terminated','probation','on_leave')),
 effective_date date not null default current_date,
 reason text,
 changed_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.hr_employee_status_history enable row level security;
drop policy if exists hr_employee_status_history_read on public.hr_employee_status_history;
create policy hr_employee_status_history_read on public.hr_employee_status_history
for select to authenticated using (is_active_org_role(organization_id, array['owner','director','hr_manager']::text[]));

create or replace function public.set_employee_employment_status(
 p_employee_id uuid,
 p_status text,
 p_effective_date date default current_date,
 p_reason text default null
) returns public.hr_employees
language plpgsql security definer set search_path=public
as $$
declare
 v_employee public.hr_employees;
 v_previous text;
begin
 if p_status not in ('active','inactive','terminated','probation','on_leave') then
  raise exception 'Invalid employment status.' using errcode='22023';
 end if;
 select * into v_employee from public.hr_employees where id=p_employee_id for update;
 if not found then raise exception 'Employee not found.' using errcode='P0002'; end if;
 if not is_active_org_role(v_employee.organization_id,array['owner','director','hr_manager']::text[]) then
  raise exception 'Only HR managers, directors, and workspace owners may change employee status.' using errcode='42501';
 end if;
 v_previous:=v_employee.employment_status;
 update public.hr_employees set
  employment_status=p_status,
  end_date=case when p_status='terminated' then coalesce(p_effective_date,current_date) when v_previous='terminated' and p_status<>'terminated' then null else end_date end,
  updated_at=now()
 where id=p_employee_id returning * into v_employee;
 if v_previous is distinct from p_status then
  insert into public.hr_employee_status_history(organization_id,employee_id,previous_status,new_status,effective_date,reason,changed_by)
  values(v_employee.organization_id,v_employee.id,v_previous,p_status,coalesce(p_effective_date,current_date),nullif(trim(p_reason),''),auth.uid());
 end if;
 return v_employee;
end;
$$;
revoke all on function public.set_employee_employment_status(uuid,text,date,text) from public;
grant execute on function public.set_employee_employment_status(uuid,text,date,text) to authenticated;
