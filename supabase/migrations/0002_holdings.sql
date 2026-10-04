-- Holdings: named cards that group entries (e.g. "Binance", "Cash").
-- Run once in Supabase → SQL Editor, after 0001.

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.holdings enable row level security;

create policy "Read own holdings" on public.holdings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own holdings" on public.holdings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own holdings" on public.holdings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own holdings" on public.holdings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Every entry belongs to a holding. Existing entries move into one "Crypto" holding per user.
alter table public.entries
  add column holding_id uuid references public.holdings on delete cascade;

insert into public.holdings (user_id, name)
  select distinct user_id, 'Crypto' from public.entries;

update public.entries e
  set holding_id = h.id
  from public.holdings h
  where h.user_id = e.user_id and e.holding_id is null;

alter table public.entries alter column holding_id set not null;

-- The asset says what an entry is; "kind" is no longer needed (USD isn't crypto).
alter table public.entries drop column kind;

create index entries_holding_created_idx on public.entries (holding_id, created_at);
