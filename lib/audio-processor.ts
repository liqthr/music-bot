/**
 * Web Audio API wrapper for advanced audio processing
 * Provides crossfade, gapless playback, volume normalization, equalizer, and playback speed control
 */

/**
 * Equalizer settings (dB gain for each band)
 */
export interface EqualizerSettings {
  bass: number // -12 to +12 dB, typically at 200Hz
  mid: number // -12 to +12 dB, typically at 1000Hz
  treble: number // -12 to +12 dB, typically at 4000Hz
}

/**
 * Analyser data for volume normalization and waveform visualization
 */
export interface AnalyserData {
  frequencyData: Uint8Array
  timeData: Uint8Array
  averageVolume: number
  peakVolume: number
}

/**
 * Create AudioProcessor instance managing Web Audio API audio graph
 */
export function createAudioProcessor() {
  let audioContext: AudioContext | null = null
  let sourceNode: MediaElementAudioSourceNode | null = null
  let gainNode: GainNode | null = null
  let bassFilter: BiquadFilterNode | null = null
  let midFilter: BiquadFilterNode | null = null
  let trebleFilter: BiquadFilterNode | null = null
  let analyserNode: AnalyserNode | null = null
  let audioElement: HTMLAudioElement | null = null
  let isInitialized = false

  /**
   * Initialize AudioContext (lazy initialization - called on first use)
   * Must be called after user interaction due to browser autoplay restrictions
   */
  async function initializeAudioContext(): Promise<void> {
    if (audioContext && audioContext.state !== 'closed') {
      return
    }

    try {
      // Create AudioContext with optimal settings
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100, // Standard sample rate
      })

      // Resume context if suspended (required for some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      isInitialized = true
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error)
      throw new Error('AudioContext initialization failed. User interaction may be required.')
    }
  }

  /**
   * Create audio graph: source → gain → filters → analyser → destination
   */
  function createAudioGraph(): void {
    if (!audioContext) {
      throw new Error('AudioContext not initialized')
    }

    // Create gain node for volume control
    gainNode = audioContext.createGain()
    gainNode.gain.value = 1.0

    // Create bass filter (lowshelf at 200Hz)
    bassFilter = audioContext.createBiquadFilter()
    bassFilter.type = 'lowshelf'
    bassFilter.frequency.value = 200
    bassFilter.gain.value = 0

    // Create mid filter (peaking at 1000Hz)
    midFilter = audioContext.createBiquadFilter()
    midFilter.type = 'peaking'
    midFilter.frequency.value = 1000
    midFilter.Q.value = 1.0
    midFilter.gain.value = 0

    // Create treble filter (highshelf at 4000Hz)
    trebleFilter = audioContext.createBiquadFilter()
    trebleFilter.type = 'highshelf'
    trebleFilter.frequency.value = 4000
    trebleFilter.gain.value = 0

    // Create analyser node for volume analysis and waveform
    analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 2048
    analyserNode.smoothingTimeConstant = 0.8

    // Connect audio graph: source → gain → bass → mid → treble → analyser → destination
    gainNode.connect(bassFilter)
    bassFilter.connect(midFilter)
    midFilter.connect(trebleFilter)
    trebleFilter.connect(analyserNode)
    analyserNode.connect(audioContext.destination)
  }

  /**
   * Dispose audio source node (disconnect from graph)
   */
  function disposeSource(): void {
    if (sourceNode) {
      try {
        sourceNode.disconnect()
      } catch (error) {
        // Ignore errors if already disconnected
      }
      sourceNode = null
    }
    audioElement = null
  }

  return {
    /**
     * Create audio source from HTMLAudioElement
     */
    async createAudioSource(audioElementParam: HTMLAudioElement): Promise<void> {
      // Initialize AudioContext if needed
      await initializeAudioContext()

      if (!audioContext) {
        throw new Error('AudioContext initialization failed')
      }

      // Dispose existing source if any
      if (sourceNode) {
        disposeSource()
      }

      // Store audio element reference
      audioElement = audioElementParam

      // Create audio graph if not already created
      if (!gainNode) {
        createAudioGraph()
      }

      // Create MediaElementSourceNode from audio element
      // Note: Can only create one source per audio element
      try {
        sourceNode = audioContext.createMediaElementSource(audioElement)
        // Connect source to gain node
        sourceNode.connect(gainNode!)
      } catch (error) {
        console.error('Failed to create audio source:', error)
        throw new Error('Failed to create audio source. Audio element may already be connected.')
      }
    },

    /**
     * Set volume level (0.0 to 1.0)
     */
    setVolume(level: number): void {
      if (!gainNode) {
        console.warn('Gain node not initialized. Call createAudioSource first.')
        return
      }

      // Clamp volume to valid range
      const clampedLevel = Math.max(0, Math.min(1, level))
      gainNode.gain.value = clampedLevel
    },

    /**
     * Get current volume level
     */
    getVolume(): number {
      if (!gainNode) {
        return 1.0
      }
      return gainNode.gain.value
    },

    /**
     * Set equalizer settings
     */
    setEqualizer(settings: EqualizerSettings): void {
      if (!bassFilter || !midFilter || !trebleFilter) {
        console.warn('Equalizer filters not initialized. Call createAudioSource first.')
        return
      }

      // Clamp gains to valid range (-12 to +12 dB)
      const bassGain = Math.max(-12, Math.min(12, settings.bass))
      const midGain = Math.max(-12, Math.min(12, settings.mid))
      const trebleGain = Math.max(-12, Math.min(12, settings.treble))

      // Apply gains with smooth transitions
      if (audioContext) {
        const now = audioContext.currentTime
        bassFilter.gain.setTargetAtTime(bassGain, now, 0.01)
        midFilter.gain.setTargetAtTime(midGain, now, 0.01)
        trebleFilter.gain.setTargetAtTime(trebleGain, now, 0.01)
      } else {
        // Fallback if AudioContext not available
        bassFilter.gain.value = bassGain
        midFilter.gain.value = midGain
        trebleFilter.gain.value = trebleGain
      }
    },

    /**
     * Get current equalizer settings
     */
    getEqualizer(): EqualizerSettings {
      return {
        bass: bassFilter?.gain.value || 0,
        mid: midFilter?.gain.value || 0,
        treble: trebleFilter?.gain.value || 0,
      }
    },

    /**
     * Set playback rate (0.5 to 2.0)
     * Note: HTMLAudioElement.playbackRate changes both speed and pitch
     */
    setPlaybackRate(rate: number): void {
      if (!audioElement) {
        console.warn('Audio element not connected. Call createAudioSource first.')
        return
      }

      // Clamp rate to valid range
      const clampedRate = Math.max(0.5, Math.min(2.0, rate))
      audioElement.playbackRate = clampedRate
    },

    /**
     * Get current playback rate
     */
    getPlaybackRate(): number {
      if (!audioElement) {
        return 1.0
      }
      return audioElement.playbackRate
    },

    /**
     * Set pitch adjustment in semitones (-12 to +12)
     * Uses playbackRate adjustment: pitchRatio = 2^(semitones/12)
     */
    setPitch(semitones: number): void {
      if (!audioElement) {
        console.warn('Audio element not connected. Call createAudioSource first.')
        return
      }

      // Clamp semitones to valid range
      const clampedSemitones = Math.max(-12, Math.min(12, semitones))
      
      // Convert semitones to playback rate ratio
      const pitchRatio = Math.pow(2, clampedSemitones / 12)
      
      // Apply pitch adjustment via playbackRate
      audioElement.playbackRate = pitchRatio
    },

    /**
     * Get current pitch adjustment in semitones
     */
    getPitch(): number {
      if (!audioElement) {
        return 0
      }
      // Convert playbackRate back to semitones
      const playbackRate = audioElement.playbackRate
      return 12 * Math.log2(playbackRate)
    },

    /**
     * Get analyser data for volume normalization and waveform visualization
     */
    getAnalyserData(): AnalyserData | null {
      if (!analyserNode) {
        return null
      }

      const bufferLength = analyserNode.frequencyBinCount
      const frequencyData = new Uint8Array(bufferLength)
      const timeData = new Uint8Array(bufferLength)

      analyserNode.getByteFrequencyData(frequencyData)
      analyserNode.getByteTimeDomainData(timeData)

      // Calculate average and peak volume
      let sum = 0
      let peak = 0
      for (let i = 0; i < frequencyData.length; i++) {
        sum += frequencyData[i]
        peak = Math.max(peak, frequencyData[i])
      }
      const averageVolume = sum / frequencyData.length
      const peakVolume = peak

      return {
        frequencyData,
        timeData,
        averageVolume,
        peakVolume,
      }
    },

    /**
     * Dispose all audio nodes and close AudioContext
     */
    async dispose(): Promise<void> {
      // Dispose source
      disposeSource()

      // Disconnect all nodes
      if (gainNode) {
        try {
          gainNode.disconnect()
        } catch (error) {
          // Ignore errors
        }
        gainNode = null
      }

      if (bassFilter) {
        try {
          bassFilter.disconnect()
        } catch (error) {
          // Ignore errors
        }
        bassFilter = null
      }

      if (midFilter) {
        try {
          midFilter.disconnect()
        } catch (error) {
          // Ignore errors
        }
        midFilter = null
      }

      if (trebleFilter) {
        try {
          trebleFilter.disconnect()
        } catch (error) {
          // Ignore errors
        }
        trebleFilter = null
      }

      if (analyserNode) {
        try {
          analyserNode.disconnect()
        } catch (error) {
          // Ignore errors
        }
        analyserNode = null
      }

      // Close AudioContext
      if (audioContext && audioContext.state !== 'closed') {
        try {
          await audioContext.close()
        } catch (error) {
          console.error('Error closing AudioContext:', error)
        }
        audioContext = null
      }

      isInitialized = false
    },

    /**
     * Resume AudioContext if suspended
     */
    async resume(): Promise<void> {
      if (audioContext && audioContext.state === 'suspended') {
        try {
          await audioContext.resume()
        } catch (error) {
          console.error('Failed to resume AudioContext:', error)
        }
      }
    },

    /**
     * Get AudioContext state
     */
    getState(): AudioContextState | 'not-initialized' {
      if (!audioContext) {
        return 'not-initialized'
      }
      return audioContext.state
    },

    /**
     * Check if AudioProcessor is initialized
     */
    isReady(): boolean {
      return isInitialized && audioContext !== null && sourceNode !== null
    },
  }
}

// Export singleton instance for app-wide use
export const audioProcessor = createAudioProcessor()
