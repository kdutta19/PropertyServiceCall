-- PropertyServiceCall: schema, indexes
-- Run migrations in order (0001 -> 0004) in the Supabase SQL editor or with `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
create type public.member_role as enum ('tenant', 'manager', 'technician');
create type public.request_status as enum ('new', 'assigned', 'in_progress', 'waiting_on_tenant', 'completed');
create type public.request_urgency as enum ('routine', 'soon', 'emergency');
create type public.request_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.request_category as enum
  ('plumbing', 'electrical', 'heating_cooling', 'appliance', 'doors_windows', 'pests', 'other');
create type public.activity_type as enum
  ('submitted', 'edited', 'assigned', 'unassigned', 'status_changed', 'priority_changed', 'note', 'photo_added');

-- ---------------------------------------------------------------- tables
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  address text not null,
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  label text not null,
  unique (property_id, label)
);

-- One row per person per organization. Tenants get one row per unit they live in.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  unit_id uuid references public.units (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint tenant_has_unit check ((role = 'tenant') = (unit_id is not null))
);
create unique index memberships_staff_uq on public.memberships (org_id, user_id, role) where unit_id is null;
create unique index memberships_tenant_uq on public.memberships (user_id, unit_id) where unit_id is not null;

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  created_by uuid not null references auth.users (id),
  client_request_id uuid not null,
  category public.request_category not null,
  description text not null check (char_length(trim(description)) between 10 and 1000),
  urgency public.request_urgency not null,
  priority public.request_priority not null default 'normal',
  status public.request_status not null default 'new',
  assignee_id uuid references auth.users (id),
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- makes retried submissions from the device idempotent
  unique (created_by, client_request_id),
  constraint assignee_matches_status check (
    (status = 'new' and assignee_id is null) or (status <> 'new' and assignee_id is not null)
  )
);

-- History of assignments. The current assignee lives on the request; this is the audit trail.
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  technician_id uuid not null references auth.users (id),
  assigned_by uuid not null references auth.users (id),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  actor_id uuid not null references auth.users (id),
  actor_role public.member_role not null,
  type public.activity_type not null,
  from_status public.request_status,
  to_status public.request_status,
  message text,
  created_at timestamptz not null default now()
);

create table public.request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  storage_path text not null unique,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes
create index properties_org_idx on public.properties (org_id);
create index units_property_idx on public.units (property_id);
create index units_org_idx on public.units (org_id);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_org_role_idx on public.memberships (org_id, role);
create index requests_org_status_idx on public.maintenance_requests (org_id, status, created_at desc);
create index requests_unit_idx on public.maintenance_requests (unit_id);
create index requests_assignee_idx on public.maintenance_requests (assignee_id) where assignee_id is not null;
create index assignments_request_idx on public.assignments (request_id);
create index activity_request_idx on public.activity_events (request_id, created_at);
create index photos_request_idx on public.request_photos (request_id);

-- ---------------------------------------------------------------- profile bootstrap
-- Creates a profile when someone signs up. Role/org access is NEVER taken from sign-up metadata:
-- it only comes from rows in `memberships`, which only a service-role/SQL-editor admin can insert.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
