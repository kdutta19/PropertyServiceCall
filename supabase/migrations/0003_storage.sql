-- Private bucket for request photos. Object path convention: {org_id}/{request_id}/{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-photos', 'request-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Parses {org}/{request}/{file}; returns null for malformed paths so policies fail closed.
create function public.photo_request_id(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return (storage.foldername(p_name))[2]::uuid;
exception when others then
  return null;
end $$;

-- Read: anyone who can view the request may read its photos (display uses short-lived signed URLs).
create policy "request photos readable by request viewers" on storage.objects for select to authenticated
  using (
    bucket_id = 'request-photos'
    and public.photo_request_id(name) is not null
    and public.can_view_request(public.photo_request_id(name))
  );

-- Upload: only people who can view the request, only into that request's folder, and the first
-- folder segment must be the request's real org (prevents writing into someone else's org prefix).
create policy "request photos uploadable by request viewers" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'request-photos'
    and public.photo_request_id(name) is not null
    and public.can_view_request(public.photo_request_id(name))
    and (storage.foldername(name))[1] = (
      select r.org_id::text from public.maintenance_requests r where r.id = public.photo_request_id(name))
  );

-- No update or delete policies: photos are append-only from the client. Managers remove via dashboard.
