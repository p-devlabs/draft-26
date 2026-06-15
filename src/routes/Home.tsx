import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { features } from '../lib/features'

export function Home() {
  const [privacyOpen, setPrivacyOpen] = useState(false)
  return (
    <div className="d26-scope">
      <TopBar />
      <Hero />
      <Container>
        <ComoFuncionaSection />
        <RegrasSection />
        <CaminhoSection />
        <SelecoesSection />
      </Container>
      <CtaFinalSection />
      <Footer onPrivacy={() => setPrivacyOpen(true)} />
      {privacyOpen && <PrivacyDrawer onClose={() => setPrivacyOpen(false)} />}
    </div>
  )
}

// ============================================================
// Top bar
// ============================================================

function TopBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        padding: '16px clamp(20px, 5vw, 56px)',
        borderBottom: '1px solid var(--color-d-line)',
        background: 'rgba(10, 11, 9, 0.85)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <Wordmark />
      <Link
        to="/draft"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
          borderRadius: 10,
          padding: '11px 18px',
          fontFamily: 'Anton',
          fontSize: 15,
          letterSpacing: '0.02em',
          textDecoration: 'none',
        }}
      >
        JOGAR <span style={{ fontFamily: 'Space Mono', fontSize: 11, fontWeight: 700 }}>→</span>
      </Link>
    </div>
  )
}

function Wordmark({ small }: { small?: boolean } = {}) {
  const wordSize = small ? 18 : 24
  const tagSize = small ? 10 : 11
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      {!small && <DiceMark size={36} dotSize={4} padding={7} />}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontFamily: 'Anton', fontSize: wordSize, letterSpacing: '0.02em' }}>DRAFT</span>
        <span style={{ fontFamily: 'Space Mono', fontSize: tagSize, color: 'var(--color-d-lime)', fontWeight: 700 }}>
          26
        </span>
      </div>
    </div>
  )
}

function DiceMark({
  size = 36,
  dotSize = 4,
  padding = 7,
  background = 'var(--color-d-lime)',
  dotBg = 'var(--color-d-bg)',
}: {
  size?: number
  dotSize?: number
  padding?: number
  background?: string
  dotBg?: string
}) {
  const dot = (justify?: 'end' | 'center'): CSSProperties => {
    const s: CSSProperties = { width: dotSize, height: dotSize, borderRadius: '50%', background: dotBg }
    if (justify === 'end') s.justifySelf = 'end'
    if (justify === 'center') s.justifySelf = 'center'
    return s
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 4),
        background,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 3,
        padding,
        flex: '0 0 auto',
      }}
    >
      <span style={dot()} />
      <span />
      <span style={dot('end')} />
      <span />
      <span style={dot('center')} />
      <span />
      <span style={dot()} />
      <span />
      <span style={dot('end')} />
    </div>
  )
}

// ============================================================
// Hero
// ============================================================

