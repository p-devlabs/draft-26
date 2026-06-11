import { Link } from 'react-router-dom'
import { features } from '../lib/features'
import { groupedSquads, squads } from '../data/squads'

const TOTAL_PLAYERS = squads.reduce((s, q) => s + q.players.length, 0)
const TOTAL_TEAMS = squads.length
const TOTAL_GROUPS = groupedSquads.length

export function Home() {
  return (
    <div>
      <Hero />
      <HowItWorks />
      <DataIntegrity />
      <Journey />
      <ClosingCTA />
      <Credits />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.18em] text-clay mb-6 flex items-center gap-2">
            <span>Copa do Mundo 2026</span>
            <span className="text-rule">·</span>
            <span>EUA · México · Canadá</span>
          </p>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.02] tracking-tight text-ink mb-6">
            Pega uma seleção. <br />
            Escala onze. <br />
            <span className="text-clay">Levanta a taça.</span>
          </h1>
          <p className="text-lg md:text-xl text-ink-soft leading-relaxed mb-10 max-w-2xl">
            48 seleções. {TOTAL_PLAYERS.toLocaleString('pt-BR')} convocados oficiais.
            Um Dream XI montado posição por posição. O resto é cosido na Poisson —
            grupos, mata-mata, prorrogação, pênaltis no MetLife.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link
              to="/draft"
              className="inline-flex items-center justify-center h-12 px-7 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
            >
              Começar draft
            </Link>
            <Link
              to="/selecoes"
              className="inline-flex items-center justify-center h-12 px-7 rounded-md border border-rule text-ink text-sm font-medium hover:bg-sand transition-colors"
            >
              Ver as 48 seleções
            </Link>
          </div>
          {features.dev && (
            <div className="mt-5 flex gap-2">
              <Link
                to="/copa?demo=1"
                className="text-xs text-clay border-b border-dashed border-clay/40 hover:border-clay"
              >
                ⚡ dev · pular pra Copa com XI demo
              </Link>
            </div>
          )}
        </div>

        <FlagsTicker />
      </div>
    </section>
  )
}

