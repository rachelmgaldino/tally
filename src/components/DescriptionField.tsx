import { AlignLeft, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { dayMonth } from '../lib/dates'
import { t } from '../lib/i18n'
import { currencyOf, formatMoney } from '../lib/money'
import { fold, matchAt, MIN_TYPED, suggestions, type Suggestion } from '../lib/suggest'
import type { Account, Card, Category, Transaction, TxKind } from '../lib/types'
import { CategoryAvatar } from './Avatars'

/**
 * Descrição with suggestions from past entries: the most used names as chips
 * while it's empty, then a list of matches with their category and card once
 * a couple of letters are typed. Picking one hands it to the form to copy.
 */
export function DescriptionField({
  value, onChange, kind, txs, categories, accounts, cards, picked, onPick, suggest,
}: {
  value: string
  onChange: (v: string) => void
  kind: TxKind
  txs: Transaction[]
  categories: Category[]
  accounts: Account[]
  cards: Card[]
  /** The suggestion that filled the form, while the description still matches it. */
  picked: Suggestion | null
  onPick: (s: Suggestion) => void
  /** Off when editing and for transfers. */
  suggest: boolean
}) {
  const s = t().form
  const [focus, setFocus] = useState(false)
  const [hi, setHi] = useState(0)
  const typed = fold(value).length >= MIN_TYPED
  const offer = suggest && !picked ? suggestions(txs, kind, typed ? value : '', typed ? 5 : 4) : []
  const listOpen = focus && typed && offer.length > 0
  const chips = !typed && offer.length > 0

  const category = (x: Transaction) => categories.find((c) => c.id === x.category_id)
  const source = (x: Transaction) => cards.find((c) => c.id === x.card_id) ?? accounts.find((a) => a.id === x.account_id)
  const marked = (d: string) => {
    const m = matchAt(d, value)
    return m ? <>{d.slice(0, m[0])}<b>{d.slice(m[0], m[1])}</b>{d.slice(m[1])}</> : d
  }
  function pick(o: Suggestion) {
    onPick(o)
    setHi(0)
  }
  function keys(e: React.KeyboardEvent) {
    if (!listOpen) return
    const at = Math.min(hi, offer.length - 1)
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((at + 1) % offer.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((at - 1 + offer.length) % offer.length) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(offer[at]) }
    // Closes the list, not the whole form.
    else if (e.key === 'Escape') { e.preventDefault(); setFocus(false) }
  }

  return (
    <div className="field f-desc">
      <span className="f-ico phone-only"><AlignLeft size={20} /></span>
      <label htmlFor="desc">{s.description}</label>
      <input id="desc" className="input" autoComplete="off" placeholder={s.descriptionPlaceholder} value={value}
        role="combobox" aria-expanded={listOpen} aria-controls="desc-list" aria-autocomplete="list"
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onKeyDown={keys}
        onChange={(e) => { onChange(e.target.value); setHi(0); setFocus(true) }} />
      {listOpen && (
        <div className="ac-list" id="desc-list" role="listbox" aria-label={s.suggestions}>
          {offer.map((o, i) => {
            const src = source(o.last)
            return (
              // Mouse down would blur the field and close the list before the click lands.
              <button type="button" role="option" aria-selected={i === Math.min(hi, offer.length - 1)} key={o.description}
                className={`ac-item ${i === Math.min(hi, offer.length - 1) ? 'on' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => pick(o)}>
                <CategoryAvatar category={category(o.last)} size={32} />
                <span className="ac-txt">
                  <span className="ac-name">{marked(o.description)}</span>
                  <small>{[category(o.last)?.name, src?.name].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="ac-meta">
                  <span>{formatMoney(o.last.amount_cents, currencyOf(src))}</span>
                  <small>{dayMonth(o.last.date)}</small>
                </span>
              </button>
            )
          })}
          <div className="ac-foot desk-only">
            <kbd>↑</kbd><kbd>↓</kbd> {s.suggestKeys[0]} · <kbd>Enter</kbd> {s.suggestKeys[1]} · <kbd>Esc</kbd> {s.suggestKeys[2]}
          </div>
        </div>
      )}
      {chips && (
        <div className="ac-chips">
          <span className="ac-chips-lbl">{s.frequent}</span>
          {offer.map((o) => (
            <button type="button" key={o.description} className="ac-chip" onClick={() => pick(o)}>
              <span className="ac-dot" style={{ background: category(o.last)?.color }} />
              <span>{o.description}</span>
            </button>
          ))}
        </div>
      )}
      {picked && (
        <div className="ac-filled-note">
          <Sparkles size={14} />
          <span>{s.filledLikeLast(!!picked.last.card_id, dayMonth(picked.last.date))}</span>
        </div>
      )}
    </div>
  )
}
