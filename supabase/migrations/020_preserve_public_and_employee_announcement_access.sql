-- Preserve public announcement visibility while keeping employee-only notices private.
drop policy if exists announcements_read_published on public.platform_announcements;
drop policy if exists announcements_read_published_public on public.platform_announcements;
drop policy if exists announcements_read_published_employees on public.platform_announcements;

create policy announcements_read_published_public on public.platform_announcements
 for select to anon, authenticated
 using (
   status = 'published'
   and (publish_at is null or publish_at <= now())
   and audience = any (array['all','candidates']::text[])
 );

create policy announcements_read_published_employees on public.platform_announcements
 for select to authenticated
 using (
   status = 'published'
   and (publish_at is null or publish_at <= now())
   and audience = 'employees'
   and exists (
     select 1 from public.hr_employees e
     where e.user_id = (select auth.uid())
   )
 );
