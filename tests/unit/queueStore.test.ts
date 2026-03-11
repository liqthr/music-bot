import { describe, it, expect, beforeEach } from 'vitest'
import { useQueueStore } from '@/store/queueStore'
import type { TrackMetadata } from '@/lib/types/track'

const createMockTrack = (id: string): TrackMetadata => ({
  id,
  title: `Track ${id}`,
  artist: 'Artist',
  durationSeconds: 180,
  source: { platform: 'spotify', platformId: id },
  fetchedAt: Date.now(),
  artwork: null,
})

describe('queueStore', () => {
  beforeEach(() => {
    useQueueStore.getState().clear()
  })

  it('enqueues tracks in order', () => {
    useQueueStore.getState().enqueue(createMockTrack('a'))
    useQueueStore.getState().enqueue(createMockTrack('b'))
    
    const state = useQueueStore.getState()
    expect(state.queue).toHaveLength(2)
    expect(state.queue[1].id).toBe('b')
  })

  it('enqueueNext inserts after currentIndex', () => {
    useQueueStore.setState({ queue: [createMockTrack('a'), createMockTrack('c')], currentIndex: 0 })
    useQueueStore.getState().enqueueNext(createMockTrack('b'))
    
    const state = useQueueStore.getState()
    expect(state.queue.map(t => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('shuffle preserves current track at index 0', () => {
    ;['a', 'b', 'c', 'd', 'e'].forEach(id => 
      useQueueStore.getState().enqueue(createMockTrack(id))
    )
    useQueueStore.setState({ currentIndex: 2 })
    useQueueStore.getState().shuffle()
    
    const state = useQueueStore.getState()
    expect(state.currentIndex).toBe(0)
    expect(state.queue[0].id).toBe('c')
    expect(state.queue).toHaveLength(5)
  })

  it('reorder adjusts currentIndex when current track moves', () => {
    ;['a', 'b', 'c'].forEach(id => 
      useQueueStore.getState().enqueue(createMockTrack(id))
    )
    useQueueStore.setState({ currentIndex: 0 })
    useQueueStore.getState().reorder(0, 2)
    
    const state = useQueueStore.getState()
    expect(state.currentIndex).toBe(2)
  })

  it('next returns null at end of queue', () => {
    useQueueStore.getState().enqueue(createMockTrack('a'))
    useQueueStore.setState({ currentIndex: 0 })
    
    const next = useQueueStore.getState().next()
    expect(next).toBeNull()
  })

  it('previous returns null at start of queue', () => {
    useQueueStore.getState().enqueue(createMockTrack('a'))
    useQueueStore.setState({ currentIndex: 0 })
    
    const previous = useQueueStore.getState().previous()
    expect(previous).toBeNull()
  })
})
