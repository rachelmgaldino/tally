import { RotateCcw } from 'lucide-react'
import { useConfirm } from './Confirm'
import { resetDemo } from '../lib/demo'
import { t } from '../lib/i18n'
import './DemoBanner.css'

/** Says the data is made up, and lets a visitor start over from the sample data. */
export function DemoBanner() {
  const confirm = useConfirm()
  const s = t().common.demo
  async function reset() {
    const ok = await confirm({
      title: s.resetTitle,
      text: s.resetText,
      confirm: s.reset,
    })
    if (ok) resetDemo()
  }
  return (
    <div className="demo-banner" role="note">
      <span><b>{s.title}</b><span className="demo-banner-mid">{s.mid}</span><span className="demo-banner-more">{s.more}</span></span>
      <button type="button" onClick={reset}><RotateCcw size={14} /> {s.reset}</button>
    </div>
  )
}
