-- NEXORA digital document-signing requests and auditable signature events.
create table if not exists public.hr_signature_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 employee_id uuid references public.hr_employees(id) on delete set null,
 document_id uuid references public.hr_employee_documents(id) on delete set null,
 title text not null,
 document_name text not null,
 document_storage_path text not null,
 document_sha256 text not null,
 status text not null default 'draft' check (status in ('draft','awaiting_signatures','partially_signed','completed','declined','expired','cancelled')),
 created_by uuid not null references auth.users(id),
 expires_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.hr_signature_request_signers (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.hr_signature_requests(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 signer_name text not null,
 signer_email text not null,
 signer_role text not null default 'signer',
 signer_order integer not null default 1,
 status text not null default 'pending' check(status in ('pending','viewed','signed','declined')),
 token_hash text unique,
 token_expires_at timestamptz,
 signed_at timestamptz,
 signature_storage_path text,
 signature_sha256 text,
 consent_text text,
 signer_ip inet,
 signer_user_agent text,
 decline_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.hr_signature_audit_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.hr_signature_requests(id) on delete cascade,
 signer_id uuid references public.hr_signature_request_signers(id) on delete set null,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 event_type text not null,
 event_detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists hr_signature_requests_org_status_idx on public.hr_signature_requests(organization_id,status,created_at desc);
create index if not exists hr_signature_signers_request_idx on public.hr_signature_request_signers(request_id,signer_order);
create index if not exists hr_signature_events_request_idx on public.hr_signature_audit_events(request_id,created_at);
alter table public.hr_signature_requests enable row level security;
alter table public.hr_signature_request_signers enable row level security;
alter table public.hr_signature_audit_events enable row level security;
drop policy if exists hr_signature_requests_manage on public.hr_signature_requests;
create policy hr_signature_requests_manage on public.hr_signature_requests for all to authenticated
using (is_active_org_role(organization_id,array['owner','director','hr_manager']::text[]))
with check (is_active_org_role(organization_id,array['owner','director','hr_manager']::text[]));
drop policy if exists hr_signature_signers_manage on public.hr_signature_request_signers;
create policy hr_signature_signers_manage on public.hr_signature_request_signers for all to authenticated
using (is_active_org_role(organization_id,array['owner','director','hr_manager']::text[]))
with check (is_active_org_role(organization_id,array['owner','director','hr_manager']::text[]));
drop policy if exists hr_signature_events_read on public.hr_signature_audit_events;
create policy hr_signature_events_read on public.hr_signature_audit_events for select to authenticated
using (is_active_org_role(organization_id,array['owner','director','hr_manager']::text[]));
