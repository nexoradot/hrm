-- Restrict employee identity/licence update RPCs to authenticated users only.
-- The functions validate auth.uid() and update only the caller's linked employee record.
revoke all on function public.employee_update_my_identity_details(text,text,text,text,date,text,date) from public, anon;
revoke all on function public.employee_update_my_identity_details(text,text,text,text,text,date) from public, anon;

grant execute on function public.employee_update_my_identity_details(text,text,text,text,date,text,date) to authenticated;
grant execute on function public.employee_update_my_identity_details(text,text,text,text,text,date) to authenticated;
