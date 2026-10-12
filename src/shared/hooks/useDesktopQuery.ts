import { useEffect, useRef, useState } from 'react'
import { RETAIL_DATA_CHANGED } from '../../services/retail-events'

export function useDesktopQuery<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ load: () => Promise<T>; data: T | null; loading: boolean; error: string } | null>(null)
  useEffect(() => {
    let alive = true, generation = 0
    const refresh = async () => {
      const current = ++generation
      setState(previous => ({ load, data: previous?.load === load ? previous.data : null, loading: true, error: '' }))
      try { const data = await load(); if (alive && current === generation) setState({ load, data, loading: false, error: '' }) }
      catch (cause) { if (alive && current === generation) setState(previous => ({ load, data: previous?.load === load ? previous.data : null, loading: false, error: cause instanceof Error ? cause.message : 'Records could not be loaded.' })) }
    }
    const onRefresh = () => { void refresh() }
    const timer = window.setTimeout(onRefresh, 150)
    window.addEventListener(RETAIL_DATA_CHANGED, onRefresh); window.addEventListener('focus', onRefresh)
    return () => { alive = false; window.clearTimeout(timer); window.removeEventListener(RETAIL_DATA_CHANGED, onRefresh); window.removeEventListener('focus', onRefresh) }
  }, [load])
  // Never show another customer's balance/form while a new query waits to start.
  return state?.load === load ? state : { data: null, loading: true, error: '' }
}

export function useDesktopAction() {
  const active = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const run = async (action: () => Promise<void>) => {
    if (active.current) return
    active.current = true; setBusy(true); setError(''); setNotice('')
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Operation failed.') }
    finally { active.current = false; setBusy(false) }
  }
  return { busy, error, notice, run, setNotice }
}
