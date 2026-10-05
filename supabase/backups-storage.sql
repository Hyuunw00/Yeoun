-- Yeoun: private bucket for per-user backups (snapshot.json + photos).
-- Applied manually in the Supabase SQL editor on 2026-10-05.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- Each signed-in user can only touch files under their own user id folder
drop policy if exists "Yeoun backups: read own" on storage.objects;
create policy "Yeoun backups: read own" on storage.objects for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Yeoun backups: insert own" on storage.objects;
create policy "Yeoun backups: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Yeoun backups: update own" on storage.objects;
create policy "Yeoun backups: update own" on storage.objects for update to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Yeoun backups: delete own" on storage.objects;
create policy "Yeoun backups: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
