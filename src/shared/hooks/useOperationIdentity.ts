import { useRef } from 'react'

// Retries keep the ID; changed input or successful checkout starts a new one.
export function useOperationIdentity(scope: string) {
  const storageKey = `vertexia.pending-operation.${scope}`
  const pending = useRef<{ fingerprint: string; id: string } | null>(null)
  return {
    idFor: (request: unknown) => {
      const fingerprint = JSON.stringify(request)
      if (!pending.current) {
        const saved = window.localStorage.getItem(storageKey)
        if (saved) {
          try {
            const previous = JSON.parse(saved) as { fingerprint?:unknown;id?:unknown }
            if (typeof previous.fingerprint === 'string' && typeof previous.id === 'string') pending.current = { fingerprint:previous.fingerprint,id:previous.id }
          } catch { /* Corrupt retry metadata is replaced before submitting. */ }
        }
      }
      if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() }
      // This stores retry metadata only; financial records remain in SQLite.
      window.localStorage.setItem(storageKey, JSON.stringify(pending.current))
      return pending.current.id
    },
    reset: () => { pending.current = null; window.localStorage.removeItem(storageKey) },
  }
}
