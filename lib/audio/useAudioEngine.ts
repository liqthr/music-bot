import { WebAudioEngine } from './WebAudioEngine'
import type { AudioEngineService } from './AudioEngineService'

let engineInstance: AudioEngineService | null = null

function getEngine(): AudioEngineService {
  if (!engineInstance) engineInstance = new WebAudioEngine()
  return engineInstance
}

export function useAudioEngine() {
  return getEngine()
}
