-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run? No: run on a fresh project.
create extension if not exists pgcrypto;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'custom' check (kind in ('cash','bkash','nagad','bank','custom')),
  opening_balance numeric(14,2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  name_bn text,
  type text not null check (type in ('expense','income')),
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income','transfer')),
  amount numeric(14,2) not null check (amount > 0 and amount <= 999999999),
  account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  note text check (char_length(note) <= 200),
  occurred_on date not null,
  source text not null default 'manual' check (source in ('manual','ai','import')),
  created_at timestamptz not null default now(),
  check ((type = 'transfer' and to_account_id is not null and to_account_id <> account_id and category_id is null)
      or (type <> 'transfer' and to_account_id is null))
);
create index tx_user_date on public.transactions (user_id, occurred_on desc, created_at desc);
create index tx_user_cat on public.transactions (user_id, category_id);
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade, -- null = overall monthly budget
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create unique index budgets_uq on public.budgets (user_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid));
create table public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index chat_user_time on public.chat_messages (user_id, created_at desc);

-- Row Level Security: every row is private to its owner.
do $$ declare t text; begin
  foreach t in array array['accounts','categories','transactions','budgets','pending_actions','chat_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;

-- A transaction may only reference the owner's own accounts/categories.
create function public.check_tx_owner() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from accounts where id = new.account_id and user_id = new.user_id) then raise exception 'invalid account'; end if;
  if new.to_account_id is not null and not exists (select 1 from accounts where id = new.to_account_id and user_id = new.user_id) then raise exception 'invalid account'; end if;
  if new.category_id is not null and not exists (select 1 from categories where id = new.category_id and user_id = new.user_id) then raise exception 'invalid category'; end if;
  return new;
end $$;
create trigger tx_owner before insert or update on public.transactions for each row execute function public.check_tx_owner();

-- Seed default accounts and categories for each new user.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into accounts (user_id, name, kind) values
    (new.id,'Cash','cash'), (new.id,'bKash','bkash'), (new.id,'Nagad','nagad'), (new.id,'Bank','bank');
  insert into categories (user_id, name, name_bn, type) values
    (new.id,'Food','খাবার','expense'), (new.id,'Groceries','বাজার','expense'), (new.id,'Transport','যাতায়াত','expense'),
    (new.id,'Bills','বিল','expense'), (new.id,'Rent','ভাড়া','expense'), (new.id,'Shopping','কেনাকাটা','expense'),
    (new.id,'Health','স্বাস্থ্য','expense'), (new.id,'Education','শিক্ষা','expense'), (new.id,'Entertainment','বিনোদন','expense'),
    (new.id,'Mobile & Internet','মোবাইল ও ইন্টারনেট','expense'), (new.id,'Family','পরিবার','expense'), (new.id,'Other','অন্যান্য','expense'),
    (new.id,'Salary','বেতন','income'), (new.id,'Business','ব্যবসা','income'), (new.id,'Gift','উপহার','income'), (new.id,'Other','অন্যান্য','income');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- All money math lives here. Views/functions run as the caller, so RLS applies.
create view public.account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.opening_balance, a.archived,
  a.opening_balance + coalesce(sum(case
    when t.account_id = a.id and t.type = 'income' then t.amount
    when t.account_id = a.id and t.type in ('expense','transfer') then -t.amount
    when t.to_account_id = a.id and t.type = 'transfer' then t.amount
    else 0 end), 0) as balance
from public.accounts a
left join public.transactions t on t.account_id = a.id or t.to_account_id = a.id
group by a.id;

create function public.summary(p_from date, p_to date, p_category uuid default null, p_account uuid default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with t as (
    select * from transactions
    where occurred_on between p_from and p_to and type <> 'transfer'
      and (p_category is null or category_id = p_category) and (p_account is null or account_id = p_account)),
  tot as (select coalesce(sum(amount) filter (where type = 'income'), 0) income,
                 coalesce(sum(amount) filter (where type = 'expense'), 0) expense, count(*) n from t),
  cat as (select coalesce(c.name, 'Uncategorized') name, c.name_bn, t.type, sum(t.amount) total, count(*) n
          from t left join categories c on c.id = t.category_id group by 1, 2, 3),
  day as (select occurred_on d, coalesce(sum(amount) filter (where type = 'income'), 0) income,
                 coalesce(sum(amount) filter (where type = 'expense'), 0) expense from t group by 1)
  select jsonb_build_object('income', tot.income, 'expense', tot.expense, 'net', tot.income - tot.expense, 'count', tot.n,
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'name_bn', name_bn, 'type', type, 'total', total, 'count', n) order by total desc) from cat), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'income', income, 'expense', expense) order by d) from day), '[]'::jsonb))
  from tot;
$$;

create function public.budget_status(p_from date, p_to date)
returns table (id uuid, category_id uuid, name text, name_bn text, amount numeric, spent numeric, remaining numeric, pct numeric)
language sql stable security invoker set search_path = public as $$
  select b.id, b.category_id, coalesce(c.name, 'Overall'), c.name_bn, b.amount,
         coalesce(s.spent, 0), b.amount - coalesce(s.spent, 0), round(coalesce(s.spent, 0) / nullif(b.amount, 0) * 100, 1)
  from budgets b left join categories c on c.id = b.category_id
  left join lateral (select sum(t.amount) spent from transactions t
    where t.type = 'expense' and t.occurred_on between p_from and p_to
      and (b.category_id is null or t.category_id = b.category_id)) s on true
  order by 8 desc nulls last;
$$;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
