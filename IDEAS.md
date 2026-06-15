# Ideas & feedback

A living doc collecting playtester feedback. Original quotes are preserved
verbatim (in Portuguese where applicable) because the wording itself reveals
how each person frames the game. Check `[x]` when an entry becomes an issue,
a PR, or is dropped with a note.

---

## 2026-06-13 — WhatsApp session

### Draft system

- [ ] **3 options per roll instead of 1** — anonymous (+351 910 603 982)
  > "Coloca 3 selecoes pra escolha. Ao invés de uma. Daí tu tem mais opcoes.
  > Aqui tu fica entre escolher o vini jr, dembele ou messi por exemplo.
  > Te deixa na duvida. Da selecao, tu sempre vai escolher os melhores."

  The wording mixes "3 nations" and "3 players" but the example (Vini /
  Dembélé / Messi belong to three different nations) points to variant B
  below. Both are worth weighing:
  - **A**: roll 1 nation, show 3 of its best slot-compatible players. Cuts
    the punishment of landing on a weak nation and the tedium of nearly
    always picking the obvious best player.
  - **B**: roll 3 nations, pick 1 player from any of them. More dramatic
    choice, but it interacts badly with the current cooldown (3 nations
    leave the pool per roll).

- [ ] **Variant: total randomness** — same author
  > "Ou um de cada selecao ba aleatoriedade total"

  Probably: show 1 player from each nation in the full pool and pick freely.
  Turns it into a portfolio meta-game instead of a draft-by-dice loop.
  Likely a separate mode, not a replacement for the main one.

- [ ] **Pick by sector (defense / midfield / attack) instead of by slot** — Mauricio Pieper
  > "Eu já tava pensando em uma mudança pra deixar tu escolher alguém do
  > setor ao invés de da posição em específico. Ai tu escolhe entre defesa
  > (goleiros entram), meio e ataque e tu só escolhe 1.
  > Pode dar mais graça na brincadeira.
  > Pq aí se tu pega argentina pro ataque tu tens messi e Julian Alvarez.
  > Ou Brasil no ataque tu tens vários também.
  > E se alguma posicao já estiver ocupada, aí tu não consegue pegar os
  > jogadores dela."

  Coarser granularity. Goalkeepers fold into "defense". Compatibility tags
  along: if you already have GK + 4 CBs, the next "defense" roll filters
  to fullbacks. Plays nicely with the alt-positions work shipped in PR #7
  — the more alts each player carries, the more options inside every
  sector.

### Reported bugs

- [ ] **3rd-place flagged as eliminated, but actually advanced** — anonymous
  > "Fiquei em terceiro lugar e disse que fui eliminado. Mas eu passei pra
  > próxima fase (talvez rever a logica de ranking e classificacao - passam
  > todos 1os e 2os e os 8 melhores 3os)"

  Critical: the messaging contradicts the actual behavior. Copa 2026 format
  (48 teams, 12 groups): top 2 of each (24) + the 8 best 3rd-place finishers
  = 32 in the knockout. Verify: (i) is the qualification logic in
  `groups.ts` correct? (ii) is the elimination text being decided **before**
  the 8-best-3rds rule runs?

- [ ] **Navigation stuck after the group stage** — anonymous
  > "Outra coisa que notei, quando eu passo da fase de grupos eu posso
  > clicar pra ver o chaveamento. Mas depois não consigo clicar pra ver os
  > grupos. E tipo se eu clicar na tab partida eu volto pra tab de grupos"

  The "Match" tab navigates back to the group stage when it should be
  showing the next knockout match. The routing logic in `Match.tsx` /
  `MataMata.tsx` probably isn't recognizing the stage transition.
