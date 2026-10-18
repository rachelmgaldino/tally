import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Accounts from './Accounts'
import Cards from './Cards'

export default function AccountsAndCards() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (pathname.endsWith('/cartoes') || hash === '#cartoes') document.getElementById('cartoes')?.scrollIntoView()
  }, [pathname, hash])
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Contas e cartões</h1>
          <p>Onde o seu dinheiro mora e os cartões que você usa.</p>
        </div>
      </header>
      <section className="card card-pad"><Accounts /></section>
      <section className="card card-pad" id="cartoes"><Cards /></section>
    </>
  )
}
