-- Entries: one row per manually logged holding, owned by the signed-in user.
-- Run once in Supabase → SQL Editor.

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'crypto' check (kind = 'crypto'),
  asset text not null,
  -- numeric keeps the amount exact (no floating-point rounding).
  amount numeric not null,
  created_at timestamptz not null default now()
);

create index entries_user_created_idx on public.entries (user_id, created_at desc);

-- The app's key is public, so every row is locked to its owner.
alter table public.entries enable row level security;

create policy "Read own entries" on public.entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own entries" on public.entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own entries" on public.entries
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own entries" on public.entries
  for delete to authenticated using ((select auth.uid()) = user_id);
