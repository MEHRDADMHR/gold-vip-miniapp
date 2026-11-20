-- GOLDEN CLUB initial schema (Supabase / PostgreSQL)
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id text primary key,
  title text not null,
  duration_days integer not null check (duration_days > 0),
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency text not null default 'IRR',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled','refunded')),
  starts_at timestamptz,
  expires_at timestamptz,
  payment_provider text,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_expiry_idx
  on public.subscriptions(user_id, status, expires_at desc);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  storage_key text not null,
  preview_seconds integer not null default 30 check (preview_seconds between 0 and 300),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references public.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','editor')),
  created_at timestamptz not null default now()
);

insert into public.plans (id, title, duration_days, price_minor, currency, sort_order)
values
  ('monthly', 'ماهانه', 30, 0, 'IRR', 1),
  ('quarterly', 'سه‌ماهه', 90, 0, 'IRR', 2),
  ('half_year', 'شش‌ماهه', 180, 0, 'IRR', 3),
  ('yearly', 'سالانه', 365, 0, 'IRR', 4)
on conflict (id) do nothing;

-- All application data is accessed through server-side service-role credentials.
alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.videos enable row level security;
alter table public.admins enable row level security;

-- Explicit Data API grants for server-side access (required on projects
-- where new public tables are not automatically exposed).
grant usage on schema public to service_role;

grant select, insert, update, delete
on table
  public.users,
  public.plans,
  public.subscriptions,
  public.videos,
  public.admins
 to service_role;
