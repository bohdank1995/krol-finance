-- Holding type: decides which assets a holding can contain.
-- Run once in Supabase → SQL Editor, after 0002.

alter table public.holdings
  add column type text not null default 'crypto' check (type in ('money', 'crypto', 'stocks'));

-- Existing holdings that only contain USD become "money".
update public.holdings h set type = 'money'
  where exists (select 1 from public.entries e where e.holding_id = h.id)
    and not exists (select 1 from public.entries e where e.holding_id = h.id and e.asset <> 'USD');