function Hero() {
  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-d-line)',
        background: 'linear-gradient(180deg, #101310, #0a0b09)',
        padding: 'clamp(40px, 7vw, 84px) clamp(20px, 5vw, 56px)',
      }}
    >
      <div
        className="d26-hero-grid"
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          gap: 'clamp(32px, 5vw, 64px)',
          alignItems: 'center',
        }}
      >
        <div>
          <Kicker color="var(--color-d-lime)">COPA 2026 · UM JOGO NO DADO</Kicker>
          <h1
            style={{
              fontFamily: 'Anton',
              fontWeight: 400,
              fontSize: 'clamp(40px, 8.5vw, 72px)',
              lineHeight: 0.94,
              margin: '0 0 20px',
            }}
          >
            ROLE O DADO.
            <br />
            FAÇA O DRAFT.
            <br />
            <span style={{ color: 'var(--color-d-lime)' }}>CONQUISTE O MUNDO.</span>
          </h1>
          <p
            style={{
              maxWidth: 480,
              fontSize: 17,
              lineHeight: 1.6,
              color: 'var(--color-d-mut)',
              margin: '0 0 30px',
            }}
          >
            Sorteie seu time no dado entre os 26 convocados de cada uma das 48 seleções,
            atravesse a fase de grupos e o mata-mata — e seja{' '}
            <span style={{ color: 'var(--color-d-ink)', fontWeight: 700 }}>campeão do mundo</span>.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <Link
              to="/draft"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                background: 'var(--color-d-lime)',
                color: 'var(--color-d-bg)',
                borderRadius: 12,
                padding: '16px 26px',
                fontFamily: 'Anton',
                fontSize: 19,
                letterSpacing: '0.02em',
                textDecoration: 'none',
                animation: 'd26-pulse 2.6s ease-out infinite',
              }}
            >
              <SmallDice />
              COMEÇAR A ESCALAR
            </Link>
            <a
              href="#como"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                color: 'var(--color-d-ink)',
                border: '1px solid var(--color-d-line)',
                borderRadius: 12,
                padding: '15px 22px',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Como funciona
            </a>
          </div>
          {features.dev && (
            <div style={{ marginTop: 20 }}>
              <Link
                to="/groups?demo=1"
                style={{
                  fontFamily: 'Space Mono',
                  fontSize: 11,
                  color: 'var(--color-d-lime)',
                  letterSpacing: '0.06em',
                  textDecoration: 'underline dashed',
                }}
              >
                ⚡ dev · pular pra Grupos com XI demo
              </Link>
            </div>
          )}
          <HeroStats />
        </div>

        <div
          className="d26-hero-art"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
        >
          <div
            className="d26-hero-dice"
            style={{
              width: 128,
              height: 128,
              borderRadius: 26,
              background: 'var(--color-d-lime)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              padding: 30,
              animation: 'd26-spin 3.4s linear infinite',
              boxShadow: '0 0 60px -6px rgba(212, 255, 61, 0.5)',
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--color-d-bg)' }}
              />
            ))}
          </div>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 12,
              letterSpacing: '0.14em',
              color: 'var(--color-d-mut)',
              textAlign: 'center',
            }}
          >
            O DADO ESCALA
            <br />
            <span style={{ color: 'var(--color-d-lime)' }}>VOCÊ COMANDA</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SmallDice() {
  const dot: CSSProperties = { width: 3, height: 3, borderRadius: '50%', background: 'var(--color-d-bg)' }
  return (
    <span
      style={{
        display: 'inline-grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 2,
        width: 17,
        height: 17,
      }}
    >
      <i style={dot} />
      <i />
      <i style={{ ...dot, justifySelf: 'end' }} />
      <i />
      <i style={{ ...dot, justifySelf: 'center' }} />
      <i />
      <i style={dot} />
      <i />
      <i style={{ ...dot, justifySelf: 'end' }} />
    </span>
  )
}

function HeroStats() {
  return (
    <div
      className="d26-hero-stats"
      style={{ display: 'flex', gap: 26, marginTop: 34, flexWrap: 'wrap' }}
    >
      <StatPair value="48" label="SELEÇÕES" highlight />
      <StatPair value="26" label="CONVOCADOS/SEL." />
      <StatPair value="11" label="NO DADO" />
      <StatPair value="1" label="TAÇA · O OBJETIVO" highlight />
    </div>
  )
}

function StatPair({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 30,
          color: highlight ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--color-d-mut)',
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ============================================================
// Container + section helpers
// ============================================================

function Container({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px, 5vw, 56px)' }}>
      {children}
    </div>
  )
}

function SectionHeader({
  id,
  kicker,
  title,
  sub,
}: {
  id?: string
  kicker: string
  title: string
  sub?: string
}) {
  return (
    <header id={id} style={{ marginBottom: sub ? 38 : 28 }}>
      <Kicker color="var(--color-d-lime)">{kicker}</Kicker>
      <h2
        style={{
          fontFamily: 'Anton',
          fontWeight: 400,
          fontSize: 'clamp(28px, 5vw, 40px)',
          lineHeight: 1,
          margin: '0 0 8px',
        }}
      >
        {title}
      </h2>
      {sub && (
        <p style={{ color: 'var(--color-d-mut)', fontSize: 15, margin: 0, maxWidth: 520 }}>{sub}</p>
      )}
    </header>
  )
}

