-- Tighten execute grants on internal SECURITY DEFINER helpers.
-- RLS policy helpers remain callable by authenticated users; trigger-only functions
-- are not directly callable through the public REST RPC surface.
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
revoke execute on function public.is_active_org_member(uuid) from public, anon;
grant execute on function public.is_active_org_member(uuid) to authenticated, service_role;
revoke execute on function public.can_manage_hr(uuid) from public, anon;
grant execute on function public.can_manage_hr(uuid) to authenticated, service_role;
revoke execute on function public.accept_pending_memberships() from public, anon;
grant execute on function public.accept_pending_memberships() to authenticated, service_role;
revoke execute on function public.capture_platform_audit_event() from public, anon, authenticated;
grant execute on function public.capture_platform_audit_event() to service_role;
revoke execute on function public.enforce_candidate_discovery_consent() from public, anon, authenticated;
grant execute on function public.enforce_candidate_discovery_consent() to service_role;
revoke execute on function public.is_accepted_consultancy_for(uuid) from public, anon;
grant execute on function public.is_accepted_consultancy_for(uuid) to authenticated, service_role;
revoke execute on function public.is_active_consultancy_member() from public, anon;
grant execute on function public.is_active_consultancy_member() to authenticated, service_role;
revoke execute on function public.is_active_org_role(uuid, text[]) from public, anon;
grant execute on function public.is_active_org_role(uuid, text[]) to authenticated, service_role;
revoke execute on function public.is_employer_for_candidate(uuid) from public, anon;
grant execute on function public.is_employer_for_candidate(uuid) to authenticated, service_role;
revoke execute on function public.is_verified_org_role(uuid, text[]) from public, anon;
grant execute on function public.is_verified_org_role(uuid, text[]) to authenticated, service_role;
revoke execute on function public.pause_jobs_for_untrusted_organization() from public, anon, authenticated;
grant execute on function public.pause_jobs_for_untrusted_organization() to service_role;
revoke execute on function public.protect_candidate_document_updates() from public, anon, authenticated;
grant execute on function public.protect_candidate_document_updates() to service_role;
revoke execute on function public.protect_job_application_updates() from public, anon, authenticated;
grant execute on function public.protect_job_application_updates() to service_role;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;
revoke execute on function public.sync_candidate_discovery_card() from public, anon, authenticated;
grant execute on function public.sync_candidate_discovery_card() to service_role;
revoke execute on function public.redeem_hr_employee_invitation(text) from public, anon;
grant execute on function public.redeem_hr_employee_invitation(text) to authenticated, service_role;