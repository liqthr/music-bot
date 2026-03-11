import '@testing-library/jest-dom'
import { server } from './mocks/server'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Stub Web Audio API — not available in jsdom
global.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn().mockReturnValue({ 
    fftSize: 2048, 
    connect: vi.fn(),
    frequencyBinCount: 1024,
    getByteTimeDomainData: vi.fn(),
    getByteFrequencyData: vi.fn()
  }),
  createGain: vi.fn().mockReturnValue({ 
    gain: { value: 1 }, 
    connect: vi.fn() 
  }),
  createMediaElementSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
  state: 'running',
  destination: {},
}))

// Stub HTMLAudioElement
global.HTMLAudioElement = vi.fn().mockImplementation(() => ({
  src: '',
  currentTime: 0,
  duration: 0,
  paused: true,
  volume: 1,
  crossOrigin: '',
  preload: '',
  load: vi.fn(),
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  error: null,
}))
