-- Prevent candidates from inserting applications that bypass platform approval.
drop policy if exists applications_insert_candidate on public.job_applications;
create policy applications_insert_candidate
on public.job_applications
for insert
to authenticated
with check (
  candidate_id = (select auth.uid())
  and status = 'pending_review'
  and exists (
    select 1
    from public.jobs j
    where j.id = job_applications.job_id
      and j.status = 'published'
      and (j.closing_date is null or j.closing_date >= current_date)
  )
);
