import type { Light } from '../../shared/types.ts'

let context: AudioContext | undefined

function tone(context: AudioContext, frequency: number, offset: number, duration: number, volume: number, type: OscillatorType) {
  const start = context.currentTime + offset
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

export function playStatusSound(light: Exclude<Light, 'yellow'>) {
  context ??= new AudioContext()
  const audio = context
  void audio.resume().then(() => {
    if (light === 'green') {
      tone(audio, 523.25, 0, 0.24, 0.16, 'sine')
      tone(audio, 659.25, 0.16, 0.34, 0.14, 'sine')
    } else {
      tone(audio, 880, 0, 0.12, 0.12, 'square')
      tone(audio, 880, 0.2, 0.12, 0.12, 'square')
      tone(audio, 880, 0.4, 0.16, 0.12, 'square')
    }
  }).catch(() => {})
}
