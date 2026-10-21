alter table public.subscription_payments drop constraint if exists subscription_payments_plan_code_check;
alter table public.subscription_payments add constraint subscription_payments_plan_code_check check (plan_code ~ '^[a-z][a-z0-9_-]{1,39}$');
comment on constraint subscription_payments_plan_code_check on public.subscription_payments is 'Accept valid keys from the editable subscription plan catalogue.';
