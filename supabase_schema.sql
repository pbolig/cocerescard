create table if not exists public.vehicles (
  id bigint primary key,
  title text not null,
  brand text not null,
  model text not null,
  year integer not null,
  price_ars bigint not null,
  mileage_km integer not null default 0,
  location text not null,
  image_url text not null,
  description text not null default '',
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_references (
  id bigint primary key,
  vehicle_id bigint not null references public.vehicles(id) on delete cascade,
  source text not null,
  source_label text not null,
  price_ars bigint not null,
  url text,
  captured_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;
alter table public.price_references enable row level security;

drop policy if exists "Public can read vehicles" on public.vehicles;
create policy "Public can read vehicles" on public.vehicles for select using (true);

drop policy if exists "Public can read price references" on public.price_references;
create policy "Public can read price references" on public.price_references for select using (true);

insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read vehicle images" on storage.objects;
create policy "Public can read vehicle images"
on storage.objects for select
using (bucket_id = 'vehicle-images');

drop policy if exists "Authenticated users can upload vehicle images" on storage.objects;
create policy "Authenticated users can upload vehicle images"
on storage.objects for insert to authenticated
with check (bucket_id = 'vehicle-images');

drop policy if exists "Authenticated users can update vehicle images" on storage.objects;
create policy "Authenticated users can update vehicle images"
on storage.objects for update to authenticated
using (bucket_id = 'vehicle-images')
with check (bucket_id = 'vehicle-images');
