# Ideias e feedback

Doc vivo de coleta de feedback de playtesters. Mantém as falas originais
porque ajudam a entender o jeito que cada pessoa pensa o jogo. Marca com
`[x]` quando virou issue, PR, ou foi descartado com nota.

---

## 2026-06-13 — Sessão WhatsApp

### Sistema de draft

- [ ] **3 opções por sorteio em vez de 1** — anônimo (+351 910 603 982)
  > "Coloca 3 selecoes pra escolha. Ao invés de uma. Daí tu tem mais opcoes.
  > Aqui tu fica entre escolher o vini jr, dembele ou messi por exemplo.
  > Te deixa na duvida. Da selecao, tu sempre vai escolher os melhores."

  A fala mistura "3 seleções" e "3 jogadores" mas o exemplo (Vini/Dembélé/Messi
  são de 3 seleções diferentes) sugere variante B abaixo. Vale considerar
  as duas:
  - **A**: sortear 1 seleção, mostrar 3 dos melhores compatíveis pro slot.
    Reduz a "punição" de cair numa seleção fraca e o tédio de quase sempre
    pegar o melhor jogador disponível.
  - **B**: sortear 3 seleções, escolhe 1 jogador de qualquer uma delas.
    Mais drama na decisão. Combina mal com o cooldown atual (3 seleções
    sumindo do pool por roll).

- [ ] **Variante: aleatoriedade total** — mesmo autor
  > "Ou um de cada selecao ba aleatoriedade total"

  Provavelmente significa: mostrar 1 jogador de cada seleção do pool inteiro
  e escolher livremente. Vira meta-game de portfolio em vez de draft no
  dado. Provavelmente é outro modo, não substituto do principal.

- [ ] **Escolha por setor (defesa/meio/ataque) em vez de posição** — Mauricio Pieper
  > "Eu já tava pensando em uma mudança pra deixar tu escolher alguém do
  > setor ao invés de da posição em específico. Ai tu escolhe entre defesa
  > (goleiros entram), meio e ataque e tu só escolhe 1.
  > Pode dar mais graça na brincadeira.
  > Pq aí se tu pega argentina pro ataque tu tens messi e Julian Alvarez.
  > Ou Brasil no ataque tu tens vários também.
  > E se alguma posicao já estiver ocupada, aí tu não consegue pegar os
  > jogadores dela."

  Granularidade mais grossa. Goleiro entra em "defesa". Compatibilidade
  caminha junto: se você já tem GK + 4 zagueiros, o próximo rolo de
  "defesa" filtra pra laterais. Casa naturalmente com o trabalho de
  altPositions que foi feito (PR #7) — quanto mais alts os jogadores têm,
  mais opções dentro de cada setor.

### Bugs reportados

- [ ] **3º colocado avisado como eliminado, mas avançou** — anônimo
  > "Fiquei em terceiro lugar e disse que fui eliminado. Mas eu passei pra
  > próxima fase (talvez rever a logica de ranking e classificacao - passam
  > todos 1os e 2os e os 8 melhores 3os)"

  Crítico: messaging contradiz o comportamento. Formato Copa 2026 (48
  seleções, 12 grupos): top 2 de cada (24) + 8 melhores 3ºs = 32 no mata-mata.
  Verificar: (i) lógica de classificação em `groups.ts` está correta? (ii)
  texto de eliminação está sendo decidido antes da regra dos 8 melhores 3ºs?

- [ ] **Navegação travada depois da fase de grupos** — anônimo
  > "Outra coisa que notei, quando eu passo da fase de grupos eu posso
  > clicar pra ver o chaveamento. Mas depois não consigo clicar pra ver os
  > grupos. E tipo se eu clicar na tab partida eu volto pra tab de grupos"

  Tab "Partida" retorna pra fase de grupos quando deveria mostrar o próximo
  jogo de mata-mata. Provavelmente lógica de roteamento em `Match.tsx` /
  `MataMata.tsx` não está reconhecendo que a fase mudou.
