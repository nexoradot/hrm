-- Persist GPS coordinates as structured attendance data, not only in notes.
alter table public.hr_attendance_records
  add column if not exists clock_in_latitude double precision,
  add column if not exists clock_in_longitude double precision,
  add column if not exists clock_in_accuracy_m double precision,
  add column if not exists clock_in_location_captured_at timestamptz,
  add column if not exists clock_out_latitude double precision,
  add column if not exists clock_out_longitude double precision,
  add column if not exists clock_out_accuracy_m double precision,
  add column if not exists clock_out_location_captured_at timestamptz;

alter table public.hr_attendance_records
  drop constraint if exists hr_attendance_clock_in_latitude_range,
  drop constraint if exists hr_attendance_clock_in_longitude_range,
  drop constraint if exists hr_attendance_clock_out_latitude_range,
  drop constraint if exists hr_attendance_clock_out_longitude_range,
  drop constraint if exists hr_attendance_clock_in_accuracy_nonnegative,
  drop constraint if exists hr_attendance_clock_out_accuracy_nonnegative;

alter table public.hr_attendance_records
  add constraint hr_attendance_clock_in_latitude_range check (clock_in_latitude is null or clock_in_latitude between -90 and 90),
  add constraint hr_attendance_clock_in_longitude_range check (clock_in_longitude is null or clock_in_longitude between -180 and 180),
  add constraint hr_attendance_clock_out_latitude_range check (clock_out_latitude is null or clock_out_latitude between -90 and 90),
  add constraint hr_attendance_clock_out_longitude_range check (clock_out_longitude is null or clock_out_longitude between -180 and 180),
  add constraint hr_attendance_clock_in_accuracy_nonnegative check (clock_in_accuracy_m is null or clock_in_accuracy_m >= 0),
  add constraint hr_attendance_clock_out_accuracy_nonnegative check (clock_out_accuracy_m is null or clock_out_accuracy_m >= 0);

comment on column public.hr_attendance_records.clock_in_latitude is 'Latitude reported by the employee device at clock-in; null for legacy/manual records.';
comment on column public.hr_attendance_records.clock_in_longitude is 'Longitude reported by the employee device at clock-in; null for legacy/manual records.';
comment on column public.hr_attendance_records.clock_in_accuracy_m is 'Browser GPS accuracy estimate in metres at clock-in.';
comment on column public.hr_attendance_records.clock_out_latitude is 'Latitude reported by the employee device at clock-out.';
comment on column public.hr_attendance_records.clock_out_longitude is 'Longitude reported by the employee device at clock-out.';
comment on column public.hr_attendance_records.clock_out_accuracy_m is 'Browser GPS accuracy estimate in metres at clock-out.';