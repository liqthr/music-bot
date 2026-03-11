import { create } from 'zustand'
import type { TrackMetadata } from '@/lib/types/track'

interface QueueState {
  queue: TrackMetadata[]
  currentIndex: number

  enqueue: (track: TrackMetadata) => void
  enqueueNext: (track: TrackMetadata) => void
  dequeue: (index: number) => void
  reorder: (fromIndex: number, toIndex: number) => void
  jumpTo: (index: number) => TrackMetadata | null
  next: () => TrackMetadata | null
  previous: () => TrackMetadata | null
  shuffle: () => void
  clear: () => void
}

export const useQueueStore = create<QueueState>()((set, get) => ({
  queue: [],
  currentIndex: -1,

  enqueue: (track) => set((s) => ({ queue: [...s.queue, track] })),

  enqueueNext: (track) =>
    set((s) => {
      const insertAt = s.currentIndex + 1
      const queue = [...s.queue]
      queue.splice(insertAt, 0, track)
      return { queue }
    }),

  dequeue: (index) =>
    set((s) => ({
      queue: s.queue.filter((_, i) => i !== index),
      currentIndex: index < s.currentIndex ? s.currentIndex - 1 : s.currentIndex,
    })),

  reorder: (from, to) =>
    set((s) => {
      const queue = [...s.queue]
      const [item] = queue.splice(from, 1)
      queue.splice(to, 0, item)
      let ci = s.currentIndex
      if (from === ci) ci = to
      else if (from < ci && to >= ci) ci--
      else if (from > ci && to <= ci) ci++
      return { queue, currentIndex: ci }
    }),

  jumpTo: (index) => {
    const { queue } = get()
    if (index < 0 || index >= queue.length) return null
    set({ currentIndex: index })
    return queue[index]
  },

  next: () => {
    const { queue, currentIndex } = get()
    const next = currentIndex + 1
    if (next >= queue.length) return null
    set({ currentIndex: next })
    return queue[next]
  },

  previous: () => {
    const { queue, currentIndex } = get()
    const prev = currentIndex - 1
    if (prev < 0) return null
    set({ currentIndex: prev })
    return queue[prev]
  },

  shuffle: () =>
    set((s) => {
      const queue = [...s.queue]
      const current = queue.splice(s.currentIndex, 1)[0]
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]]
      }
      queue.unshift(current)
      return { queue, currentIndex: 0 }
    }),

  clear: () => set({ queue: [], currentIndex: -1 }),
}))
