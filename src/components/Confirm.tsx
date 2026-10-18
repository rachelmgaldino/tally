import { Trash2 } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ConfirmConfig {
  title: string
  text?: string
  /** Label of the button that goes ahead, e.g. "Excluir". */
  confirm?: string
}

const ConfirmContext = createContext<(c: ConfirmConfig) => Promise<boolean>>(async () => false)

/** A Tally-styled "are you sure?" popup, used before anything is deleted. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<ConfirmConfig | null>(null)
  const resolver = useRef<((ok: boolean) => void) | undefined>(undefined)
  const ask = useCallback((c: ConfirmConfig) => {
    resolver.current?.(false)
    setShown(c)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])
  const answer = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = undefined
    setShown(null)
  }, [])
  useEffect(() => {
    if (!shown) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && answer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown, answer])
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {shown && (
        <div className="overlay confirm-overlay" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
          <div className="modal confirm-box" role="alertdialog" aria-modal="true" aria-label={shown.title}>
            <span className="confirm-icon"><Trash2 size={22} /></span>
            <h2>{shown.title}</h2>
            {shown.text && <p>{shown.text}</p>}
            <div className="confirm-foot">
              <button className="btn" onClick={() => answer(false)}>Cancelar</button>
              <button className="btn btn-danger" autoFocus onClick={() => answer(true)}>{shown.confirm ?? 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
