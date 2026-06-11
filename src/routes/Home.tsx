import { Link } from 'react-router-dom'

export function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="pt-24 pb-20 max-w-3xl">
        <p className="text-sm uppercase tracking-[0.18em] text-clay mb-6">
          Copa do Mundo 2026
        </p>
        <h1 className="font-display text-5xl md:text-6xl leading-[1.05] tracking-tight text-ink mb-6">
          Pega uma seleção. <br />
          Escala onze. <br />
          <span className="text-clay">Levanta a taça.</span>
        </h1>
        <p className="text-lg text-ink-soft leading-relaxed mb-10 max-w-xl">
          48 seleções, 26 convocados, uma chance. O sorteio te dá um país —
          o resto é com você: monta o XI dos sonhos e simula a Copa inteira,
          dos grupos à final.
        </p>
        <div className="flex gap-3">
          <Link
            to="/torneio/novo"
            className="inline-flex items-center justify-center h-11 px-6 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
          >
            Começar torneio
          </Link>
          <a
            href="#como-funciona"
            className="inline-flex items-center justify-center h-11 px-6 rounded-md border border-rule text-ink text-sm font-medium hover:bg-sand transition-colors"
          >
            Como funciona
          </a>
        </div>
      </section>

      <section id="como-funciona" className="grid md:grid-cols-3 gap-8 py-16 border-t border-rule">
        <Step n="01" title="Sorteia uma seleção">
          Roda o dado. Pode cair Brasil, Argentina, Marrocos, Nova Zelândia.
          Você herda os 26 convocados oficiais daquele país.
        </Step>
        <Step n="02" title="Escala seu XI">
          Escolhe formação (4-3-3, 4-4-2, 3-5-2), monta a equipe titular,
          define capitão. Cada jogador tem overall calculado por valor de mercado.
        </Step>
        <Step n="03" title="Simula a Copa">
          Fase de grupos com mais 47 seleções, mata-mata, final no MetLife.
          Você acompanha jogo a jogo. Ou só vai pro placar final.
        </Step>
      </section>
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-display text-clay text-sm mb-3">{n}</div>
      <h3 className="font-display text-xl text-ink mb-2">{title}</h3>
      <p className="text-ink-soft text-sm leading-relaxed">{children}</p>
    </div>
  )
}
