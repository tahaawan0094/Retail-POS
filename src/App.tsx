import { useState } from 'react'
import { hashToPage, pages, pageToHash } from './app/routes'
import { RetailDataProvider } from './app/data/RetailDataProvider'
import type { PageName } from './types'
import './styles/index.css'
import { AuthProvider } from './app/auth/AuthContext'
import { useAuth } from './app/auth/useAuth'

function AuthenticatedApp() {
  const { session, canPage } = useAuth()
  const [activePage, setActivePage] = useState<PageName>(() => hashToPage[window.location.hash] ?? 'POS')

  const navigate = (requestedPage: string) => {
    const page = requestedPage in pages && canPage(requestedPage) ? requestedPage as PageName : canPage('POS') ? 'POS' : 'Products'
    setActivePage(page)
    window.history.replaceState(null, '', pageToHash[page])
    window.scrollTo(0, 0)
  }

  const permittedPage = canPage(activePage) ? activePage : canPage('POS') ? 'POS' : 'Products'
  const ActivePage = pages[permittedPage]
  const props = { onNavigate: navigate }
  return <RetailDataProvider key={session!.userId + ':' + session!.branchId}><ActivePage {...props} /></RetailDataProvider>
}

function App() { return <AuthProvider><AuthenticatedApp /></AuthProvider> }

export default App
