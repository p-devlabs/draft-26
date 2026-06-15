-- Draft 26 — eventos de funil/comportamento
-- Complementa `runs` (snapshots de estado de campanha) com pings pontuais:
-- view_home, draft_started, draft_completed, group_completed, cup_ended, etc.

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null,
  props       jsonb not null default '{}'::jsonb,
  session_id  text not null,            -- sessionStorage UUID, agrega navegação de uma aba
  created_at  timestamptz not null default now()
);

create index events_user_created on public.events (user_id, created_at desc);
create index events_type_created on public.events (event_type, created_at desc);
create index events_session on public.events (session_id);

alter table public.events enable row level security;

-- Dono insere e lê os próprios eventos. Sem leitura pública (não é leaderboard).
create policy events_owner_insert on public.events
  for insert with check (auth.uid() = user_id);

create policy events_owner_read on public.events
  for select using (auth.uid() = user_id);
