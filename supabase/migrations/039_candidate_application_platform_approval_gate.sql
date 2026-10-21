-- Candidate applications must be approved by a platform administrator before employer HR can see them.
alter table public.job_applications drop constraint if exists job_applications_status_check;
alter table public.job_applications
  add constraint job_applications_status_check
  check (status = any (array[
    'submitted','pending_review','approved_for_employer','platform_rejected',
    'under_review','shortlisted','interview','offered','hired','rejected','withdrawn'
  ]::text[]));

alter table public.job_applications alter column status set default 'pending_review';
update public.job_applications set status = 'pending_review' where status = 'submitted';

drop policy if exists applications_select_scoped on public.job_applications;
create policy applications_select_scoped
on public.job_applications for select to authenticated
using (
  candidate_id = (select auth.uid())
  or (select is_platform_admin())
  or (
    status not in ('pending_review','submitted','platform_rejected')
    and exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id
        and is_verified_org_role(j.organization_id, array['owner','hr_manager','recruiter']::text[])
    )
  )
);

create or replace function public.guard_job_application_review_status()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_admin boolean;
  v_employer boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_admin := coalesce(is_platform_admin(), false);
  if v_admin then return new; end if;

  select j.organization_id into v_org_id from public.jobs j where j.id = old.job_id;
  v_employer := v_org_id is not null
    and coalesce(is_verified_org_role(v_org_id, array['owner','hr_manager','recruiter']::text[]), false);

  if auth.uid() = old.candidate_id then
    if new.status <> 'withdrawn' then
      raise exception 'Candidates may only withdraw their own application. Platform approval is required for all other status changes.' using errcode = '42501';
    end if;
    new.candidate_withdrawn_at := coalesce(new.candidate_withdrawn_at, now());
    return new;
  end if;

  if v_employer then
    if new.status in ('submitted','pending_review','approved_for_employer','platform_rejected') then
      raise exception 'Only a platform administrator can change platform review status.' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to change this application.' using errcode = '42501';
end;
$$;

drop trigger if exists job_application_review_status_guard on public.job_applications;
create trigger job_application_review_status_guard
before update of status on public.job_applications
for each row execute function public.guard_job_application_review_status();
