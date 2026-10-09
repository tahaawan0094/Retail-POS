import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export type PageProps = {
  onNavigate: (page: string) => void
  sidebarLocked: boolean
  onToggleSidebarLock: () => void
}

type PageShellProps = PageProps & {
  activePage: string
  className?: string
  header: (onMenu: () => void) => ReactNode
  children: ReactNode
}

export function PageShell({ activePage, className = '', header, children, onNavigate, sidebarLocked, onToggleSidebarLock }: PageShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  return <div className={`app-shell ${className} ${collapsed ? 'sidebar-is-collapsed' : ''} ${sidebarLocked ? 'sidebar-locked' : ''}`.trim()}>
    <Sidebar collapsed={collapsed} activePage={activePage} onNavigate={onNavigate} locked={sidebarLocked} onToggleLock={onToggleSidebarLock} />
    <div className="main-shell">{header(() => setCollapsed(value => !value))}{children}</div>
  </div>
}
