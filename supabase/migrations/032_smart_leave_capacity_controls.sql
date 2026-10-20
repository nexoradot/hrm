-- Smart leave coverage controls. Existing leave records are preserved.
create table if not exists public.hr_leave_capacity_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  max_staff_away_percent numeric(5,2) not null default 20,
  min_staff_on_duty integer not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint hr_leave_capacity_percent_check check (max_staff_away_percent > 0 and max_staff_away_percent <= 100),
  constraint hr_leave_capacity_min_staff_check check (min_staff_on_duty >= 0)
);
alter table public.hr_leave_capacity_policies enable row level security;
drop policy if exists "HR members read leave capacity policy" on public.hr_leave_capacity_policies;
create policy "HR members read leave capacity policy" on public.hr_leave_capacity_policies
for select to authenticated using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = hr_leave_capacity_policies.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);
drop policy if exists "HR managers update leave capacity policy" on public.hr_leave_capacity_policies;
create policy "HR managers update leave capacity policy" on public.hr_leave_capacity_policies
for all to authenticated using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = hr_leave_capacity_policies.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and lower(m.role) in ('hr','hr_manager','admin','owner','super_admin','superadmin','platform_admin')
  )
) with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = hr_leave_capacity_policies.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and lower(m.role) in ('hr','hr_manager','admin','owner','super_admin','superadmin','platform_admin')
  )
);
create index if not exists hr_leave_requests_org_dates_status_idx
  on public.hr_leave_requests (organization_id, status, start_date, end_date);
create or replace function public.enforce_hr_leave_capacity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  active_count integer;
  max_percent numeric(5,2);
  min_on_duty integer;
  max_away integer;
  day_to_check date;
  approved_count integer;
begin
  if new.status <> 'approved' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.organization_id::text), 917204);
  select coalesce(p.max_staff_away_percent,20), coalesce(p.min_staff_on_duty,1)
    into max_percent,min_on_duty
  from (select 1) seed
  left join public.hr_leave_capacity_policies p on p.organization_id = new.organization_id;
  select count(*) into active_count from public.hr_employees e
   where e.organization_id = new.organization_id
     and lower(coalesce(e.employment_status,'')) not in ('terminated','inactive');
  max_away := greatest(0, least(floor(active_count * max_percent / 100.0)::integer, active_count - min_on_duty));
  if active_count = 0 then
    raise exception 'Leave approval blocked: no active workforce records are available to calculate coverage.';
  end if;
  if max_away < 1 then
    raise exception 'Leave approval blocked by the current coverage policy. Adjust the minimum staff on duty or coverage percentage in HR leave settings.';
  end if;
  for day_to_check in select d::date from generate_series(new.start_date::timestamp, new.end_date::timestamp, interval '1 day') d loop
    select count(*) into approved_count
    from public.hr_leave_requests l
    where l.organization_id = new.organization_id
      and l.status = 'approved'
      and l.id <> new.id
      and l.start_date <= day_to_check and l.end_date >= day_to_check;
    if approved_count + 1 > max_away then
      raise exception 'Leave approval blocked for %: approved leave would exceed the coverage limit (% staff away from % active staff). Review the leave calendar or adjust the HR coverage policy.', day_to_check, max_away, active_count;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_enforce_hr_leave_capacity on public.hr_leave_requests;
create trigger trg_enforce_hr_leave_capacity
before insert or update of status, start_date, end_date
on public.hr_leave_requests
for each row execute function public.enforce_hr_leave_capacity();
