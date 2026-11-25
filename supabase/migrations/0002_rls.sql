-- Row Level Security. Clients get READ access through policies and WRITE access only through
-- the SECURITY DEFINER functions in 0004. Tables have no INSERT/UPDATE/DELETE policies for clients,
-- so a forged direct write is rejected by default (RLS denies what no policy allows).

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.memberships enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.assignments enable row level security;
alter table public.activity_events enable row level security;
alter table public.request_photos enable row level security;

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so they can read `memberships` without recursing through its own policies.
-- Each takes auth.uid() internally; none accepts a caller-supplied user id.
create function public.is_org_manager(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m
    where m.user_id = auth.uid() and m.org_id = p_org and m.role = 'manager');
$$;

create function public.is_tenant_of_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m
    where m.user_id = auth.uid() and m.role = 'tenant' and m.unit_id = p_unit);
$$;

create function public.is_org_technician(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m
    where m.user_id = auth.uid() and m.org_id = p_org and m.role = 'technician');
$$;

create function public.can_view_request(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from maintenance_requests r
    where r.id = p_request and (
      public.is_org_manager(r.org_id)
      or public.is_tenant_of_unit(r.unit_id)
      or (r.assignee_id = auth.uid() and public.is_org_technician(r.org_id))
    ));
$$;

revoke all on function public.is_org_manager(uuid), public.is_tenant_of_unit(uuid),
  public.is_org_technician(uuid), public.can_view_request(uuid) from public, anon;
grant execute on function public.is_org_manager(uuid), public.is_tenant_of_unit(uuid),
  public.is_org_technician(uuid), public.can_view_request(uuid) to authenticated;

-- ---------------------------------------------------------------- read policies
create policy "members read their organization" on public.organizations for select to authenticated
  using (exists (select 1 from memberships m where m.org_id = organizations.id and m.user_id = auth.uid()));

create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());

-- Staff need names for activity feeds and assignment pickers; tenants need the assigned tech's name.
-- Exposed through the narrow view `people` below rather than widening this table's policy.

create policy "read own memberships" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_org_manager(org_id));

create policy "read properties" on public.properties for select to authenticated
  using (
    public.is_org_manager(org_id)
    or exists (select 1 from units u where u.property_id = properties.id
               and (public.is_tenant_of_unit(u.id)
                    or exists (select 1 from maintenance_requests r
                               where r.unit_id = u.id and r.assignee_id = auth.uid())))
  );

create policy "read units" on public.units for select to authenticated
  using (
    public.is_org_manager(org_id)
    or public.is_tenant_of_unit(id)
    or exists (select 1 from maintenance_requests r where r.unit_id = units.id and r.assignee_id = auth.uid())
  );

create policy "read requests" on public.maintenance_requests for select to authenticated
  using (
    public.is_org_manager(org_id)
    or public.is_tenant_of_unit(unit_id)
    or (assignee_id = auth.uid() and public.is_org_technician(org_id))
  );

create policy "read assignments" on public.assignments for select to authenticated
  using (public.can_view_request(request_id));

create policy "read activity" on public.activity_events for select to authenticated
  using (public.can_view_request(request_id));

create policy "read photo rows" on public.request_photos for select to authenticated
  using (public.can_view_request(request_id));

-- ---------------------------------------------------------------- people view
-- Names and roles of people who share a request with the caller. Runs as the view owner
-- (security_invoker = off) but filters by can_view_request, so no extra data leaks.
create view public.people with (security_invoker = off) as
  select p.id, p.full_name, m.role, m.org_id
  from public.profiles p
  join public.memberships m on m.user_id = p.id
  where p.id = auth.uid()
     or public.is_org_manager(m.org_id)
     or exists (
       select 1 from public.maintenance_requests r
       where public.can_view_request(r.id)
         and (r.created_by = p.id or r.assignee_id = p.id)
     )
     or exists (
       select 1 from public.activity_events e
       where e.actor_id = p.id and public.can_view_request(e.request_id)
     );
revoke all on public.people from public, anon;
grant select on public.people to authenticated;

-- ---------------------------------------------------------------- hard denials
-- Belt and braces: even if a future policy is added by mistake, clients hold no write privileges.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
grant select on public.organizations, public.profiles, public.properties, public.units,
  public.memberships, public.maintenance_requests, public.assignments,
  public.activity_events, public.request_photos to authenticated;
