let context: AudioContext | null = null
export async function playChime(): Promise<void> {
  context ??= new AudioContext()
  await context.resume()
  if (context.state !== 'running') throw new Error('Audio is blocked')
  for (const [index, frequency] of [660, 880, 660].entries()) {
    const oscillator = context.createOscillator(), gain = context.createGain()
    const start = context.currentTime + index * 0.22
    oscillator.type = 'sine'; oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.14, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19)
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + 0.2)
  }
}
