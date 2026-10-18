import { Outlet } from 'react-router-dom'
import { BackToMore } from '../../components/ui'

export default function SettingsLayout() {
  return (
    <main className="page">
      <BackToMore />
      <Outlet />
    </main>
  )
}
