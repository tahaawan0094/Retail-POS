import { Icon, type IconName } from '../ui/Icon'
import { useAuth } from '../../app/auth/useAuth'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { SessionBar } from './SessionIdentity'

const navigation: [IconName, string][] = [['home', 'Dashboard'], ['store', 'POS'], ['sale', 'Sales'], ['box', 'Products'], ['inventory', 'Inventory'], ['inventory', 'Stock Transfers'], ['store', 'Branches'], ['cart', 'Purchases'], ['users', 'Customers'], ['supplier', 'Suppliers'], ['cash', 'Cash & Shifts'], ['expense', 'Expenses'], ['users', 'Staff'], ['report', 'Reports'], ['settings', 'Settings'], ['lock', 'License']]
export function TopNavigation({ activePage, onNavigate }: { activePage: string; onNavigate: (page: string) => void }) {
  const { canPage } = useAuth()
  const navRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const header = headerRef.current!, root = document.documentElement
    const previous = root.style.getPropertyValue('--top-navigation-height')
    const measure = () => root.style.setProperty('--top-navigation-height', Math.ceil(header.getBoundingClientRect().height) + 'px')
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => { observer.disconnect(); if (previous) root.style.setProperty('--top-navigation-height', previous); else root.style.removeProperty('--top-navigation-height') }
  }, [])
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (nav && active) {
      const viewport = nav.getBoundingClientRect(), item = active.getBoundingClientRect()
      if (item.right > viewport.right) nav.scrollLeft += item.right - viewport.right
      else if (item.left < viewport.left) nav.scrollLeft += item.left - viewport.left
    }
  }, [activePage])
  return <header ref={headerRef} className="app-navigation">
    <div className="app-navigation-identity"><button type="button" className="app-navigation-brand" aria-label="Vertexia home" onClick={() => onNavigate(canPage('Dashboard') ? 'Dashboard' : canPage('POS') ? 'POS' : 'Products')}><img src={import.meta.env.BASE_URL + 'Retail_POS_Logo-removebg-preview.png'} alt="" /><span><strong>Vertexia</strong><small>Retail POS</small></span></button><SessionBar /></div>
    <nav ref={navRef} className="top-navigation-tabs" aria-label="Main navigation">{navigation.filter(([, label]) => canPage(label)).map(([icon, label]) => <button type="button" key={label} aria-label={label} onClick={() => onNavigate(label)} className="top-navigation-tab" aria-current={label === activePage ? 'page' : undefined}><Icon name={icon} size={17} /><span>{label}</span></button>)}<button type="button" className="top-navigation-tab top-navigation-account" aria-label="My Account" aria-current={activePage === 'My Account' ? 'page' : undefined} onClick={() => onNavigate('My Account')}><Icon name="user" size={17} /><span>My Account</span></button></nav>
  </header>
}
