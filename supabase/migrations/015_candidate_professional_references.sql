-- Persist candidate CV referees/references with the rest of the career profile.
alter table public.candidate_career_details
  add column if not exists professional_references jsonb not null default '[]'::jsonb;
