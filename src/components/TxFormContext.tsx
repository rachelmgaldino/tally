import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Transaction, TxKind } from '../lib/types'
import { PromptCard, type PromptConfig } from './Prompt'
import { TransactionForm } from './TransactionForm'

interface FormState {
  kind: TxKind
  editing?: Transaction
  /** Pre-filled values for a copy. */
  copyOf?: Transaction
  accountId?: string
  /** Open with the Repetir section showing ("Repetir" in the side panel). */
  repeat?: boolean
}

interface Ctx {
  open: (state: FormState) => void
  /** Show a question card in the corner; it stays up after the form closes. */
  ask: (prompt: PromptConfig) => void
}

const TxFormContext = createContext<Ctx>({ open: () => {}, ask: () => {} })

function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export function TxFormProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FormState | null>(null)
  const [prompt, setPrompt] = useState<PromptConfig | null>(null)
  const open = useCallback((s: FormState) => setState(s), [])
  const ask = useCallback((p: PromptConfig) => setPrompt(p), [])
  const closePrompt = useCallback(() => setPrompt(null), [])

  // Organizze's shortcuts: D = despesa, R = receita, T = transferência.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      if (document.querySelector('.overlay')) return
      const kind = ({ d: 'expense', r: 'income', t: 'transfer' } as const)[e.key.toLowerCase() as 'd' | 'r' | 't']
      if (kind) {
        e.preventDefault()
        setState({ kind })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  return (
    <TxFormContext.Provider value={{ open, ask }}>
      {children}
      {state && (
        <TransactionForm
          key={`${state.kind}-${state.editing?.id ?? state.copyOf?.id ?? 'new'}`}
          kind={state.kind}
          editing={state.editing}
          copyOf={state.copyOf}
          defaultAccountId={state.accountId}
          startRepeat={state.repeat}
          onClose={() => setState(null)}
        />
      )}
      {prompt && <PromptCard prompt={prompt} onClose={closePrompt} />}
    </TxFormContext.Provider>
  )
}

export const useTxForm = () => useContext(TxFormContext)
