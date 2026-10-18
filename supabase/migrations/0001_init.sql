-- Tally: accounts, categories and transactions.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Every row belongs to the signed-in user; row-level security keeps it that way.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'icon:bank',
  color text not null default '#9ca3af',
  initial_balance_cents bigint not null default 0,
  exclude_from_total boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'other',
  color text not null default '#9ca3af',
  parent_id uuid references public.categories (id) on delete cascade,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  description text not null default '',
  amount_cents bigint not null check (amount_cents >= 0),
  date date not null,
  paid boolean not null default true,
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- Only for transfers: the account the money went into.
  to_account_id uuid references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check ((kind = 'transfer') = (to_account_id is not null))
);

create index transactions_user_date on public.transactions (user_id, date);
create index categories_user on public.categories (user_id);
create index accounts_user on public.accounts (user_id);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "own accounts" on public.accounts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own categories" on public.categories
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.accounts, public.categories, public.transactions to authenticated;
