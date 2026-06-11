-- Torneio de Verano 2026 — schema inicial
-- Read-only para o MVP single-player. RLS habilitado, policies abrem leitura pública.

create extension if not exists "uuid-ossp";

create table public.countries (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  code         text not null unique,                 -- ISO-3, ex: BRA
  flag_emoji   text not null,
  group_letter text check (group_letter ~ '^[A-L]$'), -- 12 grupos na Copa 2026
  created_at   timestamptz not null default now()
);

create index on public.countries (group_letter);

create type public.position as enum ('GK', 'DEF', 'MID', 'FWD');

create table public.players (
  id               uuid primary key default uuid_generate_v4(),
  country_id       uuid not null references public.countries(id) on delete cascade,
  name             text not null,
  position         public.position not null,
  shirt_number     int  check (shirt_number between 1 and 99),
  club             text,
  age              int  check (age between 15 and 50),
  market_value_eur bigint check (market_value_eur >= 0),
  overall          int  not null check (overall between 40 and 99),
  photo_url        text,
  created_at       timestamptz not null default now()
);

create index on public.players (country_id);
create index on public.players (position);

-- RLS: leitura pública para qualquer um (anon + authenticated).
alter table public.countries enable row level security;
alter table public.players  enable row level security;

create policy countries_read on public.countries for select using (true);
create policy players_read   on public.players   for select using (true);
