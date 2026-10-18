-- Tally step 3: credit cards and invoices (faturas).
-- Paste this whole file into Supabase → SQL Editor → New query → Run, once.

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'icon:bank',
  color text not null default '#9ca3af',
  limit_cents bigint not null default 0 check (limit_cents >= 0),
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  -- The open invoice counts in this account's forecast until it is paid.
  payment_account_id uuid references public.accounts (id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index cards_user on public.cards (user_id);
alter table public.cards enable row level security;
create policy "own cards" on public.cards
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.cards to authenticated;

-- Card purchases have a card instead of an account. Invoice payments
-- ("payment") come out of an account and go to a card's invoice.
alter table public.transactions alter column account_id drop not null;
alter table public.transactions
  add column card_id uuid references public.cards (id) on delete cascade,
  -- The invoice a card entry belongs to, as the first day of the month it is due.
  add column invoice_month date check (invoice_month is null or extract(day from invoice_month) = 1);

-- Allow the new "payment" kind (the old check only knew expense/income/transfer).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.transactions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%''transfer''%' and pg_get_constraintdef(oid) like '%''income''%'
  loop
    execute format('alter table public.transactions drop constraint %I', c);
  end loop;
end $$;

alter table public.transactions
  add constraint transactions_kind_check check (kind in ('expense', 'income', 'transfer', 'payment')),
  add constraint transactions_source_check check (
    (kind in ('expense', 'income') and (account_id is null) <> (card_id is null) and to_account_id is null)
    or (kind = 'transfer' and account_id is not null and to_account_id is not null and card_id is null)
    or (kind = 'payment' and account_id is not null and card_id is not null and to_account_id is null)
  ),
  add constraint transactions_invoice_check check ((card_id is null) = (invoice_month is null));

create index transactions_card on public.transactions (card_id, invoice_month);
