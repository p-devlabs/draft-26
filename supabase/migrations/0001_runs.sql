-- Torneio de Verano '26 — schema inicial
-- Single-player roda 100% local (squads no bundle, estado em localStorage).
-- Supabase guarda apenas snapshots de partidas (`runs`) pra leaderboard e cross-device.

create extension if not exists "pgcrypto";

create table public.runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  replaced_code   text not null,         -- ISO-3 da seleção que o user substituiu (BRA, ARG…)
  formation       text not null,         -- '4-3-3' | '4-2-3-1' | '4-4-2' | '3-4-3'
  difficulty      text not null check (difficulty in ('easy', 'medium', 'hard')),
  average_overall numeric(4,1),          -- denormalizado pra ordenar leaderboard sem ler json
  draft_json      jsonb not null,
  stage_json      jsonb,                 -- null enquanto a fase de grupos não rola
  bracket_json    jsonb,                 -- null enquanto o mata-mata não começa
  champion_code   text,                  -- null até alguém levantar a taça
  finished_round  text check (finished_round in ('group','R32','R16','QF','SF','F','CHAMPION')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz            -- preenche quando finished_round != null
);

create index runs_user_created on public.runs (user_id, created_at desc);
create index runs_champion on public.runs (champion_code) where champion_code is not null;
create index runs_completed_overall on public.runs (average_overall desc) where completed_at is not null;

alter table public.runs enable row level security;

-- Dono pode ler/escrever as próprias runs (inclusive em progresso)
create policy runs_owner_all on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Qualquer um (anon + authenticated) lê runs concluídas — pro leaderboard público
create policy runs_public_read_completed on public.runs
  for select using (completed_at is not null);

-- Auto-touch de updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger runs_touch_updated_at
  before update on public.runs
  for each row execute function public.touch_updated_at();
