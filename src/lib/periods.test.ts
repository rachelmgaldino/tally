import { describe, expect, it } from 'vitest'
import { shiftSpan, spanAt, spanLabel, spanRange } from './periods'

describe('periods', () => {
  it('starts weeks on Sunday', () => {
    const w = spanAt('week', '2026-10-18') // a Sunday
    expect(w.start).toBe('2026-10-18')
    expect(spanAt('week', '2026-10-24').start).toBe('2026-10-18')
    expect(spanRange(w)).toEqual({ from: '2026-10-18', to: '2026-10-25' })
    expect(spanLabel(w)).toBe('18 a 24 de outubro')
    expect(spanLabel(shiftSpan(w, 2))).toBe('1 a 7 de novembro')
    expect(spanLabel(shiftSpan(w, 1))).toBe('25 a 31 de outubro')
    expect(spanLabel(spanAt('week', '2026-09-28'))).toBe('27 de set a 3 de out')
  })

  it('moves days and months', () => {
    expect(spanRange(shiftSpan(spanAt('day', '2026-10-31'), 1))).toEqual({ from: '2026-11-01', to: '2026-11-02' })
    expect(spanLabel(spanAt('day', '2026-10-18'))).toBe('domingo, 18 de outubro')
    const m = shiftSpan(spanAt('month', '2026-12-15'), 1)
    expect(spanRange(m)).toEqual({ from: '2027-01-01', to: '2027-02-01' })
    expect(spanLabel(m)).toBe('janeiro 2027')
  })
})
