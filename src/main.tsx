import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { AppLayout } from './AppLayout'
import { Home } from './routes/Home'
import { Selecoes } from './routes/Selecoes'
import { SelecaoDetalhe } from './routes/SelecaoDetalhe'
import { Draft } from './routes/Draft'
import { Copa } from './routes/Copa'
import { Match } from './routes/Match'
import { MataMata } from './routes/MataMata'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="/selecoes" element={<Selecoes />} />
          <Route path="/selecoes/:code" element={<SelecaoDetalhe />} />
          <Route path="/draft" element={<Draft />} />
          <Route path="/copa" element={<Copa />} />
          <Route path="/copa/partida" element={<Match />} />
          <Route path="/mata-mata" element={<MataMata />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
