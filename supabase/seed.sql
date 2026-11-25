-- Sample data for Maple Row Property Co. (fictional).
--
-- BEFORE RUNNING: create these seven users in Supabase Dashboard -> Authentication -> Users
-- ("Add user", tick "Auto Confirm User"), all with the password `maintenance1`:
--   priya@maplerow.example   (manager)       marcus@maplerow.example (technician)
--   dana@maplerow.example    (technician)    elena@maplerow.example  (tenant, Alder Court 2A)
--   jordan@maplerow.example  (tenant, 1B)    sam@maplerow.example    (tenant, Birchwood 201 + 202)
--   hannah@maplerow.example  (tenant, Birchwood 102)
-- Then run this script in the SQL editor (it runs as the postgres role, which is how the very
-- first memberships have to be created: clients can never write memberships).
-- Never use this password outside a throwaway demo project.

do $$
declare
  v_org uuid := gen_random_uuid();
  p_alder uuid := gen_random_uuid();
  p_birch uuid := gen_random_uuid();
  u uuid;
  uid_priya uuid; uid_marcus uuid; uid_dana uuid; uid_elena uuid; uid_jordan uuid; uid_sam uuid; uid_hannah uuid;
  u_2a uuid; u_1b uuid; u_201 uuid; u_202 uuid; u_102 uuid;
  r uuid;
