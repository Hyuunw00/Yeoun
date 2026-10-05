-- Yeoun: server mirror of the phone's SQLite tables, one copy per user.
-- The phone stays the source of truth; `id` is the phone's local row id,
-- unique per user. Applied manually in the Supabase SQL editor.

create table if not exists public.works (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id bigint not null,
  category text not null,
  external_id text not null,
  title text not null,
  subtitle text,
  year text,
  image_url text,
  created_at text not null,
  release_date text,
  backdrop_url text,
  credits text,
  format text,
  primary key (user_id, id)
);

-- Added later: music release format (single / ep / album)
alter table public.works add column if not exists format text;
-- Added later: travel city location and ISO country code
alter table public.works add column if not exists latitude double precision;
alter table public.works add column if not exists longitude double precision;
alter table public.works add column if not exists country_code text;
-- Added later: photo chosen for a city's postcard
alter table public.works add column if not exists cover_photo text;

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id bigint not null,
  work_id bigint not null,
  body text not null,
  experienced_on text not null,
  created_at text not null,
  updated_at text not null,
  episode text,
  rating real,
  track text,
  moment text,
  primary key (user_id, id)
);

-- Added after the first version: music track and listening moment
alter table public.records add column if not exists track text;
alter table public.records add column if not exists moment text;
-- Added later: last day of a multi-day trip
alter table public.records add column if not exists ended_on text;
-- Added later: how a trip was made and the home city it left from (JSON)
alter table public.records add column if not exists transport text;
alter table public.records add column if not exists origin text;

create table if not exists public.record_photos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id bigint not null,
  record_id bigint not null,
  file_name text not null,
  position integer not null,
  primary key (user_id, id)
);

create table if not exists public.record_quotes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id bigint not null,
  record_id bigint not null,
  quote text not null,
  page text,
  note text,
  position integer not null,
  primary key (user_id, id)
);

-- Every user reads and writes only their own rows
do $$
declare
  t text;
begin
  foreach t in array array['works', 'records', 'record_photos', 'record_quotes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Own rows" on public.%I', t);
    execute format(
      'create policy "Own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
