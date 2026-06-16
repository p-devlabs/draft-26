import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import './index.css'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { SquadsGate } from './components/SquadsGate'
import { loadSquads } from './data/squads'
import { initAnalytics } from './lib/analytics'
import { features } from './lib/features'
import { runDistortionBatch, simulateFullCup } from './lib/sim-harness'
import { trackSessionOnce, PageViewTracker } from './lib/track'
import { Home } from './routes/Home'

// Rotas pesadas viram lazy chunks. Home fica eager porque é a landing —
// a primeira renderização não pode pagar o custo de um round-trip extra.
// Todas as rotas exportam named (export function X), por isso o wrapper
// `.then(m => ({ default: m.X }))` pra alimentar o React.lazy.
const Selecoes = lazy(() => import('./routes/Selecoes').then((m) => ({ default: m.Selecoes })))
const SelecaoDetalhe = lazy(() =>
  import('./routes/SelecaoDetalhe').then((m) => ({ default: m.SelecaoDetalhe })),
)
const Draft = lazy(() => import('./routes/Draft').then((m) => ({ default: m.Draft })))
const Copa = lazy(() => import('./routes/Copa').then((m) => ({ default: m.Copa })))
const Match = lazy(() => import('./routes/Match').then((m) => ({ default: m.Match })))
const MataMata = lazy(() => import('./routes/MataMata').then((m) => ({ default: m.MataMata })))
const PenaltiesDev = lazy(() =>
  import('./routes/PenaltiesDev').then((m) => ({ default: m.PenaltiesDev })),
)
const OutcomeDev = lazy(() =>
  import('./routes/OutcomeDev').then((m) => ({ default: m.OutcomeDev })),
)

initAnalytics()
trackSessionOnce()

// Em dev mode, expõe o harness de simulação pro Playwright (e debugging
// manual no console). Em prod fica desligado, custo zero.
//
// A atribuição é diferida até `loadSquads()` resolver — assim o Playwright
// pode usar `waitForFunction(() => '__draft26__' in window)` como gate
// natural pra esperar os dados carregarem.
if (features.dev) {
  loadSquads()
    .then(() => {
      ;(window as unknown as { __draft26__: object }).__draft26__ = {
        simulateFullCup,
        runDistortionBatch,
      }
    })
    .catch(() => {
      // Se o fetch falhar, o gate vai mostrar erro pro user; nada a fazer aqui.
    })
}

// Fallback minimalista: só reserva a viewport pra evitar layout shift
// enquanto o chunk da rota carrega. Sem texto/spinner pra não piscar.
const RouteFallback = <div aria-busy="true" style={{ minHeight: '100dvh' }} />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <SquadsGate>
        <BrowserRouter>
          <PageViewTracker />
          <Suspense fallback={RouteFallback}>
            <Routes>
              <Route index element={<Home />} />
              <Route path="/teams" element={<Selecoes />} />
              <Route path="/teams/:code" element={<SelecaoDetalhe />} />
              <Route path="/draft" element={<Draft />} />
              <Route path="/groups" element={<Copa />} />
              <Route path="/bracket" element={<MataMata />} />
              <Route path="/match" element={<Match />} />
              <Route path="/dev/penalties" element={<PenaltiesDev />} />
              <Route path="/dev/outcomes" element={<OutcomeDev />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SquadsGate>
    </AppErrorBoundary>
  </StrictMode>,
)
