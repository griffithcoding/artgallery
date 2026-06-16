-- ===== updated_at trigger =====
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ===== artists =====
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  birthplace text default '',
  birth_year int,
  discipline text default '',
  bio text default '',
  portrait_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== artworks =====
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  artist_id uuid references public.artists(id) on delete set null,
  year int,
  medium text default '',
  category text default '',
  subject text default '',
  dimensions text default '',
  ratio text default 'square',
  availability text not null default 'Available' check (availability in ('Available','Inquire','Sold')),
  image_url text,
  featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== exhibitions =====
create table if not exists public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text default '',
  status text not null default 'Upcoming' check (status in ('On View','Upcoming','Past')),
  start_date date,
  end_date date,
  blurb text default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.exhibition_artists (
  exhibition_id uuid references public.exhibitions(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  primary key (exhibition_id, artist_id)
);

-- ===== fairs =====
create table if not exists public.fairs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text default '',
  booth text default '',
  dates text default '',
  status text not null default 'Upcoming' check (status in ('Upcoming','Past')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== viewing_rooms =====
create table if not exists public.viewing_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.viewing_room_artworks (
  viewing_room_id uuid references public.viewing_rooms(id) on delete cascade,
  artwork_id uuid references public.artworks(id) on delete cascade,
  position int not null default 0,
  primary key (viewing_room_id, artwork_id)
);

-- ===== inquiries =====
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid references public.artworks(id) on delete set null,
  artwork_title text default '',
  name text not null,
  email text not null,
  message text default '',
  status text not null default 'new' check (status in ('new','replied','archived')),
  source text not null default 'contact' check (source in ('artwork','contact')),
  created_at timestamptz not null default now()
);

-- ===== posts (journal/press) =====
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text default '',
  body text default '',
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  category text not null default 'Journal' check (category in ('Journal','Press','Exhibitions')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== press_mentions =====
create table if not exists public.press_mentions (
  id uuid primary key default gen_random_uuid(),
  outlet text not null,
  headline text not null,
  url text default '',
  date text default '',
  kind text not null default 'Feature' check (kind in ('Review','Feature','Listing','Profile')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== updated_at triggers =====
do $$ declare t text;
begin
  foreach t in array array['artists','artworks','exhibitions','fairs','viewing_rooms','posts','press_mentions']
  loop
    execute format('drop trigger if exists trg_%s_touch on public.%s;', t, t);
    execute format('create trigger trg_%s_touch before update on public.%s for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

-- ===== RLS =====
alter table public.artists enable row level security;
alter table public.artworks enable row level security;
alter table public.exhibitions enable row level security;
alter table public.exhibition_artists enable row level security;
alter table public.fairs enable row level security;
alter table public.viewing_rooms enable row level security;
alter table public.viewing_room_artworks enable row level security;
alter table public.inquiries enable row level security;
alter table public.posts enable row level security;
alter table public.press_mentions enable row level security;

-- public read for catalogue tables
do $$ declare t text;
begin
  foreach t in array array['artists','artworks','exhibitions','exhibition_artists','fairs','viewing_rooms','viewing_room_artworks','press_mentions']
  loop
    execute format('drop policy if exists %s_public_read on public.%s;', t, t);
    execute format('create policy %s_public_read on public.%s for select using (true);', t, t);
  end loop;
end $$;

-- posts: anon reads published; authenticated reads all
drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select using (status = 'published');
drop policy if exists posts_auth_read on public.posts;
create policy posts_auth_read on public.posts for select to authenticated using (true);

-- inquiries: NO public policies (service-role only for insert + read)

-- ===== storage bucket =====
insert into storage.buckets (id, name, public)
values ('gallery-images','gallery-images', true)
on conflict (id) do nothing;
drop policy if exists galleryimg_public_read on storage.objects;
create policy galleryimg_public_read on storage.objects
  for select using (bucket_id = 'gallery-images');
-- writes via service-role key only (no anon/auth write policy).
