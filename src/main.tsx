import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { AppLayout } from './AppLayout'
import { Home } from './routes/Home'
import { Tournament } from './routes/Tournament'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="/torneio/:id" element={<Tournament />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
