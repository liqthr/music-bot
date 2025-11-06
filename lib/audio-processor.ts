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
 * AudioProcessor class managing Web Audio API audio graph
 */
export class AudioProcessor {
  private audioContext: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  private bassFilter: BiquadFilterNode | null = null
  private midFilter: BiquadFilterNode | null = null
  private trebleFilter: BiquadFilterNode | null = null
  private analyserNode: AnalyserNode | null = null
  private audioElement: HTMLAudioElement | null = null
  private isInitialized = false

  /**
   * Initialize AudioContext (lazy initialization - called on first use)
   * Must be called after user interaction due to browser autoplay restrictions
   */
  private async initializeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return
    }

    try {
      // Create AudioContext with optimal settings
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100, // Standard sample rate
      })

      // Resume context if suspended (required for some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error)
      throw new Error('AudioContext initialization failed. User interaction may be required.')
    }
  }

  /**
   * Create audio graph: source → gain → filters → analyser → destination
   */
  private createAudioGraph(): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized')
    }

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain()
    this.gainNode.gain.value = 1.0

    // Create bass filter (lowshelf at 200Hz)
    this.bassFilter = this.audioContext.createBiquadFilter()
    this.bassFilter.type = 'lowshelf'
    this.bassFilter.frequency.value = 200
    this.bassFilter.gain.value = 0

    // Create mid filter (peaking at 1000Hz)
    this.midFilter = this.audioContext.createBiquadFilter()
    this.midFilter.type = 'peaking'
    this.midFilter.frequency.value = 1000
    this.midFilter.Q.value = 1.0
    this.midFilter.gain.value = 0

    // Create treble filter (highshelf at 4000Hz)
    this.trebleFilter = this.audioContext.createBiquadFilter()
    this.trebleFilter.type = 'highshelf'
    this.trebleFilter.frequency.value = 4000
    this.trebleFilter.gain.value = 0

    // Create analyser node for volume analysis and waveform
    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = 2048
    this.analyserNode.smoothingTimeConstant = 0.8

    // Connect audio graph: source → gain → bass → mid → treble → analyser → destination
    this.gainNode.connect(this.bassFilter)
    this.bassFilter.connect(this.midFilter)
    this.midFilter.connect(this.trebleFilter)
    this.trebleFilter.connect(this.analyserNode)
    this.analyserNode.connect(this.audioContext.destination)
  }

  /**
   * Create audio source from HTMLAudioElement
   * @param audioElement - HTML audio element to process
   */
  async createAudioSource(audioElement: HTMLAudioElement): Promise<void> {
    // Initialize AudioContext if needed
    await this.initializeAudioContext()

    if (!this.audioContext) {
      throw new Error('AudioContext initialization failed')
    }

    // Dispose existing source if any
    if (this.sourceNode) {
      this.disposeSource()
    }

    // Store audio element reference
    this.audioElement = audioElement

    // Create audio graph if not already created
    if (!this.gainNode) {
      this.createAudioGraph()
    }

    // Create MediaElementSourceNode from audio element
    // Note: Can only create one source per audio element
    try {
      this.sourceNode = this.audioContext.createMediaElementSource(audioElement)
      // Connect source to gain node
      this.sourceNode.connect(this.gainNode!)
    } catch (error) {
      console.error('Failed to create audio source:', error)
      throw new Error('Failed to create audio source. Audio element may already be connected.')
    }
  }

  /**
   * Set volume level (0.0 to 1.0)
   * @param level - Volume level between 0 and 1
   */
  setVolume(level: number): void {
    if (!this.gainNode) {
      console.warn('Gain node not initialized. Call createAudioSource first.')
      return
    }

    // Clamp volume to valid range
    const clampedLevel = Math.max(0, Math.min(1, level))
    this.gainNode.gain.value = clampedLevel
  }

  /**
   * Get current volume level
   * @returns Current volume level (0-1)
   */
  getVolume(): number {
    if (!this.gainNode) {
      return 1.0
    }
    return this.gainNode.gain.value
  }

  /**
   * Set equalizer settings
   * @param settings - Equalizer settings with bass, mid, and treble gains in dB
   */
  setEqualizer(settings: EqualizerSettings): void {
    if (!this.bassFilter || !this.midFilter || !this.trebleFilter) {
      console.warn('Equalizer filters not initialized. Call createAudioSource first.')
      return
    }

    // Clamp gains to valid range (-12 to +12 dB)
    const bassGain = Math.max(-12, Math.min(12, settings.bass))
    const midGain = Math.max(-12, Math.min(12, settings.mid))
    const trebleGain = Math.max(-12, Math.min(12, settings.treble))

    // Apply gains with smooth transitions
    if (this.audioContext) {
      const now = this.audioContext.currentTime
      this.bassFilter.gain.setTargetAtTime(bassGain, now, 0.01)
      this.midFilter.gain.setTargetAtTime(midGain, now, 0.01)
      this.trebleFilter.gain.setTargetAtTime(trebleGain, now, 0.01)
    } else {
      // Fallback if AudioContext not available
      this.bassFilter.gain.value = bassGain
      this.midFilter.gain.value = midGain
      this.trebleFilter.gain.value = trebleGain
    }
  }

  /**
   * Get current equalizer settings
   * @returns Current equalizer settings
   */
  getEqualizer(): EqualizerSettings {
    return {
      bass: this.bassFilter?.gain.value || 0,
      mid: this.midFilter?.gain.value || 0,
      treble: this.trebleFilter?.gain.value || 0,
    }
  }

  /**
   * Set playback rate (0.5 to 2.0)
   * Note: HTMLAudioElement.playbackRate changes both speed and pitch
   * @param rate - Playback rate (0.5 = half speed, 1.0 = normal, 2.0 = double speed)
   */
  setPlaybackRate(rate: number): void {
    if (!this.audioElement) {
      console.warn('Audio element not connected. Call createAudioSource first.')
      return
    }

    // Clamp rate to valid range
    const clampedRate = Math.max(0.5, Math.min(2.0, rate))
    this.audioElement.playbackRate = clampedRate
  }

  /**
   * Get current playback rate
   * @returns Current playback rate
   */
  getPlaybackRate(): number {
    if (!this.audioElement) {
      return 1.0
    }
    return this.audioElement.playbackRate
  }

  /**
   * Set pitch adjustment in semitones (-12 to +12)
   * Uses playbackRate adjustment: pitchRatio = 2^(semitones/12)
   * Note: This also affects playback speed. For true pitch-only adjustment,
   * a more complex pitch shifter would be needed.
   * @param semitones - Pitch adjustment in semitones (-12 to +12)
   */
  setPitch(semitones: number): void {
    if (!this.audioElement) {
      console.warn('Audio element not connected. Call createAudioSource first.')
      return
    }

    // Clamp semitones to valid range
    const clampedSemitones = Math.max(-12, Math.min(12, semitones))
    
    // Convert semitones to playback rate ratio
    // pitchRatio = 2^(semitones/12)
    const pitchRatio = Math.pow(2, clampedSemitones / 12)
    
    // Apply pitch adjustment via playbackRate
    // Note: This will also change playback speed
    // For MVP, this is acceptable. A true pitch shifter would require
    // more complex processing with delay nodes and crossfading.
    this.audioElement.playbackRate = pitchRatio
  }

  /**
   * Get current pitch adjustment in semitones
   * @returns Current pitch adjustment in semitones
   */
  getPitch(): number {
    if (!this.audioElement) {
      return 0
    }
    // Convert playbackRate back to semitones
    // semitones = 12 * log2(playbackRate)
    const playbackRate = this.audioElement.playbackRate
    return 12 * Math.log2(playbackRate)
  }

  /**
   * Get analyser data for volume normalization and waveform visualization
   * @returns Analyser data with frequency and time domain data
   */
  getAnalyserData(): AnalyserData | null {
    if (!this.analyserNode) {
      return null
    }

    const bufferLength = this.analyserNode.frequencyBinCount
    const frequencyData = new Uint8Array(bufferLength)
    const timeData = new Uint8Array(bufferLength)

    this.analyserNode.getByteFrequencyData(frequencyData)
    this.analyserNode.getByteTimeDomainData(timeData)

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
  }

  /**
   * Dispose audio source node (disconnect from graph)
   */
  private disposeSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch (error) {
        // Ignore errors if already disconnected
      }
      this.sourceNode = null
    }
    this.audioElement = null
  }

  /**
   * Dispose all audio nodes and close AudioContext
   * Call this when done with audio processing to free resources
   */
  async dispose(): Promise<void> {
    // Dispose source
    this.disposeSource()

    // Disconnect all nodes
    if (this.gainNode) {
      try {
        this.gainNode.disconnect()
      } catch (error) {
        // Ignore errors
      }
      this.gainNode = null
    }

    if (this.bassFilter) {
      try {
        this.bassFilter.disconnect()
      } catch (error) {
        // Ignore errors
      }
      this.bassFilter = null
    }

    if (this.midFilter) {
      try {
        this.midFilter.disconnect()
      } catch (error) {
        // Ignore errors
      }
      this.midFilter = null
    }

    if (this.trebleFilter) {
      try {
        this.trebleFilter.disconnect()
      } catch (error) {
        // Ignore errors
      }
      this.trebleFilter = null
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect()
      } catch (error) {
        // Ignore errors
      }
      this.analyserNode = null
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close()
      } catch (error) {
        console.error('Error closing AudioContext:', error)
      }
      this.audioContext = null
    }

    this.isInitialized = false
  }

  /**
   * Resume AudioContext if suspended
   * Required for some browsers that suspend AudioContext on page load
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
      } catch (error) {
        console.error('Failed to resume AudioContext:', error)
      }
    }
  }

  /**
   * Get AudioContext state
   * @returns Current AudioContext state
   */
  getState(): AudioContextState | 'not-initialized' {
    if (!this.audioContext) {
      return 'not-initialized'
    }
    return this.audioContext.state
  }

  /**
   * Check if AudioProcessor is initialized
   * @returns true if initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null && this.sourceNode !== null
  }
}

// Export singleton instance for app-wide use
export const audioProcessor = new AudioProcessor()

