import { NavLink, Outlet } from 'react-router-dom'

export default function SettingsLayout() {
  return (
    <main className="page">
      <div className="settings">
        <nav className="settings-nav">
          <NavLink to="categorias">Categorias</NavLink>
          <NavLink to="contas">Contas</NavLink>
          <NavLink to="cartoes">Cartões de crédito</NavLink>
        </nav>
        <div className="card card-pad"><Outlet /></div>
      </div>
    </main>
  )
}
