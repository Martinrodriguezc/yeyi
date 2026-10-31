-- Yeyi waitlist (Prueba A). Run once in the Supabase SQL editor.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  curso smallint not null check (curso between 1 and 6),
  utm_source text check (length(utm_source) <= 100),
  utm_campaign text check (length(utm_campaign) <= 100),
  utm_content text check (length(utm_content) <= 100),
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- The landing can only insert. Nobody can read the list with the public key.
drop policy if exists "landing inserts" on public.waitlist;
create policy "landing inserts" on public.waitlist for insert to anon with check (true);
