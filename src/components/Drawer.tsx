import { useEffect, type ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  /** Trava o swipe-down / click no backdrop. Use quando a ação for irreversível. */
  locked?: boolean
  /** Altura máxima como % do viewport. Default 90. */
  maxHeightVh?: number
  children: ReactNode
}

export function Drawer({ open, onClose, locked, maxHeightVh = 90, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, locked, onClose])

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
    >
      <div
        onClick={() => !locked && onClose()}
        className={`absolute inset-0 bg-ink/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: `${maxHeightVh}vh` }}
        className={`absolute bottom-0 left-0 right-0 bg-paper rounded-t-3xl shadow-2xl border-t border-rule
          overflow-y-auto transition-transform duration-300 ease-out
          ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="sticky top-0 bg-paper pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-rule" />
        </div>
        {children}
      </div>
    </div>
  )
}
