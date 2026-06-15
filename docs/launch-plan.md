# Launch plan — Week 1

Strategy for flipping Draft 26 from "it's live" to "people are playing it".
The focus is organic distribution aligned with the Copa 2026 group stage.
No paid ads in week 1 — not worth the noise on a base of zero.

**Window:** Mon Jun 15 → Sun Jun 21 (initial reference; replicable each week
through the final on Jul 19).

## TL;DR

- **The real share-loop blocker:** dynamic OG image at run completion.
  Without it, the rest of the plan limps. High ROI, ~6h of work.
- **Cadence:** prepare D0, soft launch D1, peaks aligned with Brazil's
  matches, retro on D6.
- **Channels:** X + IG + YouTube + TikTok, all created on D0 under the same
  handle.
- **Distribution:** genuine comments on Brazilian football live streams >
  Reddit > X amplification > YouTube long-form.
- **Effort estimate:** 25-35 hours of marketing across the week. If only
  half is available, drop the YouTube long-form first (D4) — high effort,
  uncertain return at a base of zero.

## Assumptions

- The product is stable and the critical paths are instrumented
  (`view_page`, `country_rolled`, `player_picked`, `team_detail_viewed`,
  `match_completed`, etc — see `src/lib/track.ts`).
- Target audience is Brazil, pt-BR, with a side flank open to the
  international FIFA gamer crowd (r/SoccerGaming).
- Post-optimization performance (as of June 2026): ~144 KB gzip initial
  bundle, fast even on weak mobile — a prerequisite for mobile sharing.
- Copa schedule: assume 1-2 Brazil matches this week without assuming the
  exact day — adjust D3 to the real fixture.

## D0 — Today (Mon Jun 15) · Setup

### Branding & accounts (3-4h, batch the work)

- **Single handle** everywhere: `@draft26` (or `@usadraft26` if the short
  one is taken). Check X / IG / TikTok / YT **before** committing — handle
  consistency is non-negotiable for recognition.
- **Single bio:** _"Role o dado. Faça o draft. Conquiste o mundo. —
  Simulador 1P da Copa 2026"_ + link `draft-26.pages.dev`.
- **Avatar:** monochrome logo on a dark background (matches the
  `.d26-scope` home theme).
- **Cover / banner:** screenshot of the country-rolling slot machine.
- **X:** pin a post with a 15s clip (drafting → first match).
- **YouTube:** create the channel + one 30s short so the channel doesn't
  look empty.
- **TikTok:** create the account, don't post yet (D2-D3 has the first
  post).

### Product (parallel, critical)

- **Implement the dynamic OG image** for the run completion screen.
  Options:
  - Cloudflare Worker with Satori / `@vercel/og` (recommended — edge, no
    cold start)
  - Client-side canvas + upload to temporary storage (easier, jankier)
- **"Share" button** on the result screen, pre-filling:
  - X: text + `#Draft26` + URL with `?campaign=<id>`
  - Plain link copy (Web Share API where available)
- **Confirm** that `share_clicked` is being tracked in the funnel.

## D1 — Tue Jun 16 · Soft launch

No heavy promo. Goal: seed evergreen content so the profile doesn't look
brand-new when someone clicks through.

- **X:** thread "how Draft 26 was born" — reference 7a0/38a0, prints, one
  GIF of the draft. 4-5 tweets.
- **IG:** carousel of 3 ready-made reels — (a) home screen on loop, (b)
  rolling a random nation, (c) a campaign ending.
- **YouTube:** one 60-90s short — "this random-country XI — does it
  actually work?"
- **Reddit:** **don't post yet.** Start commenting genuinely on r/futebol,
  r/brasil, r/desimpedidos threads. Builds karma without self-promo.
- **Comments on BR live streams:** join post-match lives from Pilhado,
  Desimpedidos, Bola Pré, commenting on the actual game. Don't mention
  the product. Just be present.

## D2 — Wed Jun 17 · First public push

- **X:** visual post — "the most absurd XI that just came up" (e.g., Cape
  Verde, Uzbekistan) + screenshot. This is the format that goes viral in
  pt-BR football twitter.
- **Reddit:**
  - r/futebol: post with OC flair — "I built a single-player Copa 2026
    simulator". Read the rules — some subs require 90-day-old accounts.
  - r/brasil with Tecnologia flair (bigger audience, less strict).
  - r/SoccerGaming (international, FIFA crowd) — opens the international
    flank.
- **IG Story:** poll — "would you draft this XI?" with link sticker.
- **TikTok:** post the best short from D1.

## D3 — Thu Jun 18 · Tactical hit on a Brazil match day

> Assumes Brazil plays this week. If the fixture is different, swap D3 with
> D4 / D5.

- **2h pre-match:** thread on X — "before Brazil kicks off, simulate the
  whole Copa" + link. Peak attention pre-whistle.
