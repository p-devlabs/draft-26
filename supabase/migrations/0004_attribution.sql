-- Draft 26 — atribuição do loop viral
-- Lê só de `events`: o session_init agora carrega isNew / playerToken / ref /
-- firstTouch (ver src/lib/session.ts). Nenhuma write nova — só índice + views,
-- consumidas via dashboard/SQL editor (service_role), igual às de 0003.

-- Lookup rápido do primeiro session_init por usuário.
create index if not exists events_session_init_created
  on public.events (user_id, created_at)
  where event_type = 'session_init';

-- ============================================================
-- v_acquisition — uma row por jogador: origem (first-touch) + canal derivado.
-- Usa o session_init mais antigo de cada user (a aquisição).
-- ============================================================
create or replace view public.v_acquisition as
with first_init as (
  select distinct on (user_id) user_id, created_at as acquired_at, props
  from public.events
  where event_type = 'session_init'
  order by user_id, created_at asc
),
-- O playerToken pode não existir no 1º session_init (usuários anteriores a este
-- deploy). Pega o token do session_init mais recente que tiver um, senão o
-- referral p2p desses usuários nunca casaria em v_referral_edges.
latest_token as (
  select distinct on (user_id) user_id, props->>'playerToken' as player_token
  from public.events
  where event_type = 'session_init' and props->>'playerToken' is not null
  order by user_id, created_at desc
)
select
  fi.user_id,
  fi.acquired_at,
  coalesce((fi.props->>'isNew')::boolean, false)         as is_new,
  lt.player_token                                        as player_token,
  fi.props->'firstTouch'->'utm'->>'utm_source'           as utm_source,
  fi.props->'firstTouch'->'utm'->>'utm_medium'           as utm_medium,
  fi.props->'firstTouch'->'utm'->>'utm_campaign'         as utm_campaign,
  fi.props->'firstTouch'->'utm'->>'utm_content'          as utm_content,
  nullif(fi.props->'firstTouch'->>'ref', '')             as ref_token,
  nullif(fi.props->'firstTouch'->>'referrer', '')        as referrer,
  fi.props->'firstTouch'->>'landing'                     as landing,
  case
    when fi.props->'firstTouch'->'utm'->>'utm_source' = 'share'
      then 'share:' || coalesce(fi.props->'firstTouch'->'utm'->>'utm_medium', '?')
    when nullif(fi.props->'firstTouch'->>'ref', '') is not null then 'share:p2p'
    when nullif(fi.props->'firstTouch'->>'referrer', '') is not null then 'referral'
    else 'direct'
  end                                                    as channel
from first_init fi
left join latest_token lt on lt.user_id = fi.user_id;

-- ============================================================
-- v_referral_edges — grafo de indicação p2p: liga o recém-chegado (ref_token)
-- ao compartilhador (player_token). Uma row por conversão pessoa-a-pessoa.
-- ============================================================
create or replace view public.v_referral_edges as
select
  invitee.user_id      as invitee,
  invitee.acquired_at  as invited_at,
  inviter.user_id      as inviter,
  invitee.ref_token,
  invitee.channel
from public.v_acquisition invitee
join public.v_acquisition inviter
  on inviter.player_token = invitee.ref_token
 and inviter.player_token is not null
where invitee.ref_token is not null;

-- ============================================================
-- v_viral_summary — números-chave do loop (sem janela; filtre por data na query).
-- K-factor p2p ≈ p2p_conversions / players_who_shared.
-- ============================================================
create or replace view public.v_viral_summary as
select
  (select count(*) from public.v_acquisition)                                    as players_total,
  (select count(*) from public.v_acquisition where channel like 'share%')        as players_from_share,
  (select count(*) from public.v_referral_edges)                                 as p2p_conversions,
  (select count(distinct user_id) from public.events
     where event_type in ('share_clicked', 'share_card_generate'))              as players_who_shared,
  (select count(*) from public.events
     where event_type in ('share_clicked', 'share_card_generate'))              as shares_total;

-- ============================================================
-- v_channel_funnel — por canal de aquisição: jogadores, ativação (chegou a
-- montar XI) e conclusão (campanha encerrada). Cruza v_acquisition com runs.
-- ============================================================
create or replace view public.v_channel_funnel as
select
  a.channel,
  count(distinct a.user_id)                                                      as players,
  count(distinct r.user_id) filter (where r.id is not null)                      as activated,
  count(distinct r.user_id) filter (where r.completed_at is not null)            as completed,
  count(distinct r.user_id) filter (where r.champion_code is not null)           as champions
from public.v_acquisition a
left join public.runs r on r.user_id = a.user_id
group by a.channel
order by players desc;

-- Estas views expõem dados de TODOS os jogadores (canal, tokens, user_id) e, como
-- view, rodam como definer (bypassam RLS). São pra análise via dashboard/SQL
-- editor (service_role) — então tiramos o acesso da API pública (anon/authenticated).
revoke all on public.v_acquisition from anon, authenticated;
revoke all on public.v_referral_edges from anon, authenticated;
revoke all on public.v_viral_summary from anon, authenticated;
revoke all on public.v_channel_funnel from anon, authenticated;
