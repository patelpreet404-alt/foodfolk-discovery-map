export const recipe = {
  id: 'lemon-chickpea-couscous', version: 1, title: 'Lemon chickpea couscous', baseServings: 2,
  ingredients: [
    { id: 'couscous', name: 'Couscous', amount: 150, unit: 'g' },
    { id: 'water', name: 'Boiling water', amount: 180, unit: 'ml' },
    { id: 'chickpeas', name: 'Drained chickpeas', amount: 240, unit: 'g' },
    { id: 'almonds', name: 'Flaked almonds', amount: 30, unit: 'g' },
    { id: 'oil', name: 'Olive oil', amount: 3, unit: 'tbsp' },
    { id: 'lemon', name: 'Lemon', amount: 1, unit: '' },
    { id: 'parsley', name: 'Chopped parsley', amount: 2, unit: 'tbsp' },
    { id: 'salt', name: 'Salt and pepper', amount: 'to taste', unit: '' },
  ],
  steps: [
    { id: 'prep', title: 'Get everything ready', instruction: 'Drain the chickpeas. Chop the parsley and halve the lemon. Put the couscous in a heatproof bowl.', detail: 'Place your screen safely away from water and heat. This is an authored demonstration recipe, not a kitchen-tested recipe.', ingredients: [{ id: 'chickpeas', amount: 240 }, { id: 'parsley', amount: 2 }, { id: 'lemon', amount: 1 }] },
    { id: 'soak', title: 'Cover the couscous', instruction: 'Pour boiling water over the couscous. Cover the bowl and start the Couscous timer.', detail: 'Leave it covered while you prepare the chickpeas.', ingredients: [{ id: 'couscous', amount: 150 }, { id: 'water', amount: 180 }], timerId: 'couscous' },
    { id: 'warm', title: 'Warm the chickpeas', instruction: 'Heat olive oil in a pan over medium heat. Add the drained chickpeas and stir occasionally. Start the Chickpeas timer.', ingredients: [{ id: 'oil', amount: 1 }, { id: 'chickpeas', amount: 240 }], timerId: 'chickpeas' },
    { id: 'toast', title: 'Toast the almonds', instruction: 'Put the almonds in a separate dry pan over medium-low heat. Start the Almonds timer and stir often.', detail: 'Watch for a light golden colour. Remove sooner if needed; the timer is a reminder, not a doneness check.', ingredients: [{ id: 'almonds', amount: 30 }], timerId: 'almonds' },
    { id: 'dress', title: 'Mix the lemon dressing', instruction: 'Squeeze the lemon into a small bowl. Stir in olive oil, salt and pepper.', ingredients: [{ id: 'lemon', amount: 1 }, { id: 'oil', amount: 2 }, { id: 'salt', amount: 'to taste' }] },
    { id: 'combine', title: 'Fluff and bring together', instruction: 'When the couscous has absorbed the water, fluff it with a fork. Fold in the warm chickpeas, lemon dressing and parsley.', detail: 'Check the texture and warmth before combining. Keep any unfinished timers visible.', ingredients: [{ id: 'parsley', amount: 2 }] },
    { id: 'serve', title: 'Finish and serve', instruction: 'Scatter the toasted almonds over the couscous. Taste and adjust the seasoning, then divide between bowls.', ingredients: [{ id: 'salt', amount: 'to taste' }] },
  ],
}
export const timerDefs = [
  { id: 'couscous', label: 'Couscous', durationMs: 300_000, stepIndex: 1 },
  { id: 'chickpeas', label: 'Chickpeas', durationMs: 360_000, stepIndex: 2 },
  { id: 'almonds', label: 'Almonds', durationMs: 120_000, stepIndex: 3 },
]
export type Timer = { id: string } & ({ status: 'running'; deadline: number } | { status: 'paused'; remaining: number } | { status: 'finished'; deadline: number; acknowledged: boolean } | { status: 'cancelled' })
export type Session = { version: 1; recipeVersion: 1; phase: 'overview' | 'setup' | 'cooking' | 'complete'; servings: number; step: number; timers: Timer[]; sound: boolean; savedAt: number }
export type Action = { type: 'setServings'; servings: number } | { type: 'phase'; phase: Session['phase'] } | { type: 'next' | 'previous' | 'tick' } | { type: 'goStep'; step: number } | { type: 'setSound'; sound: boolean } | { type: 'startTimer' | 'pauseTimer' | 'resumeTimer' | 'ackTimer' | 'cancelTimer' | 'restartTimer'; id: string }
export const initialSession = (): Session => ({ version: 1, recipeVersion: 1, phase: 'overview', servings: 2, step: 0, timers: [], sound: false, savedAt: Date.now() })
export const remainingMs = (timer: Timer, now: number): number => timer.status === 'running' ? Math.max(0, timer.deadline - now) : timer.status === 'paused' ? timer.remaining : 0
export const formatTime = (ms: number): string => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
export function quantity(amount: number | string, unit: string, servings: number): string {
  if (typeof amount === 'string') return amount
  const n = amount * servings / recipe.baseServings
  const whole = Math.floor(n), fraction = n - whole
  const fractions: [number, string][] = [[0.25, '¼'], [0.5, '½'], [0.75, '¾']]
  const match = fractions.find(([value]) => Math.abs(value - fraction) < 0.001)
  const display = match ? `${whole || ''}${match[1]}` : Number(n.toFixed(2)).toString()
  return `${display}${unit ? ` ${unit}` : ''}`
}
export function transition(state: Session, action: Action, now: number): Session {
  let next: Session = { ...state, savedAt: now, timers: state.timers.map(timer => timer.status === 'running' && timer.deadline <= now ? { id: timer.id, status: 'finished', deadline: timer.deadline, acknowledged: false } : timer) }
  if (action.type === 'setServings' && (state.phase === 'overview' || state.phase === 'setup') && Number.isInteger(action.servings) && action.servings >= 1 && action.servings <= 8) next.servings = action.servings
  if (action.type === 'setSound') next.sound = action.sound
  if (action.type === 'phase') {
    const allowed: Record<Session['phase'], Session['phase'][]> = { overview: ['setup'], setup: ['overview', 'cooking'], cooking: ['complete'], complete: ['cooking'] }
    if (allowed[state.phase].includes(action.phase)) next.phase = action.phase
  }
  if (state.phase === 'cooking') {
    if (action.type === 'next') { if (state.step === recipe.steps.length - 1) next.phase = 'complete'; else next.step++ }
    if (action.type === 'previous') next.step = Math.max(0, state.step - 1)
    if (action.type === 'goStep' && Number.isInteger(action.step) && action.step >= 0 && action.step < recipe.steps.length) next.step = action.step
  }
  if ('id' in action && (state.phase === 'cooking' || state.phase === 'complete')) {
    const def = timerDefs.find(item => item.id === action.id)
    if (!def) return next
    const timer = next.timers.find(item => item.id === action.id)
    let replacement: Timer | undefined
    if (action.type === 'startTimer' && !timer) replacement = { id: def.id, status: 'running', deadline: now + def.durationMs }
    if (action.type === 'restartTimer') replacement = { id: def.id, status: 'running', deadline: now + def.durationMs }
    if (action.type === 'pauseTimer' && timer?.status === 'running') replacement = { id: def.id, status: 'paused', remaining: remainingMs(timer, now) }
    if (action.type === 'resumeTimer' && timer?.status === 'paused') replacement = { id: def.id, status: 'running', deadline: now + timer.remaining }
    if (action.type === 'ackTimer' && timer?.status === 'finished') replacement = { ...timer, acknowledged: true }
    if (action.type === 'cancelTimer' && timer) replacement = { id: def.id, status: 'cancelled' }
    if (replacement) next = { ...next, timers: timer ? next.timers.map(item => item.id === def.id ? replacement! : item) : [...next.timers, replacement] }
  }
  return next
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const exactKeys = (value: Record<string, unknown>, keys: string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
export function restoreSession(raw: string | null, now: number): { session: Session | null; error: string | null } {
  if (raw === null) return { session: null, error: null }
  try {
    const value: unknown = JSON.parse(raw)
    if (!record(value) || !exactKeys(value, ['version', 'recipeVersion', 'phase', 'servings', 'step', 'timers', 'sound', 'savedAt']) || value.version !== 1 || value.recipeVersion !== 1 || !['overview', 'setup', 'cooking', 'complete'].includes(String(value.phase)) || !Number.isInteger(value.servings) || Number(value.servings) < 1 || Number(value.servings) > 8 || !Number.isInteger(value.step) || Number(value.step) < 0 || Number(value.step) >= recipe.steps.length || typeof value.sound !== 'boolean' || !finite(value.savedAt) || !Array.isArray(value.timers) || value.timers.length > 3) throw Error()
    const ids = new Set<string>()
    for (const t of value.timers) {
      if (!record(t) || typeof t.id !== 'string' || ids.has(t.id)) throw Error()
      const def = timerDefs.find(item => item.id === t.id)
      if (!def) throw Error()
      ids.add(t.id)
      if (t.status === 'running' && exactKeys(t, ['id', 'status', 'deadline']) && finite(t.deadline)) continue
      if (t.status === 'paused' && exactKeys(t, ['id', 'status', 'remaining']) && finite(t.remaining) && t.remaining <= def.durationMs) continue
      if (t.status === 'finished' && exactKeys(t, ['id', 'status', 'deadline', 'acknowledged']) && finite(t.deadline) && typeof t.acknowledged === 'boolean') continue
      if (t.status === 'cancelled' && exactKeys(t, ['id', 'status'])) continue
      throw Error()
    }
    if ((value.phase === 'overview' || value.phase === 'setup') && value.timers.length) throw Error()
    return { session: transition(value as Session, { type: 'tick' }, now), error: null }
  } catch { return { session: null, error: 'Saved progress could not be read. Start a fresh recipe.' } }
}
export type Command = { type: 'next' | 'previous' | 'repeat' | 'stopListening' | 'unknown' | 'ignore' } | { type: 'timer'; operation: 'start' | 'pause' | 'resume' | 'silence' | 'remaining'; name: string } | { type: 'quantity'; name: string }
export function parseCommand(text: string): Command {
  const normalized = text.toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!/^cook\b/.test(normalized)) return { type: 'ignore' }
  const command = normalized.replace(/^cook\s*/, '')
  if (/^(next|next step)$/.test(command)) return { type: 'next' }
  if (/^(previous|previous step|back|go back)$/.test(command)) return { type: 'previous' }
  if (/^(repeat|repeat step)$/.test(command)) return { type: 'repeat' }
  if (command === 'stop listening') return { type: 'stopListening' }
  const timer = /^(start|pause|resume|silence) (couscous|chickpeas|almonds)(?: timer)?$/.exec(command)
  if (timer) return { type: 'timer', operation: timer[1] as 'start' | 'pause' | 'resume' | 'silence', name: timer[2] }
  const remaining = /^how long (?:on|is left on) (couscous|chickpeas|almonds)(?: timer)?$/.exec(command)
  if (remaining) return { type: 'timer', operation: 'remaining', name: remaining[1] }
  const ingredient = /^how much (.+)$/.exec(command)
  if (ingredient) return { type: 'quantity', name: ingredient[1] }
  return { type: 'unknown' }
}