function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: 'Space Mono',
        fontSize: 12,
        letterSpacing: '0.18em',
        color: color ?? 'var(--color-d-mut)',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

function Section({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <section
      style={{
        padding: 'clamp(48px, 7vw, 80px) 0',
        borderBottom: last ? 'none' : '1px solid var(--color-d-line)',
      }}
    >
      {children}
    </section>
  )
}

// ============================================================
// Como funciona
// ============================================================

function ComoFuncionaSection() {
  return (
    <Section>
      <SectionHeader
        id="como"
        kicker="COMO FUNCIONA"
        title="Quatro passos até a glória"
        sub="Nada de escolher seu time a dedo. Aqui é o dado que manda — e você joga com o que ele te der."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        <StepCard
          num="01"
          title="Sorteie o XI"
          body="Cada posição rola o dado: ele sorteia uma seleção e escala um convocado dela pra aquela vaga. Onze rolagens, onze craques."
          icon={<MiniDice />}
        />
        <StepCard
          num="02"
          title="Fase de grupos"
          body="Seu time entra em um dos 12 grupos. Jogue os 3 jogos e brigue por uma vaga: top 2 de cada grupo, mais os 8 melhores terceiros."
          icon={<MiniBadge label="12G" />}
        />
        <StepCard
          num="03"
          title="Mata-mata"
          body="32 classificados, 5 fases sem volta: 32-avos, oitavas, quartas, semis e final. Uma derrota e acabou."
          icon={<MiniBadge label="×5" />}
        />
        <StepCard
          num="04"
          title="Conquiste o mundo"
          body="Vença as cinco fases do mata-mata, ganhe a final e erga o caneco. O time que o dado te deu, campeão do mundo."
          icon={<span style={{ fontFamily: 'Anton', fontSize: 26, color: 'var(--color-d-lime)' }}>★</span>}
          highlight
        />
      </div>
    </Section>
  )
}

function StepCard({
  num,
  title,
  body,
  icon,
  highlight,
}: {
  num: string
  title: string
  body: string
  icon: ReactNode
  highlight?: boolean
}) {
  const baseBg = highlight
    ? 'linear-gradient(160deg, rgba(212,255,61,0.12), rgba(212,255,61,0.02))'
    : 'var(--color-d-surface)'
  const baseBorder = highlight ? '1px solid rgba(212,255,61,0.35)' : '1px solid var(--color-d-line)'
  return (
    <div
      style={{
        background: baseBg,
        border: baseBorder,
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <span style={{ fontFamily: 'Anton', fontSize: 34, color: 'var(--color-d-lime)' }}>{num}</span>
        {icon}
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 7 }}>{title}</div>
      <p style={{ color: 'var(--color-d-mut)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  )
}

function MiniDice() {
  const dot: CSSProperties = { width: 4, height: 4, borderRadius: '50%', background: 'var(--color-d-lime)' }
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 3,
        padding: 9,
      }}
    >
      <i style={dot} />
      <i />
      <i style={{ ...dot, justifySelf: 'end' }} />
      <i />
      <i style={{ ...dot, justifySelf: 'center' }} />
      <i />
      <i style={dot} />
      <i />
      <i style={{ ...dot, justifySelf: 'end' }} />
    </span>
  )
}

function MiniBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Space Mono',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-d-mut)',
      }}
    >
      {label}
    </span>
  )
}

// ============================================================
// Regras do dado
// ============================================================

function RegrasSection() {
  return (
    <Section>
      <SectionHeader
        kicker="AS REGRAS DO DADO"
        title="O acaso com método"
        sub="Três regras impedem que você caia sempre na mesma seleção — e a dificuldade decide quanto controle você tem."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <RegraCard
          num="01"
          tag="TRAVA"
          title="Posição preenchida não muda"
          body="Sorteou e escalou? Aquela vaga está travada. Sem voltar atrás."
        />
        <RegraCard
          num="02"
          tag="COOLDOWN"
          title="Seleção descansa 5 rolagens"
          body="Uma seleção já sorteada fica de fora dos próximos 5 sorteios. Times variados garantidos."
        />
        <RegraCard
          num="03"
          tag="SKIP"
          title="Não gostou? Re-sorteie"
          body="Pular gasta 1 pulo e re-sorteia a seleção — que entra no cooldown. Os pulos são limitados."
        />
      </div>
      <DifficultyBand />
    </Section>
  )
}

