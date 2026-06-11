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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route index element={<Home />} />
        <Route path="/teams" element={<Selecoes />} />
        <Route path="/teams/:code" element={<SelecaoDetalhe />} />
        <Route path="/draft" element={<Draft />} />
        <Route path="/groups" element={<Copa />} />
        <Route path="/bracket" element={<MataMata />} />
        <Route path="/match" element={<Match />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
