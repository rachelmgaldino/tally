// The publishable key is meant to live in the browser; row-level security in
// the database is what keeps the data private. Env vars override for testing.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://pinpcjradfxgwjqsturt.supabase.co'
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_VSnf05QDetRlkkVlTeq5UQ_GgeArPdx'

/** Any page under /demo on the live site opens the demo, for showing Tally to friends. */
const demoPath = typeof window !== 'undefined' && /^\/demo(\/|$)/.test(window.location.pathname)
/** Where the app's routes start: /demo for the shared demo, the site root otherwise. */
export const BASENAME = demoPath ? '/demo' : undefined

/** Sample data kept in the browser, no login: `npm run demo` locally, or /demo. */
export const DEMO = (import.meta.env.DEV && import.meta.env.VITE_DEMO === '1') || demoPath
