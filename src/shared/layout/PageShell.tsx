import type { ReactNode } from 'react'
import { TopNavigation } from './TopNavigation'
import { LicenseNotice } from '../../features/licensing/LicenseNotice'

export type PageProps = {
  onNavigate: (page: string) => void
}

type PageShellProps = PageProps & {
  activePage: string
  className?: string
  header: (onMenu: () => void) => ReactNode
  children: ReactNode
}

export function PageShell({ activePage, className = '', header, children, onNavigate }: PageShellProps) {
  return <div className={`app-shell top-navigation-shell ${className}`.trim()}>
    <TopNavigation activePage={activePage} onNavigate={onNavigate} />
    <div className="main-shell">{header(() => window.scrollTo({ top: 0, behavior: 'smooth' }))}{activePage !== 'License' && <LicenseNotice onNavigate={onNavigate} />}{children}</div>
  </div>
}
