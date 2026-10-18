import { ChevronRight, LogOut, SlidersHorizontal, Tag, Upload, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../components/Avatars'
import { Mascot } from '../components/Sidebar'
import { DEMO } from '../lib/config'
import { useAccounts, useCards } from '../lib/queries'
import { supabase } from '../lib/supabase'

/** The phone's "Mais" tab: everything the desktop sidebar keeps under Ajustes. */
export default function More({ name }: { name: string }) {
  const { data: accounts = [] } = useAccounts()
  const { data: cards = [] } = useCards()
  const nAcc = accounts.filter((a) => !a.archived).length
  const nCard = cards.filter((c) => !c.archived).length
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return (
    <main className="page more">
      <header className="page-head"><h1>Mais</h1></header>

      <Link to="/perfil" className="card more-profile">
        <UserAvatar size={52} fontSize={18} />
        <span style={{ flex: 1, minWidth: 0 }}><b>{name}</b><small>Meu perfil</small></span>
        <ChevronRight size={20} className="muted" />
      </Link>

      <div className="more-grid">
        <Link to="/configuracoes/contas" style={{ background: 'var(--lavender)' }}>
          <span className="bi"><Wallet size={20} /></span>
          <span><b>Contas e cartões</b><small>{plural(nAcc, 'conta', 'contas')}, {plural(nCard, 'cartão', 'cartões')}</small></span>
        </Link>
        <Link to="/configuracoes/categorias" style={{ background: 'var(--green)' }}>
          <span className="bi"><Tag size={20} /></span>
          <span><b>Categorias</b><small>despesas e receitas</small></span>
        </Link>
        <Link to="/configuracoes/preferencias" style={{ background: 'var(--blue)' }}>
          <span className="bi"><SlidersHorizontal size={20} /></span>
          <span><b>Preferências</b><small>ordem, período, saldo</small></span>
        </Link>
        <div className="soon" style={{ background: 'var(--sand)' }} aria-disabled="true">
          <span className="bi"><Upload size={20} /></span>
          <span><b>Importar extrato</b><small>em breve</small></span>
        </div>
      </div>

      <div className="card more-list">
        <button className="expense" onClick={() => !DEMO && supabase.auth.signOut()}><LogOut size={20} /> Sair</button>
      </div>

      <div className="more-foot"><Mascot size={40} /><span>tally · feito só pra você</span></div>
    </main>
  )
}
