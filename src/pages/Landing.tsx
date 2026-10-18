import { Bell, Check, CreditCard, Eye, Moon, PiggyBank, Plus, RefreshCw, ShoppingBag, Smartphone, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Mascot } from '../components/Sidebar'
import { LANGUAGES, language, t, type Language } from '../lib/i18n'
import { formatCents, MINUS } from '../lib/money'
import { tone } from '../lib/theme'
import './Landing.css'

// The page signed-out visitors see first: what Tally is, a way into the demo,
// and the doors to sign in or create an account. The sample amounts in the
// illustration are decoration only.

/** The demo is its own app under /demo, so it needs a full page load. */
export const DEMO_URL = '/demo'

const FEATURE_ICONS = [TrendingUp, CreditCard, RefreshCw, PiggyBank, Moon, Smartphone]
const STRIP_TONES = ['var(--yellow)', 'var(--peach)', 'var(--green)', 'var(--blue)', 'var(--lavender)', 'var(--pink)']
const STEP_TONES = ['var(--yellow)', 'var(--pink)', 'var(--green)']

export default function Landing({ onLanguage }: { onLanguage: (lang: Language) => void }) {
  const s = t().landing
  return (
    <div className="landing">
      <header className="lp-wrap lp-header">
        <a href="#topo" className="lp-brand"><Mascot /><span>tally</span></a>
        <nav className="lp-nav" aria-label={s.sections}>
          <a href="#recursos">{s.features}</a>
          <a href="#como">{s.how}</a>
          <a href="#duvidas">{s.faq}</a>
        </nav>
        <div className="lp-actions">
          <LanguageSwitch onChange={onLanguage} />
          <Link className="btn" to="/entrar">{s.signIn}</Link>
          <Link className="btn btn-primary lp-desk" to="/criar-conta">{s.createAccount}</Link>
        </div>
      </header>

      <section id="topo" className="lp-wrap lp-hero">
        <div className="lp-hero-text">
          <span className="lp-badge toned" style={tone('var(--green)')}><Check size={16} /> {s.badge}</span>
          <h1>{s.titleA} <span className="lp-hl toned" style={tone('var(--yellow)')}>{s.titleB}</span></h1>
          <p className="lp-lead">{s.lead}</p>
          <div className="lp-ctas">
            <a className="btn btn-primary lp-big" href={DEMO_URL}><Eye size={20} /> {s.seeDemo}</a>
            <Link className="btn lp-big" to="/criar-conta">{s.createMine}</Link>
          </div>
          <p className="lp-note">{s.demoNote}</p>
        </div>
        <HeroArt />
      </section>

      <div className="lp-strip" aria-hidden="true">
        <div>{s.strip.map((label, i) => <span key={label} className="lp-pill toned" style={tone(STRIP_TONES[i])}>{label}</span>)}</div>
      </div>

      <section id="recursos" className="lp-wrap lp-section">
        <div className="lp-section-head">
          <h2>{s.featuresTitle}</h2>
          <p>{s.featuresLead}</p>
        </div>
        <div className="lp-features">
          {s.featureList.map(([title, text], i) => {
            const Icon = FEATURE_ICONS[i]
            return (
              <div key={title} className={`lp-feature toned f${i + 1}`}>
                <span className="lp-feature-icon"><Icon size={24} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section id="como" className="lp-wrap lp-section">
        <h2 className="lp-center">{s.howTitle}</h2>
        <ol className="lp-steps">
          {s.steps.map(([title, text], i) => (
            <li key={title}>
              <span className="lp-num toned" style={tone(STEP_TONES[i])}>{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-wrap lp-section">
        <div className="lp-demo toned" style={tone('var(--lavender)')}>
          <span className="lp-demo-mascot"><Mascot size={170} /></span>
          <div>
            <h2>{s.demoTitle}</h2>
            <p>{s.demoText}</p>
            <a className="btn btn-primary lp-big" href={DEMO_URL}><Eye size={20} /> {s.seeDemo}</a>
          </div>
        </div>
      </section>

      <section id="duvidas" className="lp-wrap lp-section lp-faq">
        <h2 className="lp-center">{s.faqTitle}</h2>
        {s.faqList.map(([q, a], i) => (
          <details key={q} open={i === 0}>
            <summary>{q}<Plus size={20} className="lp-plus" /></summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-brand small"><Mascot size={32} /><span>tally</span><em>{s.footer}</em></div>
          <nav aria-label={s.sections}>
            <a href={DEMO_URL}>{s.demo}</a>
            <Link to="/entrar">{s.signIn}</Link>
            <Link to="/criar-conta">{s.createAccount}</Link>
          </nav>
        </div>
      </footer>

      <div className="lp-dock">
        <a className="btn btn-primary" href={DEMO_URL}>{s.seeDemo}</a>
        <Link className="btn" to="/criar-conta">{s.createAccount}</Link>
      </div>
    </div>
  )
}

/** PT · EN pill for the screens shown before signing in. */
export function LanguageSwitch({ onChange }: { onChange: (lang: Language) => void }) {
  const current = language()
  return (
    <div className="lp-lang" role="group" aria-label={t().landing.language}>
      {LANGUAGES.map((l) => (
        <button key={l.id} type="button" className={l.id === current ? 'on' : ''} aria-pressed={l.id === current}
          lang={l.id} title={l.name} onClick={() => onChange(l.id)}>
          {l.id === 'en' ? 'EN' : 'PT'}
        </button>
      ))}
    </div>
  )
}

/** The coin mascot waving hello. */
export function WavingMascot({ size = 130 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 72" aria-hidden="true" className="lp-wave">
      <circle cx="34" cy="40" r="26" fill="#F6D98B" stroke="#2B2A33" strokeWidth="3" />
      <path d="M34 14c0-4 4-6 7-5" fill="none" stroke="#2B2A33" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="26" cy="37" rx="6" ry="7" fill="#fff" stroke="#2B2A33" strokeWidth="2.5" />
      <ellipse cx="42" cy="37" rx="6" ry="7" fill="#fff" stroke="#2B2A33" strokeWidth="2.5" />
      <circle cx="28" cy="36" r="3" fill="#2B2A33" />
      <circle cx="44" cy="36" r="3" fill="#2B2A33" />
      <path d="M28 48q6 6 12 0" fill="none" stroke="#2B2A33" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="19" cy="47" r="3.5" fill="#EFB3C3" />
      <circle cx="49" cy="47" r="3.5" fill="#EFB3C3" />
      <path d="M58 36q8-6 10-16" fill="none" stroke="#2B2A33" strokeWidth="3" strokeLinecap="round" />
      <circle cx="69" cy="18" r="5" fill="#F6D98B" stroke="#2B2A33" strokeWidth="2.5" />
    </svg>
  )
}

const plus = (cents: number) => `+${formatCents(cents)}`
const minus = (cents: number) => `${MINUS}${formatCents(cents)}`

/** Tilted sample cards and the mascot: a peek at the app, not real data. */
function HeroArt() {
  const s = t().landing
  return (
    <div className="lp-art" aria-hidden="true">
      <div className="lp-art-blob toned" style={tone('var(--lavender)')} />
      <span className="lp-dot d1 toned" style={tone('var(--rose)')} />
      <span className="lp-dot d2 toned" style={tone('var(--blue)')} />
      <span className="lp-dot d3 toned" style={tone('var(--green)')} />
      <div className="lp-art-balance toned" style={tone('var(--yellow)')}>
        <div className="lp-art-label">{s.balance}</div>
        <div className="money lp-art-amount">R$ {formatCents(1248035)}</div>
        <div className="lp-art-sub">{s.balanceFrom}</div>
        <div className="lp-art-chips">
          <span className="money income">{plus(850000)}</span>
          <span className="money expense">{minus(193240)}</span>
        </div>
      </div>
      <div className="lp-art-list">
        <h3>{s.upcoming}</h3>
        <ArtRow icon={<ShoppingBag size={16} />} color="var(--green)" name={s.groceries} when={s.today} amount={minus(8640)} />
        <ArtRow icon={<CreditCard size={16} />} color="var(--peach)" name={s.invoice} when={s.dueOn} amount={minus(61280)} />
        <ArtRow icon={<TrendingUp size={16} />} color="var(--blue)" name={s.salary} when={s.salaryWhen} amount={plus(850000)} income />
      </div>
      <span className="lp-art-alert toned" style={tone('var(--pink)')}><Bell size={16} /> {s.overdue}</span>
      <div className="lp-art-hello">
        <WavingMascot />
        <div className="lp-bubble">{s.hello}</div>
      </div>
    </div>
  )
}

function ArtRow({ icon, color, name, when, amount, income }: { icon: React.ReactNode; color: string; name: string; when: string; amount: string; income?: boolean }) {
  return (
    <div className="lp-art-row">
      <span className="lp-art-cat toned" style={tone(color)}>{icon}</span>
      <div><b>{name}</b><small>{when}</small></div>
      <span className={`money ${income ? 'income' : 'expense'}`}>{amount}</span>
    </div>
  )
}
