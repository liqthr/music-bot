export type AudioSource = 
  | { mode: 'stream'; url: string }
  | { mode: 'local-blob'; buffer: ArrayBuffer; mimeType: string }

export interface AudioEngineService {
  load(source: AudioSource): Promise<void>
  play(): Promise<void>
  pause(): void
  seek(seconds: number): void
  setVolume(gain: number): void            // 0.0–1.0

  /** Exposes the AnalyserNode for waveform visualisation */
  getAnalyserNode(): AnalyserNode

  /** Each returns an unsubscribe function */
  onTimeUpdate(cb: (currentTime: number, duration: number) => void): () => void
  onEnded(cb: () => void): () => void
  onError(cb: (err: Error) => void): () => void

  getState(): { currentTime: number; duration: number; isPlaying: boolean }
  destroy(): void
}
