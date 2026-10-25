-- Clear: account storage for "My activity".
-- Paste into the Supabase SQL editor once. Linked wallets need no table:
-- they live in each user's own auth metadata.

create table if not exists public.activity (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id   text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

-- Every query is limited to the signed-in user's own rows.
alter table public.activity enable row level security;

create policy "read own activity"   on public.activity for select using (auth.uid() = user_id);
create policy "insert own activity" on public.activity for insert with check (auth.uid() = user_id);
create policy "update own activity" on public.activity for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own activity" on public.activity for delete using (auth.uid() = user_id);
