import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { t } from '../../lib/i18n'
import Accounts from './Accounts'
import Cards from './Cards'

export default function AccountsAndCards() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (pathname.endsWith('/cartoes') || hash === '#cartoes') document.getElementById('cartoes')?.scrollIntoView()
  }, [pathname, hash])
  const s = t().settings.accountsAndCards
  return (
    <>
      <header className="page-head">
        <div>
          <h1>{s.title}</h1>
          <p>{s.intro}</p>
        </div>
      </header>
      <section className="card card-pad"><Accounts /></section>
      <section className="card card-pad" id="cartoes"><Cards /></section>
    </>
  )
}