function RegraCard({
  num,
  tag,
  title,
  body,
}: {
  num: string
  tag: string
  title: string
  body: string
}) {
  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 16,
        padding: 22,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--color-d-lime)',
          marginBottom: 12,
        }}
      >
        {num} · {tag}
      </div>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{title}</div>
      <p style={{ color: 'var(--color-d-mut)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  )
}

function DifficultyBand() {
  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 16,
        padding: '22px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '1 1 200px' }}>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--color-d-mut)',
            marginBottom: 6,
          }}
        >
          PULOS POR DIFICULDADE
        </div>
        <div style={{ color: 'var(--color-d-mut)', fontSize: 14, lineHeight: 1.5 }}>
          Quanto mais difícil, menos vezes você pode recusar o que o dado mandou.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DifficultyChip value="5" label="FÁCIL" color="var(--color-d-lime)" />
        <DifficultyChip value="3" label="MÉDIO" />
        <DifficultyChip value="1" label="DIFÍCIL" color="var(--color-d-red)" />
      </div>
    </div>
  )
}

function DifficultyChip({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 11,
        padding: '12px 18px',
        minWidth: 88,
      }}
    >
      <div style={{ fontFamily: 'Anton', fontSize: 30, color: color ?? 'var(--color-d-ink)' }}>{value}</div>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--color-d-mut)',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ============================================================
// O caminho
// ============================================================

function CaminhoSection() {
  return (
    <Section>
      <SectionHeader kicker="O CAMINHO" title="Da escalação à goleada" />
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, flexWrap: 'wrap' }}>
        <PathCard num="01" title="ESCALAÇÃO" sub="Monte o XI no dado" to="/draft" />
        <PathCard num="02" title="GRUPOS" sub="Jogue os 3 jogos" to="/groups" />
        <PathCard num="03" title="CHAVEAMENTO" sub="5 fases de mata-mata" to="/bracket" />
        <PathCard num="04" title="PARTIDA" sub="Simule e seja campeão" to="/match" />
      </div>
    </Section>
  )
}

function PathCard({ num, title, sub, to }: { num: string; title: string; sub: string; to: string }) {
  return (
    <Link
      to={to}
      className="d26-path-card"
      style={{
        flex: '1 1 150px',
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 14,
        padding: 18,
        color: 'var(--color-d-ink)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        textDecoration: 'none',
      }}
    >
      <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-lime)' }}>{num}</span>
      <span style={{ fontFamily: 'Anton', fontSize: 19 }}>{title}</span>
      <span style={{ fontSize: 12, color: 'var(--color-d-mut)' }}>{sub}</span>
    </Link>
  )
}

// ============================================================
// 48 seleções
// ============================================================

interface BadgeSample {
  code: string
  bg: string
}

const SAMPLE_TEAMS: BadgeSample[] = [
  { code: 'BRA', bg: 'linear-gradient(135deg, #1c9b4b 50%, #f5d11e 50%)' },
  { code: 'ARG', bg: 'linear-gradient(180deg, #6ea8ff 33%, #fff 33%, #fff 66%, #6ea8ff 66%)' },
  { code: 'FRA', bg: 'linear-gradient(90deg, #1b3a8f 33%, #fff 33%, #fff 66%, #e2483d 66%)' },
  { code: 'ESP', bg: '#e2483d' },
  { code: 'GER', bg: 'linear-gradient(180deg, #111 50%, #e2483d 50%)' },
  { code: 'POR', bg: 'linear-gradient(90deg, #0a7d3a 33%, #fff 33%, #fff 66%, #0a7d3a 66%)' },
  { code: 'ENG', bg: 'linear-gradient(180deg, #e2483d 50%, #fff 50%)' },
  { code: 'URU', bg: '#5aa0ff' },
]

