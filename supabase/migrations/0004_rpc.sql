-- All client writes go through these functions. They are SECURITY DEFINER (so they can write to
-- tables clients cannot touch), always derive the actor from auth.uid(), re-check role and
-- ownership themselves, enforce the status state machine, and write the activity event.
-- User-facing validation errors use SQLSTATE P0001 and a "psc:" prefix the app can show verbatim.

create function public.psc_fail(p_msg text) returns void
language plpgsql as $$ begin raise exception 'psc: %', p_msg using errcode = 'P0001'; end $$;

-- Mirrors src/domain/transitions.ts
create function public.psc_can_transition(p_role public.member_role, p_from public.request_status, p_to public.request_status)
returns boolean language sql immutable as $$
  select case
    when not ((p_from, p_to) in (
      ('new','assigned'), ('assigned','in_progress'), ('assigned','new'),
      ('in_progress','waiting_on_tenant'), ('in_progress','completed'),
      ('waiting_on_tenant','in_progress'), ('completed','in_progress'))) then false
    when p_role = 'manager' then true
    when p_role = 'technician' then (p_from, p_to) in (
      ('assigned','in_progress'), ('in_progress','waiting_on_tenant'),
      ('in_progress','completed'), ('waiting_on_tenant','in_progress'))
    else false end;
$$;

create function public.psc_log(p_request uuid, p_role public.member_role, p_type public.activity_type,
  p_from public.request_status, p_to public.request_status, p_msg text) returns void
language sql security definer set search_path = public as $$
  insert into activity_events (request_id, actor_id, actor_role, type, from_status, to_status, message)
  values (p_request, auth.uid(), p_role, p_type, p_from, p_to, nullif(trim(p_msg), ''));
  update maintenance_requests set updated_at = now() where id = p_request;
$$;

-- The caller's role relative to a request ('manager' | 'technician' | 'tenant'), or null.
create function public.psc_role_for(p_request uuid) returns public.member_role
language sql stable security definer set search_path = public as $$
  select case
    when public.is_org_manager(r.org_id) then 'manager'::member_role
    when r.assignee_id = auth.uid() and public.is_org_technician(r.org_id) then 'technician'::member_role
    when public.is_tenant_of_unit(r.unit_id) then 'tenant'::member_role
  end from maintenance_requests r where r.id = p_request;
$$;

-- ------------------------------------------------------------------ tenant
create function public.submit_request(p_client_id uuid, p_unit uuid, p_category public.request_category,
  p_description text, p_urgency public.request_urgency)
returns public.maintenance_requests
language plpgsql security definer set search_path = public as $$
declare r maintenance_requests; v_org uuid;
begin
  if auth.uid() is null then perform psc_fail('Please sign in again.'); end if;
  select * into r from maintenance_requests where created_by = auth.uid() and client_request_id = p_client_id;
  if found then return r; end if;                      -- idempotent retry
  if not public.is_tenant_of_unit(p_unit) then perform psc_fail('You can only submit requests for your own unit.'); end if;
  if char_length(trim(p_description)) < 10 then perform psc_fail('Describe the problem in at least 10 characters.'); end if;
  select org_id into v_org from units where id = p_unit;
  insert into maintenance_requests (org_id, unit_id, created_by, client_request_id, category, description, urgency, priority)
  values (v_org, p_unit, auth.uid(), p_client_id, p_category, trim(p_description), p_urgency,
          case when p_urgency = 'emergency' then 'urgent'::request_priority else 'normal' end)
  returning * into r;
  perform psc_log(r.id, 'tenant', 'submitted', null, 'new', null);
  return r;
end $$;

create function public.update_request(p_id uuid, p_category public.request_category, p_description text, p_urgency public.request_urgency)
returns public.maintenance_requests
language plpgsql security definer set search_path = public as $$
declare r maintenance_requests;
begin
  select * into r from maintenance_requests where id = p_id for update;
  if not found or r.created_by <> auth.uid() or not public.is_tenant_of_unit(r.unit_id) then
    perform psc_fail('That request could not be found.'); end if;
  if r.status <> 'new' or r.assignee_id is not null then
    perform psc_fail('This request has been picked up, so it can no longer be edited. Post an update instead.'); end if;
  if char_length(trim(p_description)) < 10 then perform psc_fail('Describe the problem in at least 10 characters.'); end if;
  update maintenance_requests set category = p_category, description = trim(p_description), urgency = p_urgency
    where id = p_id returning * into r;
  perform psc_log(p_id, 'tenant', 'edited', null, null, 'Tenant edited the request details');
  return r;
end $$;

create function public.withdraw_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r maintenance_requests;
begin
  select * into r from maintenance_requests where id = p_id for update;
  if not found or r.created_by <> auth.uid() then perform psc_fail('That request could not be found.'); end if;
  if r.status <> 'new' or r.assignee_id is not null then
    perform psc_fail('This request has been picked up, so it can no longer be withdrawn.'); end if;
  delete from maintenance_requests where id = p_id;     -- cascades events, photo rows
end $$;

