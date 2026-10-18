import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { BANKS } from '../lib/banks'
import { ACCOUNT_ICONS, PALETTE } from '../lib/icons'
import { AccountIcon } from './Avatars'
import { Modal, Segmented } from './ui'

export interface IconChoice {
  icon: string
  color: string
}

export function AccountIconPicker({
  initial, onPick, onBack, noun = 'conta',
}: {
  initial: IconChoice | null
  onPick: (c: IconChoice) => void
  onBack: () => void
  noun?: string
}) {
  const [tab, setTab] = useState<'banks' | 'custom'>(initial?.icon.startsWith('icon:') ? 'custom' : 'banks')
  const [q, setQ] = useState('')
  const [choice, setChoice] = useState<IconChoice>(initial ?? { icon: '', color: '#f3f4f1' })
  const banks = BANKS.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()))
  const genericKey = choice.icon.startsWith('icon:') ? choice.icon.slice(5) : 'bank'
  return (
    <Modal title="Selecione o ícone" subtitle={`Escolha o ícone que representa esta ${noun}`} onClose={onBack} wide>
      <div className="icon-tabs"><Segmented value={tab} onChange={setTab} options={[['banks', 'Instituições financeiras'], ['custom', 'Ícones personalizados']]} /></div>
      <div style={{ height: 14 }} />
      {tab === 'banks' ? (
        <>
          <div className="input" style={{ height: 38, marginBottom: 12 }}>
            <Search size={16} className="muted" />
            <input placeholder="Pesquisar" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            {q && <button onClick={() => setQ('')} aria-label="Limpar"><X size={14} /></button>}
          </div>
          <div className="icon-grid">
            {banks.map((b) => {
              const icon = `bank:${b.id}`
              return (
                <button key={b.id} className={choice.icon === icon ? 'on' : ''} onClick={() => setChoice({ icon, color: b.bg })}>
                  <AccountIcon icon={icon} color={b.bg} size={40} />
                  {b.name}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="generic-icons">
            {Object.entries(ACCOUNT_ICONS).map(([key, { label }]) => (
                <button key={key} className={genericKey === key ? 'on' : ''} onClick={() => setChoice({ icon: `icon:${key}`, color: choice.icon.startsWith('icon:') ? choice.color : '#f3f4f1' })}>
                  <AccountIcon icon={`icon:${key}`} color={choice.icon === `icon:${key}` ? choice.color : '#f3f4f1'} size={40} />
                  {label}
                </button>
            ))}
          </div>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`swatch ${choice.icon.startsWith('icon:') && choice.color === c ? 'on' : ''}`}
                style={{ background: c }}
                aria-label={c}
                onClick={() => setChoice({ icon: `icon:${genericKey}`, color: c })}
              />
            ))}
          </div>
        </>
      )}
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onBack}>Voltar</button>
        <button className="btn btn-primary" disabled={!choice.icon} onClick={() => onPick(choice)}>Selecionar ícone</button>
      </div>
    </Modal>
  )
}
