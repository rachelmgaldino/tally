import { Info } from 'lucide-react'
import { CURRENCIES, currencyName, symbol, type Currency } from '../lib/money'
import { tone } from '../lib/theme'

/** Pills for an account's currency. Locked once the account has entries. */
export function CurrencyPicker({ value, onChange, label, note, locked }: {
  value: Currency
  onChange: (c: Currency) => void
  label: string
  note: string
  locked?: boolean
}) {
  return (
    <div className="field">
      <label id="cur-label">{label}</label>
      <div className="cur-pills" role="radiogroup" aria-labelledby="cur-label">
        {CURRENCIES.map((c) => (
          <button type="button" key={c} role="radio" aria-checked={c === value} disabled={locked && c !== value}
            className={`cur-pill ${c === value ? 'on toned' : ''}`} style={c === value ? tone('var(--yellow)') : undefined} onClick={() => onChange(c)}>
            <span className="s">{symbol(c)}</span>{currencyName(c)}
          </button>
        ))}
      </div>
      <p className="field-hint"><Info size={14} />{note}</p>
    </div>
  )
}
