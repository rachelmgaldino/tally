// The publishable key is meant to live in the browser; row-level security in
// the database is what keeps the data private. Env vars override for testing.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://pinpcjradfxgwjqsturt.supabase.co'
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_VSnf05QDetRlkkVlTeq5UQ_GgeArPdx'

/** `npm run demo`: in-memory data, no login, for trying the UI locally. */
export const DEMO = import.meta.env.DEV && import.meta.env.VITE_DEMO === '1'
