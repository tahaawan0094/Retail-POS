import type { ReactNode } from 'react'

export type IconName = 'home' | 'store' | 'sale' | 'box' | 'inventory' | 'cart' | 'users' | 'supplier' | 'cash' | 'expense' | 'report' | 'settings' | 'user' | 'menu' | 'search' | 'bell' | 'chevron' | 'calendar' | 'clock' | 'chart' | 'bolt' | 'wallet' | 'plus' | 'arrow' | 'warning' | 'crown' | 'receipt' | 'check' | 'money' | 'lock'
const paths: Record<IconName, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10H14v-6h-4v6H3z" />,
  store: <path d="M4 10v11h16V10M3 10l2-7h14l2 7M3 10q2 4 5 0 2 4 4 0 2 4 4 0 3 4 5 0M9 21v-7h6v7M6 3v-1h12v1" />,
  sale: <path d="M5 9h4l3-6 3 1-1 5h6l-2 12H8L5 18zM3 9h4v11H3z" />,
  box: <path d="m3 7 9-4 9 4v11l-9 4-9-4zM3 7l9 5 9-5M12 12v10M7 5l9 5" />,
  inventory: <path d="M4 8h16v13H4zM3 5h18v3H3zM9 3h6M12 11v7M9 14h6" />,
  cart: <><path d="M2 3h3l3 13h11l3-10H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  users: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-4a6 6 0 0 1 12 0v4zM16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2" /></>,
  supplier: <><circle cx="15" cy="8" r="5" /><path d="M11 8h8M15 5v6M3 16l5-4 5 3 6-2 2 3-8 5H6l-3-3z" /></>,
  cash: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3" /><circle cx="12" cy="14" r="3" /><path d="M12 12v4" /></>,
  expense: <path d="M4 8h16v13H4zM8 8V5h8v3M9 4h6M9 14h6M12 11v6" />,
  report: <path d="M5 2h9l5 5v15H5zM14 2v6h5M9 17v-5M12 17v-3M15 17v-7" />,
  settings: <><path d="m9 3 1-2h4l1 2 3 2 2 1-1 4v4l1 4-2 1-3 2-1 2h-4l-1-2-3-2-2-1 1-4v-4L4 6l2-1z" /><circle cx="12" cy="12" r="3" /></>,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3z" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  search: <><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></>,
  bell: <path d="M5 17h14l-2-4V8a5 5 0 0 0-10 0v5zM10 21h4M12 2V1" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  calendar: <><rect x="3" y="5" width="18" height="17" rx="2" /><path d="M7 2v6M17 2v6M3 10h18M7 14h2M12 14h2M17 14h1M7 18h2M12 18h2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  chart: <path d="M3 21V14h4v7zM10 21V9h4v12zM17 21V3h4v18z" />,
  bolt: <path d="m13 2-8 12h6l-1 8 9-13h-6z" />,
  wallet: <path d="M21 8H4V5l13-3v6M4 8v13h17V8M16 12h6v5h-6zM18 14.5h.1" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h16m-5-5 5 5-5 5" />,
  warning: <path d="m12 3 10 18H2zM12 9v5M12 17h.01" />,
  crown: <><path d="m3 7 5 4 4-8 4 8 5-4-2 14H5zM5 17h14" /><circle cx="3" cy="5" r="1" /><circle cx="12" cy="2" r="1" /><circle cx="21" cy="5" r="1" /></>,
  receipt: <path d="M5 2h14v20l-3-2-4 2-4-2-3 2zM8 6h8M8 10h8M8 14h5" />,
  check: <path d="m5 12 4 4L19 6" />,
  money: <><circle cx="12" cy="12" r="9" /><path d="M15 8h-5a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9M12 6v12" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
}
export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
