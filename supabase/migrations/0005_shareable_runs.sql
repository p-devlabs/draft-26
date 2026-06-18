-- Draft 26 — runs compartilháveis + run_id nos eventos
-- Cada run já tem id (0001). Aqui ela vira endereçável: o share aponta pra
-- /r/<id> e qualquer um pode abrir a run que o jogador marcou como pública.

-- Visibilidade explícita de compartilhamento. O jogador marca ao compartilhar
-- (markRunShared em runs.ts), então a run fica legível mesmo em meio de campanha
-- (a policy de 0001 só liberava runs concluídas).
alter table public.runs add column if not exists is_public boolean not null default false;

create policy runs_public_read_shared on public.runs
  for select using (is_public);

create index if not exists runs_public on public.runs (id) where is_public;

-- run_id nos eventos → funil por campanha (drop-off dentro de uma run), não só
-- por sessão/usuário. SEM foreign key de propósito: events é fire-and-forget e
-- não pode falhar se a run ainda não existir / a row tiver falhado de inserir.
alter table public.events add column if not exists run_id uuid;

create index if not exists events_run on public.events (run_id) where run_id is not null;
