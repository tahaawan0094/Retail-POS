import { useAuth } from '../../app/auth/useAuth'
import { useCallback, useEffect, useState } from 'react'
import type { DashboardChartPeriod, DashboardDateRange, DashboardSnapshot } from '../../types/desktop-api'

export function useDashboardData() {
  const { session, selectBranch } = useAuth()
  const branchId = session!.branchId
  const setBranchId = (id: string) => { void selectBranch(id) }
  const [dateRange,setDateRange] = useState<DashboardDateRange>('today')
  const [chartPeriod,setChartPeriod] = useState<DashboardChartPeriod>('7_days')
  const [snapshot,setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  const refresh = useCallback(async (quiet = false) => {
    if (!window.vertexia) {
      setError('Desktop database is unavailable. Start Vertexia with npm run dev:desktop.')
      setLoading(false)
      return
    }
    if (!quiet) setLoading(true)
    try {
      const result = await window.vertexia.dashboard.getSnapshot({ branchId,dateRange,chartPeriod })
      setSnapshot(result)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dashboard data could not be loaded.')
    } finally {
      setLoading(false)
    }
  },[branchId,dateRange,chartPeriod])

  useEffect(() => {
    const task = window.setTimeout(() => void refresh(),0)
    return () => window.clearTimeout(task)
  },[refresh])
  useEffect(() => {
    const update = () => void refresh(true)
    const onVisibility = () => { if (document.visibilityState === 'visible') update() }
    window.addEventListener('focus',update)
    document.addEventListener('visibilitychange',onVisibility)
    const timer = window.setInterval(update,60_000)
    return () => {
      window.removeEventListener('focus',update)
      document.removeEventListener('visibilitychange',onVisibility)
      window.clearInterval(timer)
    }
  },[refresh])

  return { snapshot,loading,error,branchId,setBranchId,dateRange,setDateRange,chartPeriod,setChartPeriod,refresh }
}
