-- Tally step 2: recurring and instalment entries, tags and attachments.
-- Paste this whole file into Supabase → SQL Editor → New query → Run, once.

-- A series links the entries created by "Repetir": a fixed (recurring) entry
-- or an instalment purchase. Each entry in it is a normal transaction row.
create table public.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('fixed', 'installment')),
  period text not null check (period in ('yearly', 'semiannual', 'quarterly', 'bimonthly', 'monthly', 'biweekly', 'weekly', 'daily')),
  -- Date of the first entry; later dates are counted from it.
  start_date date not null,
  -- Instalments: how many in total. Fixed entries: null.
  installments int check (installments is null or installments between 2 and 480),
  -- How many entries have been created so far. Fixed entries are created
  -- ahead of time and topped up as the months go by.
  generated_count int not null default 0,
  -- A fixed entry stops repeating once the user deletes "este e os próximos".
  ended boolean not null default false,
  created_at timestamptz not null default now(),
  check ((kind = 'installment') = (installments is not null))
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create unique index tags_user_name on public.tags (user_id, lower(name));

alter table public.transactions
  add column series_id uuid references public.series (id) on delete set null,
  -- Position in the series, starting at 1 (shown as "2/10" for instalments).
  add column series_index int,
  add column tag_ids uuid[] not null default '{}',
  -- [{ "path": "<user>/<transaction>/<file>", "name": "recibo.pdf", "size": 12345 }]
  add column attachments jsonb not null default '[]';

create index transactions_series on public.transactions (series_id, series_index);
create index series_user on public.series (user_id);

alter table public.series enable row level security;
alter table public.tags enable row level security;

create policy "own series" on public.series
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tags" on public.tags
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.series, public.tags to authenticated;

-- Attachments live in a private storage bucket, in a folder named after the user.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do nothing;

create policy "own attachments" on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
