import { describe, expect, it } from 'vitest'
import { initialSession, parseCommand, quantity, recipe, remainingMs, restoreSession, timerDefs, transition, type Session } from './domain'

const cooking = (): Session => ({ ...initialSession(), phase: 'cooking', savedAt: 1000 })
describe('servings and quantities', () => {
  it('scales original portions without compounding or changing cooking times', () => {
    let session = transition(initialSession(), { type: 'setServings', servings: 4 }, 1000)
    expect(quantity(150, 'g', session.servings)).toBe('300 g')
    session = transition(session, { type: 'setServings', servings: 3 }, 1000)
    expect(quantity(150, 'g', session.servings)).toBe('225 g')
    expect(quantity(1, 'tbsp', 3)).toBe('1½ tbsp')
    expect(quantity('to taste', '', 8)).toBe('to taste')
    expect(recipe.steps[2].ingredients.find(i => i.id === 'oil')?.amount).toBe(1)
    expect(recipe.steps[4].ingredients.find(i => i.id === 'oil')?.amount).toBe(2)
    expect(timerDefs[0].durationMs).toBe(300000)
  })
  it('freezes servings during cooking and completion; rejects invalid values', () => {
    for (const phase of ['cooking', 'complete'] as const) expect(transition({ ...cooking(), phase }, { type: 'setServings', servings: 8 }, 1000).servings).toBe(2)
    for (const servings of [0, 9, 1.5, NaN]) expect(transition(initialSession(), { type: 'setServings', servings }, 1000).servings).toBe(2)
  })
})
describe('independent deadline timers', () => {
  it('prevents duplicate starts and survives navigation and recipe completion', () => {
    let session = transition(cooking(), { type: 'startTimer', id: 'couscous' }, 1000)
    session = transition(session, { type: 'startTimer', id: 'couscous' }, 2000)
    expect(session.timers).toHaveLength(1)
    expect(remainingMs(session.timers[0], 2000)).toBe(299000)
    session = transition(session, { type: 'next' }, 3000)
    expect(session.timers[0]).toEqual({ id: 'couscous', status: 'running', deadline: 301000 })
    session = transition({ ...session, step: 6 }, { type: 'next' }, 4000)
    expect(session.phase).toBe('complete')
    expect(session.timers[0].status).toBe('running')
  })
  it('pauses remaining duration and resumes with a new deadline', () => {
    let session = transition(cooking(), { type: 'startTimer', id: 'almonds' }, 1000)
    session = transition(session, { type: 'pauseTimer', id: 'almonds' }, 11000)
    expect(session.timers[0]).toEqual({ id: 'almonds', status: 'paused', remaining: 110000 })
    session = transition(session, { type: 'resumeTimer', id: 'almonds' }, 500000)
    expect(session.timers[0]).toEqual({ id: 'almonds', status: 'running', deadline: 610000 })
  })
  it('reconciles simultaneous overdue timers separately and acknowledges only one', () => {
    let session = cooking()
    for (const def of timerDefs) session = transition(session, { type: 'startTimer', id: def.id }, 1000)
    const restored = restoreSession(JSON.stringify(session), 400000).session!
    expect(restored.timers.every(t => t.status === 'finished')).toBe(true)
    const acknowledged = transition(restored, { type: 'ackTimer', id: 'almonds' }, 400000)
    expect(acknowledged.timers.filter(t => t.status === 'finished' && !t.acknowledged)).toHaveLength(2)
  })
  it('does not turn an overdue timer into a paused zero or restart cancelled timers implicitly', () => {
    let session = transition(cooking(), { type: 'startTimer', id: 'almonds' }, 1000)
    session = transition(session, { type: 'pauseTimer', id: 'almonds' }, 121000)
    expect(session.timers[0].status).toBe('finished')
    session = transition(session, { type: 'cancelTimer', id: 'almonds' }, 122000)
    session = transition(session, { type: 'startTimer', id: 'almonds' }, 123000)
    expect(session.timers[0].status).toBe('cancelled')
    session = transition(session, { type: 'restartTimer', id: 'almonds' }, 123000)
    expect(remainingMs(session.timers[0], 123000)).toBe(120000)
  })
})
describe('persisted session validation', () => {
  it('distinguishes missing progress from unreadable progress', () => {
    expect(restoreSession(null, 1000)).toEqual({ session: null, error: null })
    expect(restoreSession('{', 1000).error).toBeTruthy()
  })
  it('rejects invalid fields, duplicate or unknown timers, and malformed timer states', () => {
    const good = cooking()
    const invalid = [
      { ...good, version: 2 }, { ...good, recipeVersion: 2 }, { ...good, phase: 'bogus' },
      { ...good, servings: 0 }, { ...good, step: 7 }, { ...good, sound: 'yes' }, { ...good, savedAt: -1 },
      { ...good, timers: [{ id: 'mystery', status: 'cancelled' }] },
      { ...good, timers: [{ id: 'almonds', status: 'running', deadline: '100' }] },
      { ...good, timers: [{ id: 'almonds', status: 'paused', remaining: 120001 }] },
      { ...good, timers: [{ id: 'almonds', status: 'finished', deadline: 1 }] },
      { ...good, timers: [{ id: 'almonds', status: 'cancelled' }, { id: 'almonds', status: 'cancelled' }] },
      { ...good, phase: 'setup', timers: [{ id: 'almonds', status: 'cancelled' }] },
    ]
    for (const value of invalid) expect(restoreSession(JSON.stringify(value), 1000).session).toBeNull()
  })
  it('rejects mixed timer discriminants and unversioned extra persisted fields', () => {
    const session = cooking()
    const invalidTimers = [
      { id: 'almonds', status: 'cancelled', deadline: 1000 },
      { id: 'almonds', status: 'running', deadline: 1000, remaining: -1 },
      { id: 'almonds', status: 'paused', remaining: 1000, acknowledged: false },
      { id: 'almonds', status: 'finished', deadline: 1000, acknowledged: false, remaining: 1000 },
    ]
    for (const timer of invalidTimers) expect(restoreSession(JSON.stringify({ ...session, timers: [timer] }), 1000).session).toBeNull()
    expect(restoreSession(JSON.stringify({ ...session, alternateServings: 8 }), 1000).session).toBeNull()
  })
})
describe('bounded speech parser', () => {
  it('requires Cook and accepts only one bounded command per utterance', () => {
    expect(parseCommand('next step')).toEqual({ type: 'ignore' })
    expect(parseCommand('Cook, next step!')).toEqual({ type: 'next' })
    expect(parseCommand('Cook next step next step')).toEqual({ type: 'unknown' })
    expect(parseCommand('Cookbook next')).toEqual({ type: 'ignore' })
    expect(parseCommand('Cook stop listening')).toEqual({ type: 'stopListening' })
  })
  it('requires a named timer and keeps unknown quantities for honest UI recovery', () => {
    expect(parseCommand('Cook pause timer')).toEqual({ type: 'unknown' })
    expect(parseCommand('Cook start almonds timer')).toEqual({ type: 'timer', operation: 'start', name: 'almonds' })
    expect(parseCommand('Cook how long on couscous')).toEqual({ type: 'timer', operation: 'remaining', name: 'couscous' })
    expect(parseCommand('Cook how much flour')).toEqual({ type: 'quantity', name: 'flour' })
  })
})
