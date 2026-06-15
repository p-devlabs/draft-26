import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { Home } from './routes/Home'
import { Selecoes } from './routes/Selecoes'
import { SelecaoDetalhe } from './routes/SelecaoDetalhe'
import { Draft } from './routes/Draft'
import { Copa } from './routes/Copa'
import { Match } from './routes/Match'
import { MataMata } from './routes/MataMata'
import { AdsProvider } from './components/ads/AdsProvider'
import { features } from './lib/features'
import { runDistortionBatch, simulateFullCup } from './lib/sim-harness'

// Em dev mode, expõe o harness de simulação pro Playwright (e debugging
// manual no console). Em prod fica desligado, custo zero.
if (features.dev) {
  ;(window as unknown as { __draft26__: object }).__draft26__ = {
    simulateFullCup,
    runDistortionBatch,
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AdsProvider>
        <Routes>
          <Route index element={<Home />} />
          <Route path="/teams" element={<Selecoes />} />
          <Route path="/teams/:code" element={<SelecaoDetalhe />} />
          <Route path="/draft" element={<Draft />} />
          <Route path="/groups" element={<Copa />} />
          <Route path="/bracket" element={<MataMata />} />
          <Route path="/match" element={<Match />} />
        </Routes>
      </AdsProvider>
    </BrowserRouter>
  </StrictMode>,
)
