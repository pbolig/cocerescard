create table if not exists public.vehicles (
  id bigint primary key,
  seller_id uuid references auth.users(id) on delete set null,
  title text not null,
  brand text not null,
  model text not null,
  year integer not null,
  price_ars bigint not null,
  mileage_km integer not null default 0,
  location text not null,
  image_url text not null, -- Mantenemos URL principal como fallback o portada
  image_urls text[] not null default '{}', -- Atributo para múltiples imagenes en array
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

alter table public.vehicles add column if not exists seller_id uuid references auth.users(id) on delete set null;

create sequence if not exists public.vehicles_id_seq;
select setval('public.vehicles_id_seq', greatest(coalesce((select max(id) from public.vehicles), 0), 1), true);
alter table public.vehicles alter column id set default nextval('public.vehicles_id_seq');
alter sequence public.vehicles_id_seq owned by public.vehicles.id;

create sequence if not exists public.price_references_id_seq;
select setval('public.price_references_id_seq', greatest(coalesce((select max(id) from public.price_references), 0), 1), true);
alter table public.price_references alter column id set default nextval('public.price_references_id_seq');
alter sequence public.price_references_id_seq owned by public.price_references.id;

drop policy if exists "Public can read vehicles" on public.vehicles;
create policy "Public can read vehicles" on public.vehicles for select using (true);

drop policy if exists "Public can read price references" on public.price_references;
create policy "Public can read price references" on public.price_references for select using (true);

drop policy if exists "Authenticated users can publish vehicles" on public.vehicles;
create policy "Authenticated users can publish vehicles"
on public.vehicles for insert to authenticated
with check (auth.uid() = seller_id);

drop policy if exists "Sellers and admins can update vehicles" on public.vehicles;
create policy "Sellers and admins can update vehicles"
on public.vehicles for update to authenticated
using (
  auth.uid() = seller_id or
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  auth.uid() = seller_id or
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Sellers and admins can delete vehicles" on public.vehicles;
create policy "Sellers and admins can delete vehicles"
on public.vehicles for delete to authenticated
using (
  auth.uid() = seller_id or
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

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
with check (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Authenticated users can update vehicle images" on storage.objects;
create policy "Authenticated users can update vehicle images"
on storage.objects for update to authenticated
using (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users can delete their vehicle images" on storage.objects;
create policy "Users can delete their vehicle images"
on storage.objects for delete to authenticated
using (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- Policy para que los mismos dueños puedan borrar del bucket
drop policy if exists "Authenticated users can delete their own vehicle images" on storage.objects;
create policy "Authenticated users can delete their own vehicle images"
on storage.objects for delete to authenticated
using (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Tabla de perfiles de usuario para roles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'comprador' check (role in ('comprador', 'vendedor', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Políticas para perfiles
drop policy if exists "Public profiles are viewable by authenticated users" on public.profiles;
create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "Only admins can update profiles" on public.profiles;
create policy "Only admins can update profiles"
  on public.profiles for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Trigger para crear perfiles automáticamente cuando un usuario se registra
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_role text := 'comprador';
begin
  -- Si es el primer usuario, lo definimos como admin superusuario
  if not exists (select 1 from public.profiles where role = 'admin') then
    default_role := 'admin';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, default_role)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Poblar perfiles para usuarios existentes si los hay
insert into public.profiles (id, email, role)
select id, email, 'comprador'
from auth.users
on conflict (id) do nothing;

-- Asegurar al menos un administrador si ya había usuarios
update public.profiles
set role = 'admin'
where id = (select id from public.profiles order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- Tabla de consultas / contactos de interesados en automóviles
create table if not exists public.inquiries (
  id bigint primary key generated always as identity,
  vehicle_id bigint references public.vehicles(id) on delete set null, -- Null en lugar de delete cascade si borramos el vehiculo
  vehicle_title_cache text, -- Campo histórico para preservar el título del anuncio dado de baja
  seller_id_cache uuid references public.profiles(id) on delete set null, -- Campo para preservar a quién pertenecía el auto
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;

-- Políticas para consultas
drop policy if exists "Buyers can read their own inquiries" on public.inquiries;
create policy "Buyers can read their own inquiries"
  on public.inquiries for select to authenticated
  using (auth.uid() = buyer_id);

drop policy if exists "Buyers can create inquiries" on public.inquiries;
create policy "Buyers can create inquiries"
  on public.inquiries for insert to authenticated
  with check (auth.uid() = buyer_id);

drop policy if exists "Sellers can read inquiries for their vehicles" on public.inquiries;
create policy "Sellers can read inquiries for their vehicles"
  on public.inquiries for select to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = inquiries.vehicle_id and v.seller_id = auth.uid()
    ) or (
      inquiries.seller_id_cache = auth.uid()
    )
  );

drop policy if exists "Admins can read all inquiries" on public.inquiries;
create policy "Admins can read all inquiries"
  on public.inquiries for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

