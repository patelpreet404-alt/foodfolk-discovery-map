export type VoiceState = 'unsupported' | 'off' | 'requesting' | 'listening' | 'processing' | 'speaking' | 'error'

interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string
  onstart: (() => void) | null
  onspeechend: (() => void) | null
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; abort(): void
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
const messages: Record<string, string> = {
  'not-allowed': 'Microphone permission denied. Allow access in browser settings, then enable voice again.',
  'audio-capture': 'Microphone unavailable. Check your microphone, then enable voice again.',
  network: 'Voice disconnected from its recognition service. Check your connection and enable voice again.',
  'no-speech': 'No speech was heard. Enable voice to try again.',
  'service-not-allowed': 'Speech service is unavailable or blocked. Use the buttons or try another browser.',
  'language-not-supported': 'English speech recognition is unavailable in this browser. Use the buttons.',
}

/** Real browser speech adapter. Capability detection does not guarantee recognition service access. */
export class SpeechController {
  readonly supported: boolean
  private desired = false
  private disposed = false
  private recognition: Recognition | null = null
  private recognitionId = 0
  private speechId = 0
  private pendingText: string | null = null
  private speaking = false
  private restart: ReturnType<typeof setTimeout> | null = null
  private stopTimeout: ReturnType<typeof setTimeout> | null = null
  private lastTranscript = ''
  private lastCommandAt = 0
  private startedAt = 0
  private rapidEnds = 0
  private readonly ctor: (new () => Recognition) | undefined
  private readonly visibility = () => { if (document.hidden) this.disable() }

  private readonly options: { onState: (state: VoiceState, message: string) => void; onCommand: (transcript: string) => void }
  constructor(options: { onState: (state: VoiceState, message: string) => void; onCommand: (transcript: string) => void }) {
    this.options = options
    const host = window as SpeechWindow
    this.ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition
    this.supported = Boolean(this.ctor)
    document.addEventListener('visibilitychange', this.visibility)
    this.state(this.supported ? 'off' : 'unsupported', this.supported ? 'Voice is off.' : 'Voice recognition is unavailable in this browser. All buttons still work.')
  }