begin
  select id into uid_priya from auth.users where email = 'priya@maplerow.example';
  select id into uid_marcus from auth.users where email = 'marcus@maplerow.example';
  select id into uid_dana from auth.users where email = 'dana@maplerow.example';
  select id into uid_elena from auth.users where email = 'elena@maplerow.example';
  select id into uid_jordan from auth.users where email = 'jordan@maplerow.example';
  select id into uid_sam from auth.users where email = 'sam@maplerow.example';
  select id into uid_hannah from auth.users where email = 'hannah@maplerow.example';
  if uid_priya is null or uid_marcus is null or uid_dana is null or uid_elena is null
     or uid_jordan is null or uid_sam is null or uid_hannah is null then
    raise exception 'Create the seven demo auth users first (see the header of seed.sql).';
  end if;

  -- profiles (trigger covers users created after migration 0001; backfill the rest)
  insert into profiles (id, full_name, email)
  select a.id, v.n, a.email from auth.users a
  join (values ('priya@maplerow.example','Priya Raman'), ('marcus@maplerow.example','Marcus Webb'),
               ('dana@maplerow.example','Dana Okafor'), ('elena@maplerow.example','Elena Torres'),
               ('jordan@maplerow.example','Jordan Kim'), ('sam@maplerow.example','Sam Patel'),
               ('hannah@maplerow.example','Hannah Lee')) as v(e, n) on v.e = a.email
  on conflict (id) do update set full_name = excluded.full_name;

  insert into organizations (id, name) values (v_org, 'Maple Row Property Co.');
  insert into properties (id, org_id, name, address) values
    (p_alder, v_org, 'Alder Court', '418 Alder Street'),
    (p_birch, v_org, 'Birchwood Flats', '92 Birch Lane');

  insert into units (org_id, property_id, label) values
    (v_org, p_alder, '1A'), (v_org, p_alder, '1B'), (v_org, p_alder, '2A'), (v_org, p_alder, '2B'),
    (v_org, p_birch, '101'), (v_org, p_birch, '102'), (v_org, p_birch, '201'), (v_org, p_birch, '202');
  select id into u_2a from units where property_id = p_alder and label = '2A';
  select id into u_1b from units where property_id = p_alder and label = '1B';
  select id into u_201 from units where property_id = p_birch and label = '201';
  select id into u_202 from units where property_id = p_birch and label = '202';
  select id into u_102 from units where property_id = p_birch and label = '102';

  insert into memberships (org_id, user_id, role, unit_id) values
    (v_org, uid_priya, 'manager', null), (v_org, uid_marcus, 'technician', null), (v_org, uid_dana, 'technician', null),
    (v_org, uid_elena, 'tenant', u_2a), (v_org, uid_jordan, 'tenant', u_1b),
    (v_org, uid_sam, 'tenant', u_201), (v_org, uid_sam, 'tenant', u_202), (v_org, uid_hannah, 'tenant', u_102);

  -- 1: brand new emergency
  insert into maintenance_requests (org_id, unit_id, created_by, client_request_id, category, description, urgency, priority, status, created_at)
  values (v_org, u_2a, uid_elena, gen_random_uuid(), 'plumbing',
    'Water is dripping steadily from under the kitchen sink and the cabinet floor is soaked. I shut the valve under the sink but it still drips.',
    'emergency', 'urgent', 'new', now() - interval '35 minutes') returning id into r;
  insert into activity_events (request_id, actor_id, actor_role, type, to_status, created_at)
  values (r, uid_elena, 'tenant', 'submitted', 'new', now() - interval '35 minutes');

  -- 2: assigned
  insert into maintenance_requests (org_id, unit_id, created_by, client_request_id, category, description, urgency, priority, status, assignee_id, created_at)
  values (v_org, u_1b, uid_jordan, gen_random_uuid(), 'heating_cooling',
    'The radiator in the bedroom stays cold even with the thermostat turned up. Living room radiator works fine.',
    'soon', 'high', 'assigned', uid_dana, now() - interval '27 hours') returning id into r;
  insert into assignments (request_id, technician_id, assigned_by) values (r, uid_dana, uid_priya);
  insert into activity_events (request_id, actor_id, actor_role, type, from_status, to_status, message, created_at) values
    (r, uid_jordan, 'tenant', 'submitted', null, 'new', null, now() - interval '27 hours'),
    (r, uid_priya, 'manager', 'assigned', 'new', 'assigned', 'Assigned to Dana Okafor', now() - interval '26 hours');

  -- 3: in progress
  insert into maintenance_requests (org_id, unit_id, created_by, client_request_id, category, description, urgency, priority, status, assignee_id, created_at)
  values (v_org, u_201, uid_sam, gen_random_uuid(), 'electrical',
    'Two outlets along the kitchen counter stopped working. Breaker panel looks normal, and the GFCI outlet has been reset.',
    'soon', 'normal', 'in_progress', uid_dana, now() - interval '3 days') returning id into r;
  insert into assignments (request_id, technician_id, assigned_by) values (r, uid_dana, uid_priya);
  insert into activity_events (request_id, actor_id, actor_role, type, from_status, to_status, message, created_at) values
    (r, uid_sam, 'tenant', 'submitted', null, 'new', null, now() - interval '3 days'),
    (r, uid_priya, 'manager', 'assigned', 'new', 'assigned', 'Assigned to Dana Okafor', now() - interval '70 hours'),
    (r, uid_dana, 'technician', 'status_changed', 'assigned', 'in_progress', null, now() - interval '2 days'),
    (r, uid_dana, 'technician', 'note', null, null, 'Found a loose back-stab connection at the first outlet. Picking up a replacement GFCI tomorrow morning.', now() - interval '47 hours');

  -- 4: waiting on tenant
  insert into maintenance_requests (org_id, unit_id, created_by, client_request_id, category, description, urgency, priority, status, assignee_id, created_at)
  values (v_org, u_102, uid_hannah, gen_random_uuid(), 'doors_windows',
    'The bedroom window will not stay open and the latch is hard to close. Would like it checked before winter.',
    'routine', 'normal', 'waiting_on_tenant', uid_marcus, now() - interval '5 days') returning id into r;
  insert into assignments (request_id, technician_id, assigned_by) values (r, uid_marcus, uid_priya);
  insert into activity_events (request_id, actor_id, actor_role, type, from_status, to_status, message, created_at) values
    (r, uid_hannah, 'tenant', 'submitted', null, 'new', null, now() - interval '5 days'),
    (r, uid_priya, 'manager', 'assigned', 'new', 'assigned', 'Assigned to Marcus Webb', now() - interval '119 hours'),
    (r, uid_marcus, 'technician', 'status_changed', 'assigned', 'in_progress', null, now() - interval '4 days'),
    (r, uid_marcus, 'technician', 'status_changed', 'in_progress', 'waiting_on_tenant',
      'I stopped by but nobody was home. Which days this week work for me to come in between 9 and 5?', now() - interval '94 hours');

  -- 5: completed
  insert into maintenance_requests (org_id, unit_id, created_by, client_request_id, category, description, urgency, priority, status, assignee_id, completion_note, created_at)
  values (v_org, u_2a, uid_elena, gen_random_uuid(), 'appliance',
    'The dishwasher leaves a film on glasses and the rinse aid light stays on after refilling.',
    'routine', 'low', 'completed', uid_marcus,
    'Cleaned the filter and spray arms and reset the rinse aid sensor. Ran a test cycle; glasses came out clean.', now() - interval '9 days') returning id into r;
  insert into assignments (request_id, technician_id, assigned_by) values (r, uid_marcus, uid_priya);
  insert into activity_events (request_id, actor_id, actor_role, type, from_status, to_status, message, created_at) values
    (r, uid_elena, 'tenant', 'submitted', null, 'new', null, now() - interval '9 days'),
    (r, uid_priya, 'manager', 'assigned', 'new', 'assigned', 'Assigned to Marcus Webb', now() - interval '215 hours'),
    (r, uid_marcus, 'technician', 'status_changed', 'assigned', 'in_progress', null, now() - interval '8 days'),
    (r, uid_marcus, 'technician', 'status_changed', 'in_progress', 'completed',
      'Cleaned the filter and spray arms and reset the rinse aid sensor. Ran a test cycle; glasses came out clean.', now() - interval '189 hours');

  -- 6: new, routine
  insert into maintenance_requests (org_id, unit_id, created_by, client_request_id, category, description, urgency, priority, status, created_at)
  values (v_org, u_202, uid_sam, gen_random_uuid(), 'pests',
    'Seeing ants along the bathroom baseboard every morning. They seem to come from the gap behind the tub.',
    'soon', 'normal', 'new', now() - interval '6 hours') returning id into r;
  insert into activity_events (request_id, actor_id, actor_role, type, to_status, created_at)
  values (r, uid_sam, 'tenant', 'submitted', 'new', now() - interval '6 hours');
end $$;
