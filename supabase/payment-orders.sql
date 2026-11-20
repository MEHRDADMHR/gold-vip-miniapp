-- Loti Premium: manual payment orders
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  payment_method text not null check (payment_method in ('usdt', 'card')),
  network text check (network in ('bep20', 'solana', 'polygon')),
  payment_reference text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_orders_method_network_check check (
    (payment_method = 'usdt' and network is not null) or
    (payment_method = 'card' and network is null)
  )
);

create index if not exists payment_orders_user_created_idx
  on public.payment_orders(user_id, created_at desc);

create index if not exists payment_orders_status_created_idx
  on public.payment_orders(status, created_at asc);

alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon, authenticated;
grant select, insert, update, delete on public.payment_orders to service_role;
