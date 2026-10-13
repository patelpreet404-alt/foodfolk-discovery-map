// Adapter tests use synthetic browser events, not evidence of real microphone recognition.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpeechController } from './speech'

class MockRecognition {
  static instances: MockRecognition[] = []
  continuous = false; interimResults = false; lang = ''
  onstart: (() => void) | null = null
  onspeechend: (() => void) | null = null
  onresult: ((event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn(); abort = vi.fn()
  constructor() { MockRecognition.instances.push(this) }
  result(text: string, final = true) { this.onresult?.({ resultIndex: 0, results: [{ isFinal: final, 0: { transcript: text } }] }) }
}
class MockUtterance {
  lang = ''; rate = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  text: string
  constructor(text: string) { this.text = text }
}
describe('SpeechController — mocked browser adapter', () => {
  let controller: SpeechController
  const onState = vi.fn(); const onCommand = vi.fn()
  const speak = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(10000)
    MockRecognition.instances = []; onState.mockClear(); onCommand.mockClear(); speak.mockClear()
    vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('window', { SpeechRecognition: MockRecognition, SpeechSynthesisUtterance: MockUtterance, speechSynthesis: { speak, cancel: vi.fn() } })
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance)
    controller = new SpeechController({ onState, onCommand })
  })
  afterEach(() => { controller.dispose(); vi.useRealTimers(); vi.unstubAllGlobals() })
  it('starts only after enable and delivers final commands once', () => {
    expect(MockRecognition.instances).toHaveLength(0)
    controller.enable()
    const recognition = MockRecognition.instances[0]
    recognition.onstart?.()
    recognition.result('Cook next', false)
    recognition.result('Cook next'); recognition.result('Cook next')
    expect(onCommand).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1600); recognition.result('Cook next')
    expect(onCommand).toHaveBeenCalledTimes(1)
  })
  it('waits for capture end before playback and ignores captured app speech', () => {
    controller.enable()
    const recognition = MockRecognition.instances[0]
    recognition.onstart?.()
    controller.speak('Cook next')
    expect(recognition.abort).toHaveBeenCalled()
    expect(speak).not.toHaveBeenCalled()
    recognition.result('Cook next')
    expect(onCommand).not.toHaveBeenCalled()
    recognition.onend?.()
    expect(speak).toHaveBeenCalledTimes(1)
    const utterance = speak.mock.calls[0][0] as MockUtterance
    utterance.onstart?.()
    expect(onState).toHaveBeenLastCalledWith('speaking', expect.any(String))
    utterance.onend?.(); vi.advanceTimersByTime(500)
    expect(MockRecognition.instances).toHaveLength(2)
    recognition.result('Cook next')
    expect(onCommand).not.toHaveBeenCalled()
  })
  it('stopSpeaking restores microphone state', () => {
    controller.enable()
    const recognition = MockRecognition.instances[0]
    controller.speak('Step one'); recognition.onend?.()
    controller.stopSpeaking()
    vi.advanceTimersByTime(500)
    expect(MockRecognition.instances).toHaveLength(2)
    MockRecognition.instances[1].onstart?.()
    expect(onState).toHaveBeenLastCalledWith('listening', expect.any(String))
  })
  it('does not reopen permission after denial', () => {
    controller.enable()
    const recognition = MockRecognition.instances[0]
    recognition.onerror?.({ error: 'not-allowed' }); recognition.onend?.()
    vi.advanceTimersByTime(10000)
    expect(MockRecognition.instances).toHaveLength(1)
    expect(onState).toHaveBeenLastCalledWith('error', expect.stringContaining('permission denied'))
  })
  it('bounds repeated immediate disconnects', () => {
    controller.enable()
    for (let index = 0; index < 3; index++) {
      const recognition = MockRecognition.instances[index]
      recognition.onstart?.(); recognition.onend?.(); vi.advanceTimersByTime(500)
    }
    expect(MockRecognition.instances).toHaveLength(3)
    expect(onState).toHaveBeenLastCalledWith('error', expect.stringContaining('repeatedly disconnected'))
  })
  it('cancels playback when microphone never reports ending', () => {
    controller.enable(); controller.speak('Step one')
    vi.advanceTimersByTime(2500)
    expect(speak).not.toHaveBeenCalled()
    expect(onState).toHaveBeenLastCalledWith('error', expect.stringContaining('did not stop'))
  })
})
