import { AlarmClock, Pause, Play, Check, X, RotateCcw } from 'lucide-react'
import { timerDefs, remainingMs, formatTime } from './domain'
import type { Session, Action } from './domain'
type Props = { session: Session; now: number; act: (action: Action) => void; confirm: (title: string, detail: string, action: () => void) => void }
export default function TimerRail({ session, now, act, confirm }: Props) {
  const active = session.timers.filter(t => t.status === 'running' || t.status === 'paused').length
  return <aside className="timer-rail" aria-label="Recipe timers">
    <div className="rail-heading"><h2><AlarmClock size={22} /> On the go</h2><span>{active} active</span></div>
    <p className="rail-note">Your timers stay here as you cook.</p>
    <div className="timer-list">{timerDefs.map(def => {
      const timer = session.timers.find(t => t.id === def.id)
      const status = timer?.status ?? 'ready'
      const finished = timer?.status === 'finished'
      const alarming = finished && !timer.acknowledged
      return <section key={def.id} className={`timer timer-${status} ${alarming ? 'attention' : ''}`} aria-label={`${def.label} timer`}>
        <div className="timer-top"><h3>{def.label}</h3><span className="timer-state">{finished ? timer.acknowledged ? 'Checked' : 'Needs attention' : status === 'ready' ? `${def.durationMs / 60000} min` : status}</span></div>
        <div className="timer-time">{timer ? formatTime(Math.min(def.durationMs, remainingMs(timer, now))) : <span className="timer-idle">Not started</span>}</div>
        {finished && <p className="overdue">Finished {formatTime(now - timer.deadline)} ago · check your food</p>}
        <div className="timer-actions">
          {!timer && <button onClick={() => act({ type: 'startTimer', id: def.id })}><Play size={17} /> Start {def.label}</button>}
          {timer?.status === 'running' && <button onClick={() => act({ type: 'pauseTimer', id: def.id })} aria-label={`Pause ${def.label}`}><Pause size={17} /> Pause</button>}
          {timer?.status === 'paused' && <button onClick={() => act({ type: 'resumeTimer', id: def.id })} aria-label={`Resume ${def.label}`}><Play size={17} /> Resume</button>}
          {alarming && <button className="ack" onClick={() => act({ type: 'ackTimer', id: def.id })}><Check size={17} /> Silence {def.label}</button>}
          {(timer?.status === 'cancelled' || (finished && timer.acknowledged)) && <button onClick={() => confirm(`Restart ${def.label}?`, `Start a fresh ${def.durationMs / 60000}-minute timer.`, () => act({ type: 'restartTimer', id: def.id }))}><RotateCcw size={17} /> Restart</button>}
          {(timer?.status === 'running' || timer?.status === 'paused') && <button className="icon-button" aria-label={`Cancel ${def.label}`} onClick={() => confirm(`Cancel ${def.label}?`, 'This timer will stop. Your other timers will keep their progress.', () => act({ type: 'cancelTimer', id: def.id }))}><X size={18} /></button>}
        </div>
      </section>
    })}</div>
    <p className="timer-footnote">Keep this page open. Alarms may not sound when your device is locked.</p>
  </aside>
}
