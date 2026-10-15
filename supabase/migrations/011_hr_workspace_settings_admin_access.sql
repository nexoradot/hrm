-- Permit platform administrators to manage workspace preferences when supporting a tenant.
-- HR managers/owners remain restricted to their active organisation membership.
drop policy if exists hr_workspace_settings_hr_manage on public.hr_workspace_settings;
create policy hr_workspace_settings_hr_manage on public.hr_workspace_settings
 for all to authenticated
 using (public.can_manage_hr(organization_id) or public.is_platform_admin())
 with check (public.can_manage_hr(organization_id) or public.is_platform_admin());
grant select, insert, update, delete on public.hr_workspace_settings to authenticated;