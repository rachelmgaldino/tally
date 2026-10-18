import type { CSSProperties } from 'react'

// Claro / Escuro / Automático. Kept per device (not in the synced prefs), so
// "Automático" can follow each device's own setting. index.html applies it
// before the first paint so there is no white flash at night.

export type Theme = 'light' | 'dark' | 'auto'
const KEY = 'tally-theme'
const GROUND = { light: '#fbf6ec', dark: '#2a2b31' }
const night = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'dark' || t === 'auto' ? t : 'light'
  } catch {
    return 'light'
  }
}

function apply(theme: Theme) {
  const resolved = theme === 'auto' ? (night().matches ? 'dark' : 'light') : theme
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', GROUND[resolved])
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  apply(theme)
}

/** Keeps "Automático" in step when the device switches between day and night. */
export function watchTheme() {
  night().addEventListener('change', () => { if (getTheme() === 'auto') apply('auto') })
}

/** A pastel surface. Light mode paints it as is; dark mode turns it into a tinted card with a pastel edge. */
export const tone = (color: string) => ({ '--tone': color }) as CSSProperties