function SelecoesSection() {
  return (
    <Section>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 28,
        }}
      >
        <div>
          <Kicker color="var(--color-d-lime)">48 SELEÇÕES</Kicker>
          <h2
            style={{
              fontFamily: 'Anton',
              fontWeight: 400,
              fontSize: 'clamp(28px, 5vw, 40px)',
              lineHeight: 1,
              margin: 0,
            }}
          >
            Cor e código, sem bandeira
          </h2>
        </div>
        <p
          style={{
            color: 'var(--color-d-mut)',
            fontSize: 14,
            lineHeight: 1.55,
            margin: 0,
            maxWidth: 340,
          }}
        >
          Cada seleção é um par de cores e um código de três letras. Limpo, rápido de ler e funciona pras 48.
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {SAMPLE_TEAMS.map((t) => (
          <TeamBadge key={t.code} sample={t} />
        ))}
        <Link
          to="/teams"
          style={{
            width: 64,
            height: 44,
            borderRadius: 8,
            background: 'var(--color-d-surface2)',
            border: '1px dashed var(--color-d-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Space Mono',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-d-mut)',
            textDecoration: 'none',
          }}
        >
          +40
        </Link>
      </div>
    </Section>
  )
}

function TeamBadge({ sample }: { sample: BadgeSample }) {
  return (
    <div
      style={{
        width: 64,
        height: 44,
        borderRadius: 8,
        background: sample.bg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '8px 7px 4px',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.7) 40%, rgba(0, 0, 0, 1) 80%)',
          fontFamily: 'Space Mono',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.04em',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.55)',
          textAlign: 'center',
        }}
      >
        {sample.code}
      </span>
    </div>
  )
}

// ============================================================
// CTA Final + Footer
// ============================================================

function CtaFinalSection() {
  return (
    <div
      style={{
        padding: 'clamp(56px, 9vw, 110px) clamp(20px, 5vw, 56px)',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #0a0b09, #101310)',
      }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Kicker color="var(--color-d-lime)">SEU DADO ESTÁ ESPERANDO</Kicker>
        <h2
          style={{
            fontFamily: 'Anton',
            fontWeight: 400,
            fontSize: 'clamp(36px, 8vw, 64px)',
            lineHeight: 0.96,
            margin: '0 0 26px',
          }}
        >
          PRONTO PRA
          <br />
          <span style={{ color: 'var(--color-d-lime)' }}>CONQUISTAR O MUNDO?</span>
        </h2>
        <Link
          to="/draft"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--color-d-lime)',
            color: 'var(--color-d-bg)',
            borderRadius: 13,
            padding: '18px 34px',
            fontFamily: 'Anton',
            fontSize: 22,
            letterSpacing: '0.02em',
            textDecoration: 'none',
            animation: 'd26-pulse 2.6s ease-out infinite',
          }}
        >
          <SmallDice />
          JOGAR AGORA
        </Link>
      </div>
    </div>
  )
}

function Footer({ onPrivacy }: { onPrivacy: () => void }) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--color-d-line)',
        padding: '24px clamp(20px, 5vw, 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <Wordmark small />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          fontFamily: 'Space Mono',
          fontSize: 11,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.08em',
        }}
      >
        <span>JOGO NO DADO · COPA 2026 · 48 SELEÇÕES</span>
        <button
          type="button"
          onClick={onPrivacy}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-d-mut)',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            letterSpacing: 'inherit',
            textDecoration: 'underline dotted',
            textUnderlineOffset: 3,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          PRIVACIDADE · LGPD
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Privacy / LGPD drawer
// ============================================================

function PrivacyDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,5,0.78)',
          backdropFilter: 'blur(4px)',
          zIndex: 30,
          animation: 'd26-fade-in .25s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 31,
          display: 'flex',
          justifyContent: 'center',
          animation: 'd26-sheet-up .32s cubic-bezier(.2,.9,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 640,
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'var(--color-d-surface)',
            border: '1px solid var(--color-d-line)',
            borderBottom: 'none',
            borderRadius: '22px 22px 0 0',
            boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.7)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              padding: '24px clamp(20px, 5vw, 32px) 20px',
              borderBottom: '1px solid var(--color-d-line)',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: 44,
                height: 5,
                borderRadius: 5,
                background: 'rgba(255,255,255,0.15)',
                margin: '0 auto 18px',
              }}
            />
            <button
              type="button"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'var(--color-d-surface2)',
                border: '1px solid var(--color-d-line)',
                color: 'var(--color-d-ink)',
                borderRadius: 8,
                width: 30,
                height: 30,
                fontSize: 14,
                cursor: 'pointer',
              }}
              aria-label="Fechar"
            >
              ✕
            </button>
            <Kicker color="var(--color-d-lime)">PRIVACIDADE · LGPD</Kicker>
            <h2
              style={{
                fontFamily: 'Anton',
                fontWeight: 400,
                fontSize: 'clamp(28px, 5vw, 36px)',
                margin: '0 0 6px',
                lineHeight: 0.95,
              }}
            >
              SEUS DADOS, SEU CONTROLE
            </h2>
            <p
              style={{
                fontFamily: 'Space Mono',
                fontSize: 12,
                color: 'var(--color-d-mut)',
                margin: 0,
                letterSpacing: '0.04em',
              }}
            >
              Versão preliminar. Conteúdo será revisado com o time legal.
            </p>
          </div>
          <div style={{ padding: 'clamp(18px, 4vw, 28px) clamp(20px, 5vw, 32px) 28px' }}>
            <PrivacySection title="O QUE COLETAMOS">
              Tudo o que você joga no Draft 26 — formação escolhida, time montado, resultados de
              partidas e progressão na Copa — fica gravado{' '}
              <b style={{ color: 'var(--color-d-ink)' }}>localmente no seu navegador</b> (localStorage).
              Não pedimos cadastro, nome ou email pra jogar.
            </PrivacySection>
            <PrivacySection title="O QUE COMPARTILHAMOS">
              Quando você termina uma campanha, um espelho anônimo do seu run pode ser enviado
              pro nosso backend (Supabase, RLS-protected) pra alimentar leaderboards e estatísticas
              agregadas. Sem dados pessoais — só o XI, o desempenho e um ID anônimo.
            </PrivacySection>
            <PrivacySection title="COOKIES E TRACKING">
              Usamos apenas armazenamento local pra manter seu progresso entre sessões. Sem
              cookies de terceiros, sem analytics invasivo. Fontes Google (Anton / Archivo /
              Space Mono) são carregadas via CDN.
            </PrivacySection>
            <PrivacySection title="SEUS DIREITOS · LGPD">
              Sob a Lei Geral de Proteção de Dados, você pode pedir acesso, correção ou exclusão
              dos seus dados a qualquer momento. Como o jogo não exige cadastro, limpar o
              localStorage do navegador já apaga tudo do seu lado. Pra remover o run espelhado
              no backend, é só nos contatar.
            </PrivacySection>
            <PrivacySection title="CONTATO" last>
              Esta é uma versão preliminar. Quando finalizarmos os termos, adicionamos email de
              contato e canal pra solicitações LGPD aqui.
            </PrivacySection>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                marginTop: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'var(--color-d-lime)',
                color: 'var(--color-d-bg)',
                border: 'none',
                borderRadius: 12,
                padding: 15,
                fontFamily: 'Anton',
                fontSize: 18,
                letterSpacing: '0.02em',
                cursor: 'pointer',
              }}
            >
              ENTENDI →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function PrivacySection({
  title,
  children,
  last,
}: {
  title: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <section
      style={{
        marginBottom: last ? 0 : 22,
        paddingBottom: last ? 0 : 22,
        borderBottom: last ? 'none' : '1px solid var(--color-d-line)',
      }}
    >
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.18em',
          color: 'var(--color-d-lime)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <p
        style={{
          color: 'var(--color-d-mut)',
          fontSize: 14,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {children}
      </p>
    </section>
  )
}