-- ------------------------------------------------------------------ manager
create function public.assign_request(p_id uuid, p_tech uuid)
returns public.maintenance_requests
language plpgsql security definer set search_path = public as $$
declare r maintenance_requests; v_name text;
begin
  select * into r from maintenance_requests where id = p_id for update;
  if not found or not public.is_org_manager(r.org_id) then perform psc_fail('You don''t have permission to do that.'); end if;
  if p_tech is null then
    if not public.psc_can_transition('manager', r.status, 'new') then perform psc_fail('Only assigned requests can be unassigned.'); end if;
    update assignments set unassigned_at = now() where request_id = p_id and unassigned_at is null;
    update maintenance_requests set assignee_id = null, status = 'new' where id = p_id returning * into r;
    perform psc_log(p_id, 'manager', 'unassigned', 'assigned', 'new', 'Unassigned');
    return r;
  end if;
  if not exists (select 1 from memberships m where m.user_id = p_tech and m.org_id = r.org_id and m.role = 'technician') then
    perform psc_fail('Choose a technician from your team.'); end if;
  if r.status not in ('new', 'assigned') then
    perform psc_fail('Work has already started. Move the request back before reassigning.'); end if;
  select full_name into v_name from profiles where id = p_tech;
  update assignments set unassigned_at = now() where request_id = p_id and unassigned_at is null;
  insert into assignments (request_id, technician_id, assigned_by) values (p_id, p_tech, auth.uid());
  if r.status = 'new' then
    update maintenance_requests set assignee_id = p_tech, status = 'assigned' where id = p_id returning * into r;
    perform psc_log(p_id, 'manager', 'assigned', 'new', 'assigned', 'Assigned to ' || v_name);
  else
    update maintenance_requests set assignee_id = p_tech where id = p_id returning * into r;
    perform psc_log(p_id, 'manager', 'assigned', null, null, 'Reassigned to ' || v_name);
  end if;
  return r;
end $$;

create function public.set_priority(p_id uuid, p_priority public.request_priority)
returns public.maintenance_requests
language plpgsql security definer set search_path = public as $$
declare r maintenance_requests;
begin
  select * into r from maintenance_requests where id = p_id for update;
  if not found or not public.is_org_manager(r.org_id) then perform psc_fail('You don''t have permission to do that.'); end if;
  if r.priority <> p_priority then
    update maintenance_requests set priority = p_priority where id = p_id returning * into r;
    perform psc_log(p_id, 'manager', 'priority_changed', null, null, 'Priority set to ' || initcap(p_priority::text));
  end if;
  return r;
end $$;

-- ------------------------------------------------------------------ manager + technician
create function public.change_status(p_id uuid, p_to public.request_status, p_note text default null)
returns public.maintenance_requests
language plpgsql security definer set search_path = public as $$
declare r maintenance_requests; v_role public.member_role; v_from public.request_status;
begin
  select * into r from maintenance_requests where id = p_id for update;
  if not found then perform psc_fail('That request could not be found.'); end if;
  v_role := public.psc_role_for(p_id);
  if v_role is null or v_role = 'tenant' then perform psc_fail('You don''t have permission to do that.'); end if;
  v_from := r.status;
  if p_to in ('new', 'assigned') then perform psc_fail('Use assign to move a request to or from New or Assigned.'); end if;
  if not public.psc_can_transition(v_role, v_from, p_to) then perform psc_fail('That status change is not allowed for this request.'); end if;
  if p_to in ('completed', 'waiting_on_tenant') and char_length(trim(coalesce(p_note, ''))) < 5 then
    perform psc_fail(case p_to when 'completed' then 'Add a completion note describing the work done.'
                               else 'Tell the tenant what you need from them.' end);
  end if;
  update maintenance_requests
    set status = p_to,
        completion_note = case when p_to = 'completed' then trim(p_note) when v_from = 'completed' then null else completion_note end
    where id = p_id returning * into r;
  perform psc_log(p_id, v_role, 'status_changed', v_from, p_to, p_note);
  return r;
end $$;

-- ------------------------------------------------------------------ everyone who can see the request
create function public.post_update(p_id uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare v_role public.member_role;
begin
  v_role := public.psc_role_for(p_id);
  if v_role is null then perform psc_fail('That request could not be found.'); end if;
  if char_length(trim(coalesce(p_message, ''))) < 2 or char_length(p_message) > 1000 then
    perform psc_fail('Write a short message first.'); end if;
  perform psc_log(p_id, v_role, 'note', null, null, p_message);
end $$;

-- Call AFTER uploading the object. Verifies the path belongs to this request.
create function public.add_photo(p_request uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare v_role public.member_role; r maintenance_requests;
begin
  v_role := public.psc_role_for(p_request);
  if v_role is null then perform psc_fail('That request could not be found.'); end if;
  select * into r from maintenance_requests where id = p_request;
  if v_role = 'tenant' and r.status = 'completed' then perform psc_fail('This request is completed. Photos can''t be added.'); end if;
  if split_part(p_path, '/', 1) <> r.org_id::text or split_part(p_path, '/', 2) <> p_request::text then
    perform psc_fail('That photo does not belong to this request.'); end if;
  insert into request_photos (request_id, storage_path, uploaded_by) values (p_request, p_path, auth.uid())
    on conflict (storage_path) do nothing;
  perform psc_log(p_request, v_role, 'photo_added', null, null, 'Added a photo');
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.psc_fail(text), public.psc_log(uuid, member_role, activity_type, request_status, request_status, text),
  public.psc_role_for(uuid), public.psc_can_transition(member_role, request_status, request_status) from public, anon, authenticated;
revoke all on function public.submit_request(uuid, uuid, request_category, text, request_urgency),
  public.update_request(uuid, request_category, text, request_urgency), public.withdraw_request(uuid),
  public.assign_request(uuid, uuid), public.set_priority(uuid, request_priority),
  public.change_status(uuid, request_status, text), public.post_update(uuid, text), public.add_photo(uuid, text)
  from public, anon;
grant execute on function public.submit_request(uuid, uuid, request_category, text, request_urgency),
  public.update_request(uuid, request_category, text, request_urgency), public.withdraw_request(uuid),
  public.assign_request(uuid, uuid), public.set_priority(uuid, request_priority),
  public.change_status(uuid, request_status, text), public.post_update(uuid, text), public.add_photo(uuid, text)
  to authenticated;
