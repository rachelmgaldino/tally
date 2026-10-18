import { CreditCard } from 'lucide-react'

export default function Cards() {
  return (
    <>
      <div className="settings-head"><h2>Cartões de Crédito</h2></div>
      <div className="placeholder">
        <span className="ico"><CreditCard size={18} /></span>
        <h3>Lista de cartões de crédito</h3>
        <p>Cartões e faturas chegam na próxima etapa.</p>
      </div>
    </>
  )
}