function FlagsTicker() {
  // Mostra as 48 bandeiras em fila, com um leve rolar visual
  return (
    <div className="mt-16 -mx-6 overflow-hidden border-y border-rule py-4 bg-sand/40">
      <div className="flex gap-6 animate-[scroll_60s_linear_infinite] whitespace-nowrap">
        {[...squads, ...squads].map((s, i) => (
          <span key={`${s.code}-${i}`} className="inline-flex items-center gap-2 text-sm text-ink-soft">
            <span className="text-2xl">{s.flag}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider">{s.code}</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Sorteia uma seleção por posição',
      body:
        'A cada vaga, o dado entrega um país. Você escolhe um jogador dos 26 convocados que servem ali. Países sorteados ficam em cooldown de 5 lances.',
    },
    {
      n: '02',
      title: 'Monta o XI dos sonhos',
      body:
        'Vinícius de ponta, Bellingham no meio, Alisson no gol — só não tudo do mesmo país. Pulos limitados pela dificuldade: 5 / 3 / 1.',
    },
    {
      n: '03',
      title: 'Disputa a fase de grupos',
      body:
        'Seu XI substitui o time mais fraco de um grupo sorteado. Três jogos com narração minuto a minuto e tabela ge.com-style. Tiebreakers da FIFA 2026.',
    },
    {
      n: '04',
      title: 'Bate o chaveamento',
      body:
        'Top 2 vai pra eliminatória de 32. Prorrogação 15+15, pênaltis se persistir. Final no MetLife — ou drawer de eliminação com tudo o que aconteceu.',
    },
  ]
  return (
    <section id="como-funciona" className="border-t border-rule">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.18em] text-clay mb-3">Como funciona</p>
          <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight">
            Quatro telas. Uma decisão por vez.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="font-display text-clay text-sm mb-3 tabular-nums">{s.n}</div>
              <h3 className="font-display text-xl text-ink mb-3 leading-snug">{s.title}</h3>
              <p className="text-ink-soft text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DataIntegrity() {
  return (
    <section className="border-t border-rule bg-sand/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.18em] text-clay mb-3">Por baixo do capô</p>
          <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight">
            Dados de verdade. Nada inventado.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          <SourceCard
            label="Convocações"
            source="Wikipedia"
            description={`As ${TOTAL_TEAMS} listas oficiais de 26 convocados raspadas direto da página da Copa 2026.`}
            href="https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"
            stat={`${TOTAL_PLAYERS.toLocaleString('pt-BR')} convocados`}
          />
          <SourceCard
            label="Ratings e posições"
            source="EA FC 26"
            description="Overall, posição principal e alternativas vêm do dataset oficial do game — 18k+ jogadores."
            href="https://www.ea.com/games/ea-sports-fc"
            stat="~70% match rate"
          />
          <SourceCard
            label="Valor de mercado"
            source="Transfermarkt"
            description="Cross-referência com o valor atual e pico histórico. Quando EA e TM divergem, os dois ficam visíveis."
            href="https://www.transfermarkt.com/"
            stat="47k jogadores"
          />
        </div>
        <p className="mt-10 text-xs text-ink-soft max-w-3xl">
          Desambiguação por bucket posicional + clube + idade resolve casos clássicos —
          Alisson Becker (GK Liverpool, 89) deixou de ser confundido com Alisson Santana
          (RW Shakhtar, 70). Jogadores fora dos datasets (Irã, Jordânia, ligas menores)
          caem numa heurística marcada com <span className="text-clay">✦</span> na ficha.
        </p>
      </div>
    </section>
  )
}

function SourceCard({
  label,
  source,
  description,
  href,
  stat,
}: {
  label: string
  source: string
  description: string
  href: string
  stat: string
}) {
  return (
    <a
      href={href}
      className="block p-6 rounded-lg border border-rule bg-paper hover:border-ink/40 hover:shadow-sm transition-all"
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-soft mb-2">{label}</div>
      <div className="font-display text-2xl text-ink mb-3">{source}</div>
      <p className="text-sm text-ink-soft leading-relaxed mb-4">{description}</p>
      <div className="text-xs text-clay tabular-nums font-medium">{stat}</div>
    </a>
  )
}

function Journey() {
  const stages = [
    { tag: 'Setup', title: 'Tática + estilo + dificuldade', detail: '4-3-3 ofensivo com 3 pulos. Ou 3-4-3 defensivo com 1 só.' },
    { tag: 'Draft', title: '11 escolhas, uma por vez', detail: 'Sorteia. Escolhe. Cooldown. Repete onze vezes.' },
    { tag: 'Grupos', title: '3 jogos no Grupo G (ou onde te sortear)', detail: 'Tabela ao vivo. Substitui a seleção mais fraca do grupo.' },
    { tag: 'Mata-mata', title: '5 jogos pra levantar', detail: 'Bracket clássico no seu lado. Outro lado já tem finalista.' },
  ]
  return (
    <section className="border-t border-rule">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.18em] text-clay mb-3">Sua jornada</p>
          <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight">
            Do dado ao MetLife.
          </h2>
        </div>
        <ol className="relative border-l-2 border-rule pl-8 space-y-10 md:space-y-12">
          {stages.map((s, i) => (
            <li key={s.tag} className="relative">
              <span className="absolute -left-[37px] top-1 w-4 h-4 rounded-full bg-paper border-2 border-clay" />
              <div className="text-[10px] uppercase tracking-[0.18em] text-clay mb-1 tabular-nums">
                {String(i + 1).padStart(2, '0')} · {s.tag}
              </div>
              <h3 className="font-display text-xl md:text-2xl text-ink mb-2">{s.title}</h3>
              <p className="text-ink-soft text-sm">{s.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ClosingCTA() {
  return (
    <section className="border-t border-rule bg-ink text-paper">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-clay mb-4">A bola rola</p>
        <h2 className="font-display text-4xl md:text-5xl leading-tight mb-6">
          11 vagas. {TOTAL_TEAMS} seleções. <br />
          <span className="text-clay">Uma final em junho.</span>
        </h2>
        <p className="text-paper/70 mb-10 max-w-xl mx-auto">
          Não precisa de cadastro, nem de download. Roda no navegador, salva no
          localStorage, dura uma sessão de café.
        </p>
        <Link
          to="/draft"
          className="inline-flex items-center justify-center h-12 px-8 rounded-md bg-clay text-paper text-sm font-medium hover:bg-paper hover:text-ink transition-colors"
        >
          Começar agora →
        </Link>
      </div>
    </section>
  )
}

function Credits() {
  return (
    <section className="border-t border-rule">
      <div className="mx-auto max-w-6xl px-6 py-10 grid sm:grid-cols-3 gap-6 text-xs text-ink-soft">
        <div>
          <div className="font-display text-ink text-sm mb-2">Stack</div>
          <p>Vite · React 19 · TypeScript · Tailwind v4 · Supabase · Cloudflare Pages</p>
        </div>
        <div>
          <div className="font-display text-ink text-sm mb-2">Fontes</div>
          <p>
            Wikipedia · <a className="underline hover:text-ink" href="https://github.com/ismailoksuz/EAFC26-DataHub">EAFC26-DataHub</a> ·{' '}
            <a className="underline hover:text-ink" href="https://github.com/dcaribou/transfermarkt-datasets">dcaribou/transfermarkt-datasets</a>
          </p>
        </div>
        <div>
          <div className="font-display text-ink text-sm mb-2">Inspirado em</div>
          <p>
            <a className="underline hover:text-ink" href="https://7a0.com.br/">7a0</a> e{' '}
            <a className="underline hover:text-ink" href="https://38a0.com/">38a0</a>{' '}
            — feito com obsessão por UI/UX e dados reais.
          </p>
        </div>
        <div className="sm:col-span-3 pt-4 border-t border-rule/60 flex items-center justify-between flex-wrap gap-2">
          <span>v0.1 · {TOTAL_GROUPS} grupos · {TOTAL_TEAMS} seleções · {TOTAL_PLAYERS.toLocaleString('pt-BR')} jogadores</span>
          <span>Pra rolar o dado em junho de 2026.</span>
        </div>
      </div>
    </section>
  )
}