- **During the match:** short X posts reacting to the game — fan tone, not
  marketing tone.
- **Post-match:** "if Brazil just got knocked out, take revenge in Draft 26"
  — ride the emotional wave.
- **Live-stream comments:** Cazé TV, Desimpedidos, Bola Pré during the live
  show. **One message per channel** — it has to feel natural, not spam.

## D4 — Fri Jun 19 · Mid-week + outreach

- **YouTube:** 5-8 min vlog-format video — "full campaign with a random
  country". **Biggest single investment of the week.** Post in the
  morning (YT's algorithm prefers morning uploads to sustain weekend
  exposure).
- **TikTok:** 3 shorts across the day (morning, lunch, evening). Each with
  a different hook (funny, serious, surprise).
- **1-on-1 outreach:** DM 3-5 micro-influencers (10-50k followers) in
  Brazilian football twitter/IG. **Don't ask for promotion — ask them to
  play.** Something like _"yo, made a Copa simulator, would you draft live
  on your next stream?"_ Conversion is much higher than mass DM.
- **X:** meme of the day. E.g., _"POV: you drafted Bolivia and your first
  match is Argentina."_

## D5 — Sat Jun 20 · Weekend peak

- 3-4 posts on X across the day, with prints of real campaigns (if there
  are users by now — anonymized, no PII).
- 30s reel on IG (not a Story) — the algorithm prioritizes video on
  Saturdays.
- One extra YouTube Short to keep momentum from Friday's long-form.
- If Brazil plays Saturday, repeat the D3 playbook.

## D6 — Sun Jun 21 · Retro + carve-out

- **X thread:** "The 10 craziest XIs of the week" — repost user-generated
  content with credit. The format generates bounce: people who get tagged
  amplify.
- **IG carousel:** "Champions of the week" — top 5 nations that won the
  most simulated Copas.
- **Internal metrics:** DAU, runs started vs completed, share rate, traffic
  sources (UTM is already instrumented — see `src/lib/session.ts`). Plan
  week 2 based on those numbers.

## Recurring content — keep going all week

- **X:** 2-3 posts/day. One product (print / draft), one football
  (reaction to the day), one reply on a big account.
- **IG Story:** 1-2 per day, keeps the feed alive.
- **Live-stream comments:** ~30 min/day across 2 large channels. Don't
  mention the product in week 1 unless there's a genuine hook.

## Brazilian channels to comment on (priority order)

1. **Cazé TV** — lives with 200k+ concurrent. Cheap attention, hard to
   moderate. Tone: fan, not marketing.
2. **Desimpedidos / Bola Pré** — the exact audience for the product.
3. **Pilhado** — old-school fan, controversy = engagement.
4. **Mundo GE / GE direto da Copa** — more technical commentary, older
   audience.
5. **Crew Pro / Bola na Trave** — FIFA gaming niche, perfect product fit.
6. **Benja (Joel Datena Jr)** — micro, but highly engaged.

## Risks / what NOT to do

- **Spam on r/futebol = ban.** Engage 3-4 days before posting.
- **Mass DM without context = blocked.** Spend 5 min researching each DM.
- **Disappearing on Brazil match day = miss the window.**
- **Generic posts** ("made a simulator, come play") die. Every message
  needs a hook (absurd XI, ridiculous result, controversy).
- **Brand carefully:** "Copa 2026", not "FIFA World Cup 2026™" — already
  fine in the product, keep it that way in messaging.

## Metrics to track

The current telemetry covers everything needed to decide what's working:

| Metric                          | Source                                               |
| ------------------------------- | ---------------------------------------------------- |
| Sessions / DAU                  | `view_page` + `session_id`                           |
| Funnel draft → groups → bracket | `country_rolled`, `player_picked`, `match_completed` |
| Run completion rate             | `cup_ended` / `draft_started`                        |
| Share rate                      | `share_clicked` (to be instrumented)                 |
| Traffic origin                  | UTM in `track-session-once`                          |
| Most drafted nations            | aggregate of `country_rolled`                        |
| Nations that win most Copas     | aggregate of `cup_ended` `champion`                  |

Week-1 success criterion: >500 completed runs AND share rate >5%. Below
that, re-plan week 2 prioritizing whichever channel is converting.

## Immediate next steps

In priority order for today:

1. **Dynamic OG image** (~6h). Without it, everything else is weaker.
2. **Reserve handles** on X / IG / TikTok / YT (~30 min).
3. **Record 3-5 short clips** (random draft, campaign ending, absurd XI)
   to build a content bank (~1h).
4. **Instrument `share_clicked`** (~30 min).

## Review schedule

- **Sun Jun 21:** week 1 retro with metrics. Decide week 2.
- **Every Thursday:** mid-week check — what's working, what to pivot.
- **Post-final (Jul 19):** decide whether to turn this into a permanent
  product (multiplayer, next competitions) or shift to archive mode.
