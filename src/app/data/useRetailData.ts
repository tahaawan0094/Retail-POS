import { useContext } from 'react'
import { RetailDataContext } from './retailData.context'

export function useRetailData() {
  const context = useContext(RetailDataContext)
  if (!context) throw new Error('useRetailData must be used inside RetailDataProvider')
  return context
}
