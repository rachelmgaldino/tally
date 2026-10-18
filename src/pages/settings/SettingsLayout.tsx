import { Outlet } from 'react-router-dom'

export default function SettingsLayout() {
  return (
    <main className="page">
      <Outlet />
    </main>
  )
}
