# Tally

A personal finance web app modelled on Organizze: accounts, categories and transactions (lançamentos), with recurring and instalment entries, tags and attachments. Credit cards and a phone version come in later steps.

Built with React, TypeScript and Vite. Data lives in Supabase (Postgres + login), and the site is hosted on Vercel.

## One-time Supabase setup

1. **Create the tables.** Supabase → SQL Editor → New query. Paste the contents of `supabase/migrations/0001_init.sql` and click Run. Then do the same, in order, for every later file in that folder (`0002_…`, …).
2. **Create your login.** Authentication → Users → Add user → Create new user. Enter your e-mail and a password, and tick "Auto Confirm User".
3. **Turn off sign-ups**, so nobody else can register: Authentication → Sign In / Providers → turn off "Allow new users to sign up".

The publishable key in `src/lib/config.ts` is meant to be public. Row-level security in the database is what keeps every row readable only by its owner.

## Development

```sh
npm install
npm run dev     # real Supabase, needs your login
npm run demo    # sample data kept in the browser, no login
npm test
npm run build
```

Database changes ship as numbered files in `supabase/migrations/`. Run each new one once in the SQL Editor.

## On the phone

Below 760px wide Tally switches to its phone layout: a bottom tab bar (Início, Lançamentos, +, Faturas, Mais) and forms that slide up from the bottom. To install it on an iPhone, open the site in Safari, tap Share, then "Adicionar à Tela de Início". It then opens full screen with the coin icon. `public/sw.js` keeps the app shell so it opens without signal; money data always comes from Supabase.
