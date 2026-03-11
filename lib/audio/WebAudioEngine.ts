import type { AudioEngineService, AudioSource } from './AudioEngineService'

export class WebAudioEngine implements AudioEngineService {
  private ctx: AudioContext
  private audioEl: HTMLAudioElement
  private sourceNode: MediaElementAudioSourceNode
  private analyserNode: AnalyserNode
  private gainNode: GainNode
  private listeners = new Map<string, Set<Function>>()

  constructor() {
    this.ctx = new AudioContext()
    this.audioEl = new HTMLAudioElement()
    this.audioEl.crossOrigin = 'anonymous'
    this.audioEl.preload = 'metadata'

    this.analyserNode = this.ctx.createAnalyser()
    this.analyserNode.fftSize = 2048
    this.gainNode = this.ctx.createGain()

    // Signal chain: audioEl → analyser → gain → speakers
    this.sourceNode = this.ctx.createMediaElementSource(this.audioEl)
    this.sourceNode.connect(this.analyserNode)
    this.analyserNode.connect(this.gainNode)
    this.gainNode.connect(this.ctx.destination)

    this.audioEl.addEventListener('timeupdate', () => {
      this.emit('timeupdate', this.audioEl.currentTime, this.audioEl.duration)
    })
    this.audioEl.addEventListener('ended', () => this.emit('ended'))
    this.audioEl.addEventListener('error', () =>
      this.emit('error', new Error(`Audio error: ${this.audioEl.error?.message}`))
    )
  }

  async load(source: AudioSource): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume()

    if (source.mode === 'stream') {
      this.audioEl.src = source.url
    } else {
      const blob = new Blob([source.buffer], { type: source.mimeType })
      if (this.audioEl.src.startsWith('blob:')) URL.revokeObjectURL(this.audioEl.src)
      this.audioEl.src = URL.createObjectURL(blob)
    }

    return new Promise((resolve, reject) => {
      this.audioEl.addEventListener('canplay', () => resolve(), { once: true })
      this.audioEl.addEventListener('error', () => reject(new Error('Load failed')), { once: true })
      this.audioEl.load()
    })
  }

  async play(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.audioEl.play()
  }

  pause(): void { this.audioEl.pause() }
  seek(s: number): void { this.audioEl.currentTime = s }
  setVolume(v: number): void { this.gainNode.gain.value = Math.max(0, Math.min(1, v)) }
  getAnalyserNode(): AnalyserNode { return this.analyserNode }

  getState() {
    return {
      currentTime: this.audioEl.currentTime,
      duration: this.audioEl.duration || 0,
      isPlaying: !this.audioEl.paused,
    }
  }

  onTimeUpdate(cb: (t: number, d: number) => void) { return this.on('timeupdate', cb) }
  onEnded(cb: () => void) { return this.on('ended', cb) }
  onError(cb: (e: Error) => void) { return this.on('error', cb) }

  private on(event: string, cb: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb)
    return () => this.listeners.get(event)?.delete(cb)
  }

  private emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach(cb => cb(...args))
  }

  destroy(): void {
    if (this.audioEl.src.startsWith('blob:')) URL.revokeObjectURL(this.audioEl.src)
    this.audioEl.remove()
    this.ctx.close()
    this.listeners.clear()
  }
}