  private state(state: VoiceState, message: string) { if (!this.disposed) this.options.onState(state, message) }
  private clearRestart() { if (this.restart) clearTimeout(this.restart); this.restart = null }
  enable() {
    if (this.disposed || !this.supported) return
    this.desired = true
    this.rapidEnds = 0
    if (!this.recognition && !this.speaking && this.pendingText === null) this.begin()
  }
  disable() {
    this.desired = false
    this.clearRestart()
    this.cancelSpeech()
    this.abortRecognition()
    this.state(this.supported ? 'off' : 'unsupported', 'Voice is off. Use the buttons, or enable voice when ready.')
  }
  private abortRecognition() {
    if (!this.recognition) return
    try { this.recognition.abort() } catch { this.recognition = null; this.recognitionId++ }
  }
  private begin() {
    if (!this.ctor || !this.desired || this.disposed || document.hidden || this.recognition || this.speaking || this.pendingText !== null) return
    const recognition = new this.ctor()
    const id = ++this.recognitionId
    this.recognition = recognition
    const current = () => !this.disposed && this.recognition === recognition && id === this.recognitionId
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    this.state('requesting', 'Waiting for microphone access…')
    recognition.onstart = () => {
      if (!current()) return
      if (!this.desired || this.pendingText !== null) { this.abortRecognition(); return }
      this.startedAt = Date.now()
      this.state('listening', 'Listening. Begin each command with “Cook”.')
    }
    recognition.onspeechend = () => { if (current() && this.desired && this.pendingText === null) this.state('processing', 'Processing your command…') }
    const handledFinalIndexes = new Set<number>()
    recognition.onresult = event => {
      if (!current() || !this.desired || this.speaking || this.pendingText !== null) return
      for (let index = event.resultIndex; index < event.results.length; index++) {
        if (!current() || !this.desired || this.speaking || this.pendingText !== null) return
        const result = event.results[index]
        if (!result.isFinal) { this.state('processing', 'Processing your command…'); continue }
        if (handledFinalIndexes.has(index)) continue
        handledFinalIndexes.add(index)
        const transcript = result[0].transcript.trim()
        const normalized = transcript.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
        const now = Date.now()
        if (normalized && (normalized !== this.lastTranscript || now - this.lastCommandAt > 1500)) {
          this.lastTranscript = normalized
          this.lastCommandAt = now
          this.options.onCommand(transcript)
        }
        if (current() && this.desired && !this.speaking && this.pendingText === null) this.state('listening', 'Listening. Begin each command with “Cook”.')
      }
    }
    recognition.onerror = event => {
      if (!current() || !this.desired || this.pendingText !== null) return
      this.desired = false
      this.clearRestart()
      this.state('error', messages[event.error] ?? 'Voice recognition stopped. Use the buttons or enable voice to retry.')
    }
    recognition.onend = () => {
      if (!current()) return
      this.recognition = null
      if (this.stopTimeout) clearTimeout(this.stopTimeout)
      this.stopTimeout = null
      if (this.pendingText !== null) { const text = this.pendingText; this.pendingText = null; this.startSpeech(text); return }
      if (!this.desired || this.speaking) return
      this.rapidEnds = Date.now() - this.startedAt < 3000 ? this.rapidEnds + 1 : 0
      if (this.rapidEnds >= 3) {
        this.desired = false
        this.state('error', 'Voice repeatedly disconnected. Enable voice to retry, or use the buttons.')
        return
      }
      this.state('processing', 'Microphone paused. Reconnecting…')
      this.restart = setTimeout(() => { this.restart = null; this.begin() }, 500)
    }
    try { recognition.start() } catch {
      this.recognition = null
      this.desired = false
      this.state('error', 'Could not start the microphone. Enable voice to retry, or use the buttons.')
    }
  }
  speak(text: string) {
    if (this.disposed || !text.trim()) return
    this.clearRestart()
    this.cancelSpeech()
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      this.state(this.desired ? 'listening' : 'off', 'Spoken playback is unavailable. Read the step on screen.')
      if (this.desired) this.begin()
      return
    }
    if (this.recognition) {
      this.pendingText = text
      this.state('processing', 'Stopping the microphone before reading aloud…')
      this.stopTimeout = setTimeout(() => {
        this.pendingText = null
        this.desired = false
        this.state('error', 'Microphone did not stop. Spoken playback cancelled. Turn voice off and retry.')
      }, 2500)
      this.abortRecognition()
    } else this.startSpeech(text)
  }
  private startSpeech(text: string) {
    if (this.disposed) return
    const id = ++this.speechId
    this.speaking = true
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.92
    utterance.onstart = () => { if (id === this.speechId) this.state('speaking', 'Reading aloud. Microphone paused.') }
    const finish = (failed: boolean) => {
      if (id !== this.speechId || this.disposed) return
      this.speaking = false
      this.state(this.desired ? 'processing' : 'off', failed ? 'Spoken playback failed. The instruction is on screen.' : 'Finished reading.')
      if (this.desired) this.restart = setTimeout(() => { this.restart = null; this.begin() }, 500)
    }
    utterance.onend = () => finish(false)
    utterance.onerror = () => finish(true)
    this.state('processing', 'Preparing spoken playback. Microphone paused.')
    try { window.speechSynthesis.speak(utterance) } catch { finish(true) }
  }
  stopSpeaking() {
    this.cancelSpeech()
    this.state(this.desired ? 'processing' : 'off', 'Spoken playback stopped.')
    if (this.desired && !this.recognition) {
      this.clearRestart()
      this.restart = setTimeout(() => { this.restart = null; this.begin() }, 500)
    }
  }
  private cancelSpeech() {
    this.speechId++
    this.speaking = false
    this.pendingText = null
    if (this.stopTimeout) clearTimeout(this.stopTimeout)
    this.stopTimeout = null
    window.speechSynthesis?.cancel()
  }
  dispose() {
    this.disable()
    this.disposed = true
    this.recognitionId++
    document.removeEventListener('visibilitychange', this.visibility)
  }
}
