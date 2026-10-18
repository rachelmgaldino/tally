import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { TxFormProvider } from './components/TxFormContext'
import { ToastProvider } from './components/Toast'
import { DEMO } from './lib/config'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Profile from './pages/Profile'
import Transactions from './pages/Transactions'
import Accounts from './pages/settings/Accounts'
import Cards from './pages/settings/Cards'
import Categories from './pages/settings/Categories'
import SettingsLayout from './pages/settings/SettingsLayout'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(DEMO ? null : undefined)
  const qc = useQueryClient()

  useEffect(() => {
    if (DEMO) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) qc.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  if (session === undefined) return null
  if (!DEMO && !session) return <Login />

  const email = session?.user.email ?? 'rachel@exemplo.com'
  const name = (session?.user.user_metadata?.name as string | undefined) || capitalize(email.split(/[@.]/)[0])

  return (
    <ToastProvider>
      <TxFormProvider>
        <TopBar />
        <Routes>
          <Route path="/" element={<Overview name={name} />} />
          <Route path="/lancamentos" element={<Transactions />} />
          <Route path="/perfil" element={<Profile name={name} email={email} />} />
          <Route path="/configuracoes" element={<SettingsLayout />}>
            <Route index element={<Navigate to="categorias" replace />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="contas" element={<Accounts />} />
            <Route path="cartoes" element={<Cards />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TxFormProvider>
    </ToastProvider>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
