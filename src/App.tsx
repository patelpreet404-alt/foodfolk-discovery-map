import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, ChefHat, ChevronLeft, LockKeyhole, Mic, MicOff, Monitor, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import { initialSession, parseCommand, quantity, recipe, restoreSession, timerDefs, transition, remainingMs, formatTime } from './domain'
import type { Action, Session } from './domain'
import { SpeechController } from './platform/speech'
import type { VoiceState } from './platform/speech'
import { playChime } from './platform/audio'
import TimerRail from './TimerRail'
import RecipeOverview from './RecipeOverview'
import CaseStudy from './CaseStudy'
import FoodMap from './foodmap/FoodMap'
import './App.css'
const STORAGE = 'cook-along-session-v1'
function load() {
  try { return restoreSession(localStorage.getItem(STORAGE), Date.now()) }
  catch { return { session: null, error: 'This browser cannot save progress. Keep this page open while cooking.' } }
}
function Overlay({children, label, onClose, className}:{children:ReactNode;label:string;onClose:()=>void;className:string}) {
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{ref.current?.showModal()},[])
  return <dialog ref={ref} className={className} aria-labelledby={label} onCancel={onClose}>{children}</dialog>
}
type Confirmation = { label: string; title: string; detail: string; action: () => void }
export default function App() {
  const [loaded] = useState(load)
  const [session, setSession] = useState<Session>(loaded.session ?? initialSession)
  const [resume, setResume] = useState(Boolean(loaded.session && ['cooking','complete'].includes(loaded.session.phase)))
  const [storageError, setStorageError] = useState(loaded.error)
  const [now, setNow] = useState(Date.now)
  const [feedback, setFeedback] = useState('Everything you need, one step at a time.')
  const [heard, setHeard] = useState('')
  const [voice, setVoice] = useState<{state:VoiceState;message:string}>({state:'off',message:'Voice is off.'})
  const [help, setHelp] = useState(false)
  const [consent, setConsent] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [wakeStatus, setWakeStatus] = useState('Screen wake off')
  const [undoStep, setUndoStep] = useState<number | null>(null)
  const [audioMessage, setAudioMessage] = useState('Sound is optional. Test it before cooking.')
  const speech = useRef<SpeechController | null>(null)
  const current = useRef(session)
  useLayoutEffect(()=>{current.current=session},[session])
  const commandRef = useRef<(text:string)=>void>(()=>{})
  const blocked = useRef(false)
  useLayoutEffect(()=>{blocked.current=Boolean(confirmation || resume || consent || help)},[confirmation,resume,consent,help])
  const lastNav = useRef(0)
  const modal = useRef<HTMLDialogElement>(null)
  const wake = useRef<WakeLockSentinel | null>(null)
  useEffect(() => { window.scrollTo({ top: 0 }) }, [session.phase, resume])
  const caseStudy = window.location.pathname.replace(/\/$/,'') === '/case-study'
  const foodMap = window.location.pathname.replace(/\/$/,'') === '/food-map'
  const act = useCallback((action: Action) => {
    setSession(s => transition(s, action, Date.now()))
    if (['next', 'previous', 'goStep'].includes(action.type)) window.scrollTo({ top: 0 })
    if ('id' in action) {
      const label = timerDefs.find(t=>t.id===action.id)?.label
      const verb: Record<string,string> = {startTimer:'started',pauseTimer:'paused',resumeTimer:'resumed',ackTimer:'silenced',cancelTimer:'cancelled',restartTimer:'restarted'}
      const existing = current.current.timers.find(t=>t.id===action.id)
      const expired = existing?.status==='running' && existing.deadline<=Date.now()
      setFeedback(action.type==='pauseTimer' && expired ? `${label} timer just finished. Check your food.` : action.type==='startTimer' && existing ? `${label} timer is already ${existing.status}.` : `${label} timer ${verb[action.type] ?? 'updated'}.`)
    }
  }, [])
  const navigate = useCallback((direction:'next'|'previous') => {
    if (blocked.current || Date.now()-lastNav.current<650 || current.current.phase!=='cooking') return
    lastNav.current=Date.now(); setUndoStep(current.current.step)
    const target=direction==='next'?Math.min(recipe.steps.length-1,current.current.step+1):Math.max(0,current.current.step-1)
    setFeedback(direction==='next' && current.current.step===recipe.steps.length-1?'Instructions complete. Your timers are still here.':`Step ${target+1}: ${recipe.steps[target].title}.`)
    act({type:direction})
  },[act])
  const repeat = useCallback(() => {
    const s=current.current, step=recipe.steps[s.step]
    const amounts=step.ingredients.map(portion=> { const item=recipe.ingredients.find(i=>i.id===portion.id)!; return `${quantity(portion.amount,item.unit,s.servings)} ${item.name}` }).join(', ')
    setFeedback(`Reading step ${s.step+1}: ${step.title}.`)
    speech.current?.speak(`${step.title}. ${step.instruction} ${amounts ? `For this step: ${amounts}.`:''}`)
  },[])
  useLayoutEffect(()=>{commandRef.current=(text)=> {
    const cmd=parseCommand(text)
    if(cmd.type==='ignore') return
    setHeard(text)
    if(cmd.type==='stopListening'){ speech.current?.disable(); return }
    if(blocked.current){setFeedback('Close the open panel before giving a cooking command.');return}
    if(session.phase!=='cooking' && session.phase!=='complete'){setFeedback('Voice is ready. Begin cooking to use recipe commands.');return}
    if(cmd.type==='next'||cmd.type==='previous'){navigate(cmd.type);return}
    if(cmd.type==='repeat'){repeat();return}
    if(cmd.type==='timer'){
      const timer=session.timers.find(t=>t.id===cmd.name)
      if(cmd.operation==='remaining'){
        const message=timer?`${cmd.name}: ${timer.status}, ${formatTime(remainingMs(timer,Date.now()))} remaining.`:`${cmd.name} timer has not started.`
        setFeedback(message);speech.current?.speak(message);return
      }
      const types={start:'startTimer',pause:'pauseTimer',resume:'resumeTimer',silence:'ackTimer'} as const
      const valid=cmd.operation==='start'||(cmd.operation==='pause'&&timer?.status==='running')||(cmd.operation==='resume'&&timer?.status==='paused')||(cmd.operation==='silence'&&timer?.status==='finished')
      if(valid)act({type:types[cmd.operation],id:cmd.name});else setFeedback(`${cmd.name} timer is ${timer?.status??'not started'}; nothing changed.`)
      return
    }
    if(cmd.type==='quantity'){
      const ingredient=recipe.ingredients.find(i=> i.name.toLowerCase()===cmd.name||i.id===cmd.name)
      const portion=recipe.steps[session.step].ingredients.find(p=>p.id===ingredient?.id)
      const message=ingredient&&portion?`${quantity(portion.amount,ingredient.unit,session.servings)} ${ingredient.name} for this step, for ${session.servings} servings.`:'That ingredient is not listed for this step. Check the quantities on screen.'
      setFeedback(message); speech.current?.speak(message);return
    }
    setFeedback('Nothing changed. Try “Cook, next step” or name a timer: “Cook, pause Couscous timer”.')
  }},[session,navigate,repeat,act])
  useEffect(()=> {
    if(caseStudy)return
    const controller=new SpeechController({onState:(state,message)=>setVoice({state,message}),onCommand:text=>commandRef.current(text)})
    speech.current=controller
    return()=>{controller.dispose();speech.current=null}
  },[caseStudy])
  useEffect(()=> {
    if(caseStudy)return
    const tick=()=>{setNow(Date.now());setSession(s=>s.timers.some(t=>t.status==='running'&&t.deadline<=Date.now())?transition(s,{type:'tick'},Date.now()):s)}
    const interval=setInterval(tick,500); document.addEventListener('visibilitychange',tick)
    return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',tick)}
  },[caseStudy])
  useEffect(()=> {
    if(caseStudy)return
    try{localStorage.setItem(STORAGE,JSON.stringify(session))}catch{queueMicrotask(()=>setStorageError('Progress cannot be saved in this browser. Keep this page open; refresh may lose this session.'))}
  },[session,caseStudy])
  const due=session.timers.filter(t=>t.status==='finished'&&!t.acknowledged).map(t=>t.id).join(',')
  useEffect(()=> {
    if(!due||caseStudy)return
    queueMicrotask(()=>setFeedback(`${due.split(',').map(id=>timerDefs.find(t=>t.id===id)!.label).join(' and ')} finished. Check your food and silence each timer separately.`))
    if(!session.sound)return
    const ring=()=>{void playChime().catch(()=>setAudioMessage('Sound could not play. Use the visible timer alerts; test sound again.'))}
    ring();const id=setInterval(ring,12000);return()=>clearInterval(id)
  },[due,session.sound,caseStudy])
  useEffect(()=> {
    const listener=(e:KeyboardEvent)=>{
      if(caseStudy||blocked.current||session.phase!=='cooking'||e.altKey||e.ctrlKey||e.metaKey||e.repeat)return
      if((e.target as HTMLElement).closest('input,textarea,select,button,a,summary,[contenteditable]'))return
      if(e.key==='ArrowRight'){e.preventDefault();navigate('next')}
      if(e.key==='ArrowLeft'){e.preventDefault();navigate('previous')}
      if(e.key.toLowerCase()==='r'){e.preventDefault();repeat()}
    };window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener)
  },[navigate,repeat,session.phase,caseStudy])
  useEffect(()=>{
    if(confirmation){speech.current?.disable();modal.current?.showModal()}
    else modal.current?.close()
  },[confirmation])
  useEffect(()=>()=>{void wake.current?.release()},[])
  const confirm=(title:string,detail:string,action:()=>void)=>setConfirmation({title,detail,action,label:title.startsWith('Start a new')?'Start new session':title.replace(/\?$/,'')})
  const reset=()=>confirm('Start a new cooking session?', 'This clears your saved step and all timers. You can then choose servings again.',()=>{
    speech.current?.disable();void wake.current?.release();setSession(initialSession());setResume(false);setUndoStep(null);setFeedback('A fresh recipe, ready when you are.')
  })
  const testSound=async()=>{
    try{await playChime();act({type:'setSound',sound:true});setAudioMessage('Test sound played. Timer sound is on; check your device volume.')}
    catch{setAudioMessage('Sound is blocked or unavailable. Check browser audio settings and try again.');act({type:'setSound',sound:false})}
  }
  const toggleWake=async()=>{
    if(wake.current){await wake.current.release();wake.current=null;setWakeStatus('Screen wake off');return}
    if(!('wakeLock' in navigator)){setWakeStatus('Screen wake unavailable — adjust device sleep settings');return}
    try{wake.current=await navigator.wakeLock.request('screen');setWakeStatus('Screen staying awake');wake.current.addEventListener('release',()=>{wake.current=null;setWakeStatus('Screen wake released — tap to enable again')})}
    catch{setWakeStatus('Screen wake unavailable — keep your screen on manually')}
  }
  const enableVoice=()=>{setConsent(false);speech.current?.enable()}
  const voiceActive=['listening','requesting','processing','speaking'].includes(voice.state)
  const voiceButton=()=>voiceActive?speech.current?.disable():setConsent(true)
  const step=recipe.steps[session.step]
  const showCook=['cooking','complete'].includes(session.phase)
  if(caseStudy)return <CaseStudy/>
  if(foodMap)return <FoodMap/>
  return <div className={`app ${showCook?'in-cooking':''}`}>
    <a className="skip-link" href="#main">Skip to cooking content</a>
    <header className="site-header"><a className="brand" href="/" aria-label="Cook Along home"><ChefHat size={26}/><span>cook along<span className="brand-dot">.</span></span></a><div className="header-right"><nav className="header-nav" aria-label="Primary"><a href="/" className={session.phase==='overview'?'is-current':''}>Recipe</a><a href="/food-map" className={foodMap?'is-current':''}>Food Map</a><a href="/case-study" className={caseStudy?'is-current':''} onClick={()=>speech.current?.disable()}>Story</a><a href="/case-study#validation">Evidence</a></nav><span className="mode-label">MESSY HANDS COOKING MODE</span><a href="/case-study" onClick={()=>speech.current?.disable()}><BookOpen size={18}/> Design story</a></div></header>
    {storageError&&<div className="notice" role="status">{storageError}</div>}
    {resume?<main id="main" className="resume-screen"><div className="resume-copy"><RotateCcw size={38}/><h1>Right where you left off.</h1><p>{recipe.title} · {session.servings} servings</p><p>Step {session.step+1} of {recipe.steps.length}: {step.title}. Your timers have kept their deadlines. Microphone is off.</p><button className="primary" onClick={()=>{setResume(false);setFeedback('Session restored. Enable voice again if you want to use it.')}}>Resume cooking <ArrowRight/></button><button className="text-button" onClick={reset}>Discard session and start over</button></div><TimerRail session={session} now={now} act={act} confirm={confirm}/></main>:
    session.phase==='overview'?<RecipeOverview session={session} act={act}/>:session.phase==='setup'?<main id="main" className="setup"><button className="text-button" onClick={()=>{speech.current?.disable();act({type:'phase',phase:'overview'})}}><ChevronLeft size={18}/> Back to recipe</button><p className="editorial-label">BEFORE THE GOOD STUFF</p><h1>Ready. Set.<br/>Let’s cook.</h1><p className="lede">Set up while your hands are clean. Everything here is optional.</p><div className="setup-layout"><section className="setup-options"><div className="setup-row"><div><h2><Mic/> A little help from your voice</h2><p>Say “Cook, next step” in English. Your browser may send audio to its speech service. We don’t save recordings or transcripts.</p><p className="voice-message" role="status">{voice.message}</p></div><button disabled={voice.state==='unsupported'} onClick={voiceButton}>{voiceActive?'Turn voice off':'Enable voice'}</button></div><div className="setup-row"><div><h2><Volume2/> Hear when time is up</h2><p>{audioMessage}</p></div><button onClick={()=>void testSound()}>Test timer sound</button></div><div className="setup-row"><div><h2><Monitor/> Keep your place in view</h2><p>{wakeStatus}. Put your device on a stable stand, away from heat and splashes.</p></div><button onClick={()=>void toggleWake()}>{wakeStatus==='Screen staying awake'?'Release screen wake':'Keep screen awake'}</button></div></section><aside className="setup-summary"><span className="editorial-label">YOUR TABLE IS SET FOR</span><h2>{session.servings}<span> servings</span></h2><p>{recipe.title}</p><p><LockKeyhole size={18}/> Servings stay fixed once cooking begins, so added ingredients never change underneath you.</p><button className="primary" onClick={()=>{act({type:'phase',phase:'cooking'});setFeedback('Step 1: Get everything ready.')}}>Begin cooking <ArrowRight/></button><p className="fine">Buttons always work. Use Tab and Enter, or left/right arrows when focus is on the page.</p></aside></div></main>:
    <main id="main" className="cooking"><div className="cooking-heading"><div><span className="recipe-name">{recipe.title}</span><span className="serving-lock"><LockKeyhole size={14}/> For {session.servings} servings</span></div><button className="text-button" onClick={()=>{speech.current?.disable();setHelp(true)}}>Cooking help</button></div>
      <div className="cooking-grid"><section className="step-board" aria-labelledby="step-title">
        {session.phase==='complete'?<><div className="step-count"><Check size={22}/> Instructions complete</div><h1 id="step-title">Made it.<br/>Make it yours.</h1><p className="step-instruction">Taste, season and serve when you’re ready.</p><p className="completion-note">{session.timers.some(t=>t.status==='running'||t.status==='paused'||(t.status==='finished'&&!t.acknowledged))?'You still have timers to check. They stay active here until you handle each one.':'Your recipe is complete. Enjoy a well-earned moment at the table.'}</p><div className="completion-actions"><button onClick={()=>{act({type:'phase',phase:'cooking'});setFeedback('Back to the last step. Timers unchanged.')}}>Review last step</button><button onClick={reset}>Cook again</button></div></>:
        <><div className="step-progress"><span className="step-count">Step {String(session.step+1).padStart(2,'0')} <span>/ {String(recipe.steps.length).padStart(2,'0')}</span></span><div className="progress-segments" role="progressbar" aria-valuemin={1} aria-valuemax={recipe.steps.length} aria-valuenow={session.step+1} aria-label="Cooking progress">{recipe.steps.map((s,i)=><span key={s.id} className={i<=session.step?'filled':''}/>)}</div></div><h1 id="step-title">{step.title}.</h1><p className="step-instruction">{step.instruction}</p><div className="step-quantities"><h2>For this step <span>· {session.servings} servings</span></h2><ul>{step.ingredients.map(portion=>{const ingredient=recipe.ingredients.find(i=>i.id===portion.id)!;return <li key={portion.id}><strong>{quantity(portion.amount,ingredient.unit,session.servings)}</strong><span>{ingredient.name}</span></li>})}</ul></div>{step.detail&&<p className="step-detail">{step.detail}</p>}<div className="up-next"><span>Then</span>{recipe.steps[session.step+1]?.title??'A moment to enjoy it.'}<ArrowRight size={18}/></div></>}
      </section><TimerRail session={session} now={now} act={act} confirm={confirm}/></div>
      <div className={`cooking-dock ${session.phase==='complete'?'dock-complete':''}`}><div className={`voice-bar voice-${voice.state}`}><div className="voice-indicator"><span className="voice-symbol" aria-hidden="true"><Mic size={22}/><span className="voice-wave"><i/><i/><i/></span></span><strong>{({unsupported:'Voice unavailable',off:'Voice off',requesting:'Starting microphone',listening:'Listening',processing:'Processing',speaking:'Reading aloud',error:'Voice needs attention'})[voice.state]}</strong><span className="voice-hint">{voice.state==='listening'?'Say “Cook, next step”':voice.message}</span></div><button disabled={voice.state==='unsupported'} onClick={voiceButton}>{voiceActive?<MicOff size={18}/>:<Mic size={18}/>} {voiceActive?'Turn voice off':'Enable voice'}</button></div>
      <div className="feedback-row"><p role="status" aria-live="polite">{heard&&<span className="heard">Heard “{heard}” · </span>}{feedback}</p>{undoStep!==null&&session.phase==='cooking'&&<button className="text-button" onClick={()=>{act({type:'goStep',step:undoStep});setUndoStep(null);setFeedback('Returned to the previous step. Timers unchanged.')}}>Undo step</button>}</div>
      {session.phase==='cooking'&&<nav className="cooking-controls" aria-label="Step navigation"><button disabled={session.step===0} onClick={()=>navigate('previous')}><ArrowLeft/><span>Previous</span></button><button onClick={voice.state==='speaking'?()=>speech.current?.stopSpeaking():repeat}>{voice.state==='speaking'?<X/>:<AudioLines/>}<span>{voice.state==='speaking'?'Stop reading':'Repeat step'}</span></button><button className="primary" onClick={()=>navigate('next')}><span>{session.step===recipe.steps.length-1?'Finish recipe':'Next step'}</span><ArrowRight/></button></nav>}</div>
      <div className="cooking-bottom"><button className="text-button" onClick={()=>session.sound?act({type:'setSound',sound:false}):void testSound()}>{session.sound?<Volume2 size={16}/>:<VolumeX size={16}/>} Timer sound {session.sound?'on':'off'}</button><span>{storageError?'Session not saved':'Progress saved on this device'}</span><button className="text-button" onClick={()=>void toggleWake()}><Monitor size={16}/>{wakeStatus}</button></div>
    </main>}
    <footer className="site-footer"><span>Less scrolling. More cooking.</span><span>Cook Along · a design prototype</span></footer>
    {consent&&<Overlay className="consent-panel" label="consent-title" onClose={()=>setConsent(false)}><h2 id="consent-title">Let your voice lend a hand.</h2><p>Enabling voice lets this browser capture microphone audio and may send it to an online recognition service. English commands begin with “Cook”. This is not a private wake-word detector.</p><p>We don’t store audio or transcripts. Voice stops when you hide or leave the page. You can turn it off at any time.</p><div className="panel-actions"><button autoFocus onClick={()=>setConsent(false)}>Use buttons</button><button className="primary" onClick={enableVoice}>Allow voice and continue</button></div></Overlay>}
    {help&&<Overlay className="help-panel" label="help-title" onClose={()=>setHelp(false)}><div className="section-heading"><h2 id="help-title">A helping hand</h2><button autoFocus aria-label="Close cooking help" onClick={()=>setHelp(false)}><X/></button></div><p>Voice is off while you read this. Close help and enable it again when ready.</p><h3>Say “Cook” before each command</h3><ul className="command-list"><li>“Cook, next step” / “previous step”</li><li>“Cook, repeat step”</li><li>“Cook, how much olive oil?”</li><li>“Cook, start Couscous timer”</li><li>“Cook, pause Chickpeas timer” / “resume Chickpeas timer”</li><li>“Cook, how long on Almonds?”</li><li>“Cook, silence Almonds timer”</li><li>“Cook, stop listening”</li></ul><p>Use a timer’s exact name. Speech pauses while reading aloud; use Stop reading to interrupt. No command changes servings or cancels a timer.</p><h3>Keep control, however you cook</h3><p>Tab to controls, then Enter or Space. Left/right arrow shortcuts work when focus is on the page. R repeats the step. Large buttons provide a touch fallback.</p><button onClick={()=>{setHelp(false);reset()}}>Change servings / start over</button><a href="/case-study">Read the design story</a></Overlay>}
    <dialog ref={modal} className="confirm-dialog" aria-labelledby="confirmation-title" onCancel={()=>setConfirmation(null)} onClick={e=>{if(e.target===modal.current)setConfirmation(null)}}><h2 id="confirmation-title">{confirmation?.title}</h2><p>{confirmation?.detail}</p><div className="panel-actions"><button autoFocus onClick={()=>setConfirmation(null)}>Keep cooking</button><button className="primary" onClick={()=>{confirmation?.action();setConfirmation(null)}}>{confirmation?.label}</button></div></dialog>
  </div>
}
