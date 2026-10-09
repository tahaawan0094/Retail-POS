import { useState } from 'react'
import { hashToPage, pages, pageToHash } from './app/routes'
import { RetailDataProvider } from './app/data/RetailDataProvider'
import type { PageName } from './types'
import './styles/index.css'

function App() {
  const [activePage, setActivePage] = useState<PageName>(() => hashToPage[window.location.hash] ?? 'POS')
  const [sidebarLocked, setSidebarLocked] = useState(false)

  const navigate = (requestedPage: string) => {
    const page = requestedPage in pages ? requestedPage as PageName : 'Dashboard'
    setActivePage(page)
    window.history.replaceState(null, '', pageToHash[page])
  }

  const ActivePage = pages[activePage]
  return <RetailDataProvider><ActivePage onNavigate={navigate} sidebarLocked={sidebarLocked} onToggleSidebarLock={() => setSidebarLocked(value => !value)} /></RetailDataProvider>
}

export default App


