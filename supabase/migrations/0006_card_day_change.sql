-- Changing a card's closing or due day "from the next bill": the card keeps
-- the old days for invoices before days_from (an invoice month, YYYY-MM-01).
-- All three are null when no change is scheduled.
alter table public.cards
  add column old_closing_day int check (old_closing_day between 1 and 31),
  add column old_due_day int check (old_due_day between 1 and 31),
  add column days_from date;
