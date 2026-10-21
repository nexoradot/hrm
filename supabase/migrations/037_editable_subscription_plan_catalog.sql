-- Ensure the existing subscription catalogue is editable only by platform administrators.
insert into public.subscription_plans(plan_key,name,description,currency_code,monthly_price,annual_price,active,public_signup)
values ('starter','Starter','Core HR and employee records','KES',2500,25000,true,true),
       ('growth','Growth','Expanded workforce management','KES',7500,75000,true,true),
       ('enterprise','Enterprise','Custom pricing; set the company-specific monthly amount','KES',0,0,true,true)
on conflict(plan_key) do nothing;
alter table public.subscription_plans enable row level security;
drop policy if exists subscription_plans_platform_admin_read on public.subscription_plans;
create policy subscription_plans_platform_admin_read on public.subscription_plans for select to authenticated using (exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.status='active'));
drop policy if exists subscription_plans_platform_admin_write on public.subscription_plans;
create policy subscription_plans_platform_admin_write on public.subscription_plans for all to authenticated using (exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.status='active')) with check (exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.status='active'));
grant select,insert,update,delete on public.subscription_plans to authenticated;
comment on table public.subscription_plans is 'Editable NEXORA subscription catalogue; company-specific monthly amounts override catalogue prices.';
