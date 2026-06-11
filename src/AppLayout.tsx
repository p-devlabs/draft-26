import { Link, Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-display text-lg tracking-tight text-ink">
            Draft
            <span className="ml-2 text-ink-soft text-sm align-baseline">26</span>
          </Link>
          <nav className="text-sm text-ink-soft flex gap-6">
            <Link to="/teams" className="hover:text-ink transition-colors">Seleções</Link>
            <a href="/#como-funciona" className="hover:text-ink transition-colors">Como funciona</a>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <FooterMini />
    </div>
  )
}

function FooterMini() {
  const { pathname } = window.location
  // Na home a landing já tem créditos próprios; nas outras rotas o mini-footer aparece
  if (pathname === '/' || pathname === '') return null
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-ink-soft flex justify-between">
        <span>48 seleções · 26 convocados · 1 verão</span>
        <span>v0.1</span>
      </div>
    </footer>
  )
}

