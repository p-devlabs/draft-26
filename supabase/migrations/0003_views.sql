-- Draft 26 — views denormalizadas pra dashboards/queries ad-hoc.
-- Tudo é derivado de `runs` e `events` — sem novas writes, custo zero pra app.

-- ============================================================
-- v_run_funnel — funil agregado de etapas atingidas em todas as runs.
-- Uma row por linha do funil; útil pra calcular % de retenção fase a fase.
-- ============================================================
create or replace view public.v_run_funnel as
select
  count(*)                                                                            as runs_total,
  count(*) filter (where stage_json is not null)                                      as reached_groups,
  count(*) filter (where finished_round is null
                   and stage_json is not null and bracket_json is null)               as in_groups,
  count(*) filter (where bracket_json is not null)                                    as reached_ko,
  count(*) filter (where finished_round in ('R16','QF','SF','F','CHAMPION'))          as reached_r16,
  count(*) filter (where finished_round in ('QF','SF','F','CHAMPION'))                as reached_qf,
  count(*) filter (where finished_round in ('SF','F','CHAMPION'))                     as reached_sf,
  count(*) filter (where finished_round in ('F','CHAMPION'))                          as reached_final,
  count(*) filter (where finished_round = 'CHAMPION')                                 as champions
from public.runs;

-- ============================================================
-- v_run_summary — uma row por run, com formation/difficulty/finished_round/ovr.
-- Base pra cruzar "qual formação chega mais à final".
-- ============================================================
create or replace view public.v_run_summary as
select
  r.id                                  as run_id,
  r.user_id,
  r.replaced_code,
  r.formation,
  r.difficulty,
  r.average_overall,
  r.finished_round,
  r.champion_code,
  r.created_at,
  r.completed_at,
  extract(epoch from (r.completed_at - r.created_at)) as duration_seconds
from public.runs r;

-- ============================================================
-- v_group_matches — explode stage_json.matches; uma row por partida do grupo do user.
-- Inclui marcador user_side ('home'|'away'|'cpu') pra filtrar facilmente.
-- ============================================================
create or replace view public.v_group_matches as
select
  r.id                              as run_id,
  r.user_id,
  r.formation,
  r.difficulty,
  r.average_overall,
  (m->>'round')::int                as round,
  m->>'homeCode'                    as home_code,
  m->>'awayCode'                    as away_code,
  (m->'result'->>'homeGoals')::int  as home_goals,
  (m->'result'->>'awayGoals')::int  as away_goals,
  case
    when m->>'homeCode' = 'YOU' then 'home'
    when m->>'awayCode' = 'YOU' then 'away'
    else 'cpu'
  end                               as user_side,
  r.created_at
from public.runs r,
     jsonb_array_elements(r.stage_json->'matches') m
where r.stage_json is not null
  and m->'result' is not null;

-- ============================================================
-- v_ko_matches — explode bracket_json.matches; uma row por partida do mata-mata.
-- Soma reg + et nos campos *_total pra evitar fazer SQL nojento depois.
-- ============================================================
create or replace view public.v_ko_matches as
select
  r.id                                                                        as run_id,
  r.user_id,
  r.formation,
  r.difficulty,
  r.average_overall,
  m->>'id'                                                                    as match_id,
  m->>'round'                                                                 as round,
  m->>'homeCode'                                                              as home_code,
  m->>'awayCode'                                                              as away_code,
  m->>'winnerCode'                                                            as winner_code,
  (m->'result'->>'homeGoals')::int                                            as reg_home,
  (m->'result'->>'awayGoals')::int                                            as reg_away,
  coalesce((m->'extraTime'->>'homeGoals')::int, 0)                            as et_home,
  coalesce((m->'extraTime'->>'awayGoals')::int, 0)                            as et_away,
  (m->'result'->>'homeGoals')::int + coalesce((m->'extraTime'->>'homeGoals')::int, 0) as home_total,
  (m->'result'->>'awayGoals')::int + coalesce((m->'extraTime'->>'awayGoals')::int, 0) as away_total,
  m->'penalties' is not null                                                  as had_penalties,
  m->'extraTime' is not null                                                  as had_extra_time,
  case
    when m->>'homeCode' = r.bracket_json->>'userCode' then 'home'
    when m->>'awayCode' = r.bracket_json->>'userCode' then 'away'
    else 'cpu'
  end                                                                         as user_side,
  r.created_at
from public.runs r,
     jsonb_array_elements(r.bracket_json->'matches') m
where r.bracket_json is not null
  and m->'result' is not null;

-- ============================================================
-- v_event_funnel — eventos chave agregados (count + uniq users) por tipo.
-- Atalho pra dashboards de funil sem precisar de SQL custom.
-- ============================================================
create or replace view public.v_event_funnel as
select
  event_type,
  count(*)                            as total,
  count(distinct user_id)             as uniq_users,
  count(distinct session_id)          as uniq_sessions,
  min(created_at)                     as first_seen,
  max(created_at)                     as last_seen
from public.events
group by event_type;
