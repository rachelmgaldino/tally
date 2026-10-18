import { Check, Undo2 } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastOptions {
  /** A button on the toast, e.g. "Desfazer". */
  action?: { label: string; onClick: () => void }
  /** Runs when the toast goes away without its action being used. */
  onExpire?: () => void
}

interface Shown extends ToastOptions { msg: string }

const ToastContext = createContext<(msg: string, options?: ToastOptions) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef<Shown | null>(null)
  const finish = useCallback((used: boolean) => {
    const was = current.current
    current.current = null
    setShown(null)
    if (was && !used) was.onExpire?.()
  }, [])
  const show = useCallback((msg: string, options: ToastOptions = {}) => {
    window.clearTimeout(timer.current)
    // A new toast replaces the old one, which counts as expiring.
    if (current.current) current.current.onExpire?.()
    const next = { msg, ...options }
    current.current = next
    setShown(next)
    timer.current = window.setTimeout(() => finish(false), options.action ? 6000 : 2500)
  }, [finish])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {shown && (
        <div className="toast" role="status">
          <span className="ok"><Check size={20} /></span>
          <span className="msg">{shown.msg}</span>
          {shown.action && (
            <button className="toast-act" onClick={() => {
              window.clearTimeout(timer.current)
              shown.action!.onClick()
              finish(true)
            }}><Undo2 size={16} /> {shown.action.label}</button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
