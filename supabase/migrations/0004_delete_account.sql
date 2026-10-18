-- "Excluir minha conta" in Preferências. Deletes the signed-in user; every
-- table references auth.users with on delete cascade, so their data goes too.
-- Attachment files are removed by the app before it calls this.
create or replace function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
