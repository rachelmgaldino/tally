import { Bell, CircleUser, LogOut, Settings, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { DEMO } from '../lib/config'
import { supabase } from '../lib/supabase'

function Dropdown({ icon, label, children }: { icon: React.ReactNode; label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button aria-label={label} onClick={() => setOpen((o) => !o)} style={{ color: '#fff', display: 'flex' }}>{icon}</button>
      {open && <div className="menu">{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="logo"><span className="logo-mark" />tally</Link>
        <nav className="nav">
          <NavLink to="/" end>visão geral</NavLink>
          <NavLink to="/lancamentos">lançamentos</NavLink>
        </nav>
        <div className="topbar-actions">
          <Dropdown icon={<Settings size={18} />} label="Configurações">
            {(close) => (
              <>
                <Link to="/configuracoes/categorias" onClick={close}>Categorias</Link>
                <Link to="/configuracoes/contas" onClick={close}>Contas</Link>
                <Link to="/configuracoes/cartoes" onClick={close}>Cartões de crédito</Link>
              </>
            )}
          </Dropdown>
          <button aria-label="Notificações" title="Em breve"><Bell size={18} /></button>
          <Dropdown icon={<CircleUser size={24} />} label="Conta">
            {(close) => (
              <>
                <Link to="/perfil" onClick={close}><User size={16} /> Meu perfil</Link>
                <button onClick={() => !DEMO && supabase.auth.signOut()}>
                  <LogOut size={16} /> Sair
                </button>
              </>
            )}
          </Dropdown>
        </div>
      </div>
    </header>
  )
}
