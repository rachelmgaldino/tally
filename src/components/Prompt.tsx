import { Repeat2, X } from 'lucide-react'
import { useEffect } from 'react'

export interface PromptOption {
  label: string
  primary?: boolean
  onClick: () => void | Promise<void>
}

export interface PromptConfig {
  title: string
  text: string
  options: PromptOption[]
}

/** Organizze's bottom-right card for questions about recurring entries. */
export function PromptCard({ prompt, onClose }: { prompt: PromptConfig; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="prompt-card" role="alertdialog" aria-label={prompt.title}>
      <button className="prompt-close" onClick={onClose} aria-label="Fechar"><X size={14} /></button>
      <span className="prompt-icon"><Repeat2 size={18} /></span>
      <h3>{prompt.title}</h3>
      <p>{prompt.text}</p>
      {prompt.options.map((o) => (
        <button key={o.label} className={`prompt-option ${o.primary ? 'primary' : ''}`} onClick={async () => { onClose(); await o.onClick() }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
