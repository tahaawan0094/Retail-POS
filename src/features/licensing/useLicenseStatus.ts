import { useCallback, useEffect, useState } from 'react'
import type { LicenseStatus } from '../../types/licensing'
import { useAuth } from '../../app/auth/useAuth'

export const notifyLicenseChanged = () => window.dispatchEvent(new Event('vertexia:license-changed'))
export function useLicenseStatus() {
  const { session } = useAuth()
  const [status, setStatus] = useState<LicenseStatus | null>(null), [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setStatus(await window.vertexia!.licensing.status()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'License status unavailable.') }
  }, [])
  useEffect(() => {
    const load = () => { void refresh() }
    const initial = window.setTimeout(load, 0), timer = window.setInterval(load, 3000)
    window.addEventListener('focus', load); window.addEventListener('vertexia:license-changed', load)
    return () => { window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('vertexia:license-changed', load) }
  }, [refresh, session?.branchId])
  return { status, error, refresh }
}
