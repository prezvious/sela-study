-- Run once in the SQL Editor of your own Supabase project.
create table if not exists public.study_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.study_data enable row level security;
drop policy if exists "Read own study data" on public.study_data;
create policy "Read own study data" on public.study_data for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own study data" on public.study_data;
create policy "Insert own study data" on public.study_data for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own study data" on public.study_data;
create policy "Update own study data" on public.study_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.study_data from anon;
grant select, insert, update on public.study_data to authenticated;

-- Revision matching prevents another device's newer backup being overwritten silently.
-- Remove the previous signature so every app write supplies its confirmed account.
drop function if exists public.save_study_data(jsonb,bigint);
create or replace function public.save_study_data(p_data jsonb, p_expected_revision bigint, p_expected_user_id uuid)
returns bigint language plpgsql security invoker set search_path = public as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_expected_user_id is distinct from auth.uid() then raise exception 'ACCOUNT_CHANGED'; end if;
  if p_data->>'version' is distinct from '2' then raise exception 'INVALID_DATA'; end if;
  if p_expected_revision = 0 then
    insert into public.study_data (user_id, data, revision) values (auth.uid(), p_data, 1)
    on conflict (user_id) do nothing returning revision into next_revision;
  else
    update public.study_data set data = p_data, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = p_expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'CLOUD_CONFLICT'; end if;
  return next_revision;
end;
$$;
revoke all on function public.save_study_data(jsonb,bigint,uuid) from public, anon;
grant execute on function public.save_study_data(jsonb,bigint,uuid) to authenticated;
