-- Index the notification recipient foreign key for efficient user inbox lookups
-- and to avoid foreign-key maintenance scans when auth users are removed.
create index if not exists hr_notifications_recipient_user_id_idx
  on public.hr_notifications (recipient_user_id);
