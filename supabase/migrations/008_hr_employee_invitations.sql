-- Secure HR-created employee invitations and self-service account activation.
create extension if not exists pgcrypto;

create table if not exists public.hr_employee_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 email text not null,
 full_name text not null,
 department text,
 job_title text,
 role text not null default 'employee' check (role in ('employee')),
 token_hash text not null unique,
 expires_at timestamptz not null default (now() + interval '7 days'),
 created_by uuid not null references auth.users(id) on delete restrict,
 redeemed_by uuid references auth.users(id) on delete set null,
 redeemed_at timestamptz,
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index if not exists hr_employee_invitations_org_created_idx
 on public.hr_employee_invitations(organization_id, created_at desc);
create index if not exists hr_employee_invitations_email_idx
 on public.hr_employee_invitations(lower(email));

alter table public.hr_employee_invitations enable row level security;
drop policy if exists hr_employee_invitations_hr_manage on public.hr_employee_invitations;
create policy hr_employee_invitations_hr_manage on public.hr_employee_invitations
 for all to authenticated
 using (public.can_manage_hr(organization_id))
 with check (public.can_manage_hr(organization_id));
grant select, insert, update on public.hr_employee_invitations to authenticated;

create or replace function public.redeem_hr_employee_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
 v_inv public.hr_employee_invitations%rowtype;
 v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in or create your account before accepting this invitation.'; end if;
 select lower(email) into v_email from auth.users where id = auth.uid();
 if v_email is null then raise exception 'Could not verify the signed-in email address.'; end if;
 select * into v_inv
 from public.hr_employee_invitations
 where token_hash = encode(digest(p_token, 'sha256'), 'hex')
 for update;
 if not found then raise exception 'This invitation link is invalid.'; end if;
 if v_inv.revoked_at is not null then raise exception 'This invitation has been revoked. Contact HR.'; end if;
 if v_inv.redeemed_at is not null then raise exception 'This invitation has already been used.'; end if;
 if v_inv.expires_at <= now() then raise exception 'This invitation has expired. Contact HR for a new link.'; end if;
 if lower(v_inv.email) <> v_email then raise exception 'Sign in using the email address this invitation was issued to.'; end if;

 update public.organization_members
 set status = 'active', role = 'employee'
 where organization_id = v_inv.organization_id and user_id = auth.uid();

 if not found then
   insert into public.organization_members(organization_id,user_id,role,status)
   values(v_inv.organization_id,auth.uid(),'employee','active');
 end if;

 update public.hr_employee_invitations
 set redeemed_by = auth.uid(), redeemed_at = now()
 where id = v_inv.id;

 return jsonb_build_object(
   'organization_id',v_inv.organization_id,
   'organization_name',(select name from public.organizations where id=v_inv.organization_id),
   'full_name',v_inv.full_name,
   'department',v_inv.department,
   'job_title',v_inv.job_title
 );
end;
$$;
revoke all on function public.redeem_hr_employee_invitation(text) from public;
grant execute on function public.redeem_hr_employee_invitation(text) to authenticated;

comment on table public.hr_employee_invitations is
 'HR-created, expiring, single-use employee invitations. Only token hashes are stored; invitation links must be shared privately.';
