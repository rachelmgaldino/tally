-- Currencies. Each account and card is in one currency (reais unless chosen
-- otherwise), and a transfer between accounts in different currencies keeps
-- both sides: amount_cents left account_id, to_amount_cents landed in
-- to_account_id. Existing rows stay in reais.
alter table public.accounts
  add column currency text not null default 'BRL'
  check (currency in ('BRL', 'USD', 'CAD', 'EUR', 'GBP'));

alter table public.cards
  add column currency text not null default 'BRL'
  check (currency in ('BRL', 'USD', 'CAD', 'EUR', 'GBP'));

alter table public.transactions
  add column to_amount_cents bigint
  check (to_amount_cents is null or (kind = 'transfer' and to_amount_cents > 0));
