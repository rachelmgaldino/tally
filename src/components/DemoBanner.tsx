import { RotateCcw } from 'lucide-react'
import { useConfirm } from './Confirm'
import { resetDemo } from '../lib/demo'
import './DemoBanner.css'

/** Says the data is made up, and lets a visitor start over from the sample data. */
export function DemoBanner() {
  const confirm = useConfirm()
  async function reset() {
    const ok = await confirm({
      title: 'Recomeçar a demonstração?',
      text: 'O que você mudou some e os dados de exemplo voltam.',
      confirm: 'Recomeçar',
    })
    if (ok) resetDemo()
  }
  return (
    <div className="demo-banner" role="note">
      <span><b>Demonstração</b><span className="demo-banner-mid"> com dados de exemplo.</span><span className="demo-banner-more"> O que você mudar fica só neste navegador.</span></span>
      <button type="button" onClick={reset}><RotateCcw size={14} /> Recomeçar</button>
    </div>
  )
}
