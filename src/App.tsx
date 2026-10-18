import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomTabs } from './components/BottomTabs'
import { Sidebar } from './components/Sidebar'
import { TxFormProvider } from './components/TxFormContext'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/Confirm'
import { DemoBanner } from './components/DemoBanner'
import { DEMO } from './lib/config'
import { useSeriesUpkeep } from './lib/entries'
import { setLanguage } from './lib/i18n'
import { deviceLanguage, PrefsProvider } from './lib/prefs'
import { ProfileProvider } from './lib/profile'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Invoice from './pages/Invoice'
import More from './pages/More'
import Overview from './pages/Overview'
import Profile from './pages/Profile'
import Transactions from './pages/Transactions'
import AccountsAndCards from './pages/settings/AccountsAndCards'
import Categories from './pages/settings/Categories'
import Preferences from './pages/settings/Preferences'
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
  if (!DEMO && !session) {
    // Not signed in yet: the language last used on this device, or the browser's.
    setLanguage(deviceLanguage())
    return <Login />
  }

  const email = session?.user.email ?? 'rachel@exemplo.com'
  const name = (session?.user.user_metadata?.name as string | undefined) || capitalize(email.split(/[@.]/)[0])

  return (
    <ProfileProvider name={name} email={email} avatarPath={session?.user.user_metadata?.avatar_path as string | undefined}>
    <PrefsProvider saved={session?.user.user_metadata?.prefs}>
    <ToastProvider>
    <ConfirmProvider>
      <TxFormProvider>
        <SeriesUpkeep />
        {DEMO && <DemoBanner />}
        <div className="app">
        <Sidebar name={name} />
        <div className="app-main">
        <Routes>
          <Route path="/" element={<Overview name={name} />} />
          <Route path="/lancamentos" element={<Transactions />} />
          <Route path="/cartoes/:id" element={<Invoice />} />
          <Route path="/mais" element={<More name={name} />} />
          <Route path="/perfil" element={<Profile name={name} email={email} />} />
          <Route path="/configuracoes" element={<SettingsLayout />}>
            <Route index element={<Navigate to="categorias" replace />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="contas" element={<AccountsAndCards />} />
            <Route path="cartoes" element={<AccountsAndCards />} />
            <Route path="preferencias" element={<Preferences />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
        <BottomTabs />
        </div>
      </TxFormProvider>
    </ConfirmProvider>
    </ToastProvider>
    </PrefsProvider>
    </ProfileProvider>
  )
}

/** Creates upcoming entries of fixed (recurring) lançamentos as time passes. */
function SeriesUpkeep() {
  useSeriesUpkeep()
  return null
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
