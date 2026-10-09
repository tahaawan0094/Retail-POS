import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { ProductThumb } from '../../shared/ui/ProductThumb'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'
import type { DashboardChartPeriod, DashboardChartPoint, DashboardDateRange, DashboardSnapshot, GlobalSearchResult } from '../../types/desktop-api'
import { useDashboardData } from './useDashboardData'

const money = (paisa: number) => `Rs ${(paisa / 100).toLocaleString('en-PK',{ maximumFractionDigits:0 })}`
const quantity = (milli: number) => (milli / 1000).toLocaleString('en-PK',{ maximumFractionDigits:3 })
const trend = (value: number | null) => value === null ? 'New' : `${value >= 0 ? '↑' : '↓'} ${Math.abs(value)}%`
const toneForActivity = (type: string) => ({ Sale:'green',Product:'blue',Expense:'amber',Purchase:'purple' }[type] ?? 'blue')
const iconForActivity = (type: string): IconName => ({ Sale:'sale',Product:'box',Expense:'expense',Purchase:'cart' }[type] as IconName | undefined) ?? 'report'

function CardHeading({ icon,title,color='blue',actionLabel,onAction }: { icon:IconName; title:string; color?:string; actionLabel?:string; onAction?:()=>void }) {
  return <div className="card-heading"><h2><Icon name={icon} className={`text-${color}`} size={22} />{title}</h2>{actionLabel && <button className="view-all" onClick={onAction}>{actionLabel} <span>→</span></button>}</div>
}

function Sparkline({ points,color='green' }: { points:DashboardChartPoint[]; color?:'green'|'blue' }) {
  const values = points.map(point => color === 'blue' ? point.profitPaisa : point.valuePaisa)
  const maximum = Math.max(...values,1)
  const line = values.map((value,index) => `${index ? 'L' : 'M'}${3 + index * (60 / Math.max(values.length - 1,1))} ${49 - value / maximum * 43}`).join(' ')
  const id = `dashboard-${color}-spark`
  return <svg className={`sparkline ${color}`} viewBox="0 0 66 54" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".19" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs><path d={`${line}V53H3Z`} fill={`url(#${id})`} /><path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function StatCards({ data,onNavigate }: { data:DashboardSnapshot; onNavigate:(page:string)=>void }) {
  const rangeSales = data.selectedRangeLabel === 'This Week' ? 'This Week Sales' : `${data.selectedRangeLabel}'s Sales`
  const rangeProfit = data.selectedRangeLabel === 'This Week' ? 'This Week Profit' : `${data.selectedRangeLabel}'s Profit`
  return <div className="stats-grid">
    <div className="card stat-card green"><span className="round-icon"><Icon name="money" size={24} /></span><p>{rangeSales}</p><strong>{money(data.salesPaisa)}</strong><Sparkline points={data.chart} /><div className="stat-foot"><b className={(data.salesChangePercent ?? 0) < 0 ? 'negative' : ''}>{trend(data.salesChangePercent)}</b><span>{data.comparisonLabel}</span></div></div>
    <div className="card stat-card blue"><span className="round-icon"><Icon name="chart" size={24} /></span><p>{rangeProfit}</p><strong>{money(data.profitPaisa)}</strong><Sparkline points={data.chart} color="blue" /><div className="stat-foot"><b className={(data.profitChangePercent ?? 0) < 0 ? 'negative' : ''}>{trend(data.profitChangePercent)}</b><span>{data.comparisonLabel}</span></div></div>
    <div className="card stat-card amber"><span className="round-icon"><Icon name="box" size={24} /></span><p>Low Stock</p><strong>{data.lowStockCount} Products</strong><Icon name="warning" className="stat-side-icon" /><button className="stat-link" onClick={() => onNavigate('Inventory')}>View Items <Icon name="arrow" size={14} /></button></div>
    <div className="card stat-card rose"><span className="round-icon"><Icon name="users" size={24} /></span><p>Customer Due</p><strong>{money(data.customerDuePaisa)}</strong><Icon name="supplier" className="stat-side-icon" /><button className="stat-link" onClick={() => onNavigate('Customers')}>View Dues <Icon name="arrow" size={14} /></button></div>
  </div>
}

function SalesChart({ data,period,onPeriod }: { data:DashboardSnapshot; period:DashboardChartPeriod; onPeriod:(period:DashboardChartPeriod)=>void }) {
  const maximum = Math.max(...data.chart.map(point => point.valuePaisa),1)
  const ceiling = Math.max(100_000,Math.ceil(maximum / 500_000) * 500_000)
  const x = (index: number) => 38 + index * (497 / Math.max(data.chart.length - 1,1))
  const y = (value: number) => 12 + (1 - value / ceiling) * 180
  const line = data.chart.map((point,index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)} ${y(point.valuePaisa).toFixed(2)}`).join(' ')
  const total = data.chart.reduce((sum,point) => sum + point.valuePaisa,0)
  const visibleLabel = (index: number) => data.chart.length <= 7 || index === 0 || index === data.chart.length - 1 || index % 5 === 0
  const tabs: [string,DashboardChartPeriod][] = [['Today','today'],['7 Days','7_days'],['30 Days','30_days']]
  return <section className="card sales-overview"><div className="card-heading"><h2><Icon name="chart" className="text-blue" size={23} />Sales Overview</h2><div className="period-tabs">{tabs.map(([label,value]) => <button key={value} className={period === value ? 'selected' : ''} onClick={() => onPeriod(value)}>{label}</button>)}</div></div><div className="chart-total">{money(total)}</div><div className="stat-foot"><span>Completed sales for selected chart period</span></div><div className="sales-chart"><svg viewBox="0 0 550 226" role="img" aria-label={`Sales overview with ${data.chart.length} data points`}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#5E0CF3" stopOpacity=".2" /><stop offset="1" stopColor="#5E0CF3" stopOpacity=".02" /></linearGradient></defs>{[0,1,2,3,4,5].map(index => { const value = ceiling * (5-index) / 5; const rowY = 12 + index * 36; return <g key={index}><text x="28" y={rowY+4} textAnchor="end">{value === 0 ? '0' : `${Math.round(value/100000)}K`}</text><line x1="38" x2="535" y1={rowY} y2={rowY} /></g> })}{data.chart.map((point,index) => <g key={`${point.label}-${index}`}>{visibleLabel(index) && <><line x1={x(index)} x2={x(index)} y1="12" y2="192" /><text x={x(index)} y="217" textAnchor="middle">{point.label}</text></>}</g>)}<path d={`${line}V192H38Z`} fill="url(#chart-fill)" /><path d={line} fill="none" stroke="#5E0CF3" strokeWidth="2" />{data.chart.map((point,index) => <circle key={`${point.label}-point`} cx={x(index)} cy={y(point.valuePaisa)} r={data.chart.length > 10 ? 1.8 : 2.5} fill="#5E0CF3"><title>{point.label}: {money(point.valuePaisa)}</title></circle>)}</svg></div></section>
}

const quickActions: [IconName,string,string,string,string][] = [
  ['plus','New Sale','Make a new sale','green','POS'],['plus','Add Product','Add a new product','blue','Products'],['cart','New Purchase','Record a purchase','purple','Purchases'],['users','Add Customer','Add a customer','amber','Customers'],['warning','Add Expense','Record an expense','rose','Expenses'],
]
function QuickActions({ onNavigate }: { onNavigate:(page:string)=>void }) {
  return <section className="card quick-actions"><CardHeading icon="bolt" title="Quick Actions" /><div className="action-list">{quickActions.map(([icon,title,sub,color,page]) => <button key={title} className={`quick-action ${color}`} onClick={() => onNavigate(page)}><span className="round-icon"><Icon name={icon} size={21} /></span><span><strong>{title}</strong><small>{sub}</small></span><Icon name="chevron" size={17} className="right-chevron" /></button>)}</div></section>
}

function MoneyOverview({ data,onNavigate }: { data:DashboardSnapshot; onNavigate:(page:string)=>void }) {
  const rows: [IconName,string,number,string,string][] = [['supplier','Customer Due',data.customerDuePaisa,'rose','Customers'],['supplier','Supplier Due',data.supplierDuePaisa,'amber','Suppliers'],['expense',`${data.selectedRangeLabel}'s Expenses`,data.expensesPaisa,'purple','Expenses'],['cash','Cash in Drawer',data.cashInDrawerPaisa,'green','Cash & Shifts']]
  return <section className="card money-overview"><CardHeading icon="wallet" title="Money Overview" /><div className="money-list">{rows.map(([icon,title,value,color,page]) => <button className={`money-item ${color}`} key={title} onClick={() => onNavigate(page)}><span className="money-icon"><Icon name={icon} size={17} /></span><div><p>{title}</p><strong>{money(value)}</strong></div></button>)}</div></section>
}

function ProductTables({ data,onNavigate }: { data:DashboardSnapshot; onNavigate:(page:string)=>void }) {
  return <><section className="card table-card"><CardHeading icon="crown" title="Top Selling Products" color="amber" actionLabel="View All" onAction={() => onNavigate('Reports')} /><div className="table-wrap"><table className="top-table"><thead><tr><th>#</th><th>Product</th><th>Sold</th></tr></thead><tbody>{data.topProducts.map((product,index) => <tr key={product.id}><td>{index+1}</td><td><div className="product-cell"><ProductThumb kind={product.kind} /><span>{product.name}</span></div></td><td className="sold">{quantity(product.quantityMilli)}</td></tr>)}</tbody></table>{!data.topProducts.length && <div className="dashboard-empty">No completed sales in this period.</div>}</div></section><section className="card table-card"><CardHeading icon="warning" title="Low Stock Products" color="rose" actionLabel="View All" onAction={() => onNavigate('Inventory')} /><div className="table-wrap"><table className="stock-table"><thead><tr><th>Product</th><th>Stock</th><th>Action</th></tr></thead><tbody>{data.lowProducts.map(product => <tr key={product.id}><td><div className="product-cell"><ProductThumb kind={product.kind} /><span>{product.name}</span></div></td><td className="stock-count">{quantity(product.quantityMilli)}</td><td><button className="restock" onClick={() => onNavigate('Purchases')}>Restock</button></td></tr>)}</tbody></table>{!data.lowProducts.length && <div className="dashboard-empty">All products are sufficiently stocked.</div>}</div></section></>
}

function RecentSales({ data,onNavigate }: { data:DashboardSnapshot; onNavigate:(page:string)=>void }) {
  return <section className="card table-card recent-sales"><CardHeading icon="receipt" title="Recent Sales" actionLabel="View All" onAction={() => onNavigate('Sales')} /><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Payment</th></tr></thead><tbody>{data.recentSales.map(sale => <tr key={sale.id}><td>{sale.invoiceNumber}</td><td>{sale.customerName}</td><td className="amount"><b>{money(sale.totalPaisa)}</b></td><td><span className={`payment ${sale.paymentMethod.toLowerCase()}`}>{sale.paymentMethod}</span></td></tr>)}</tbody></table></div></section>
}

function RecentActivity({ data,onNavigate }: { data:DashboardSnapshot; onNavigate:(page:string)=>void }) {
  return <section className="card recent-activity"><CardHeading icon="clock" title="Recent Activity" actionLabel="View All" onAction={() => onNavigate('Reports')} /><div className="activity-list">{data.recentActivity.map(activity => { const color=toneForActivity(activity.type); return <div className="activity-row" key={activity.id}><span className={`activity-dot ${color}`} /><time>{new Date(activity.occurredAt).toLocaleTimeString('en-PK',{ hour:'2-digit',minute:'2-digit' })}</time><span className={`activity-badge ${color}`}>{activity.type}</span><span className="activity-detail">{activity.description}</span><span className="activity-ref">{activity.reference}</span><Icon name={iconForActivity(activity.type)} size={12} /></div> })}</div></section>
}

function StoreIllustration() {
  return <svg className="store-illustration" viewBox="0 0 140 120" aria-hidden="true"><defs><linearGradient id="store-wall" x2="1" y2="1"><stop stopColor="#e3f2ff" /><stop offset="1" stopColor="#82b8f5" /></linearGradient><linearGradient id="store-roof" x2="0" y2="1"><stop stopColor="#729ef9" /><stop offset="1" stopColor="#2859ca" /></linearGradient></defs><ellipse cx="71" cy="109" rx="62" ry="5" fill="#ccddf2" /><path d="M34 51h74v57H34z" fill="url(#store-wall)" stroke="#74a8e3" strokeWidth="2" /><path d="M48 75h21v33H48z" fill="#5b9aee" /><path d="M51 79h15v27H51z" fill="#b9ddfa" /><path d="M77 73h23v18H77z" fill="#4a90eb" /><path d="M80 76h17v12H80z" fill="#c7e9ff" /><rect x="38" y="27" width="67" height="15" rx="4" fill="url(#store-roof)" /><text x="71" y="37" fill="#d4e5ff" textAnchor="middle" fontSize="7" fontWeight="bold">STORE</text><path d="M17 109V83M120 109V83" stroke="#a87949" strokeWidth="4" /><ellipse cx="18" cy="81" rx="11" ry="17" fill="#8dce6b" /><ellipse cx="120" cy="81" rx="10" ry="17" fill="#8ace71" /><path d="M9 110h124" stroke="#375a7e" strokeWidth="3" strokeLinecap="round" /></svg>
}

function GrowthCard({ onNavigate }: { onNavigate:(page:string)=>void }) {
  return <section className="growth-card"><div><h2>Grow Your Business</h2><p>Manage your store efficiently with<br />Vertexia Retail POS</p><div className="benefits">{['Better Stock Control','Track Sales & Profit','Manage Customers','Multi-Store Support'].map(item => <span key={item}><Icon name="check" size={14} />{item}</span>)}</div><button className="reports-button" onClick={() => onNavigate('Reports')}>Explore Reports <Icon name="arrow" size={14} /></button></div><StoreIllustration /></section>
}

function DashboardHeader({ onMenu,data,branchId,onBranch,onNavigate }: { onMenu:()=>void; data:DashboardSnapshot | null; branchId:string; onBranch:(id:string)=>void; onNavigate:(page:string)=>void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [search,setSearch] = useState('')
  const [results,setResults] = useState<GlobalSearchResult[]>([])
  const [searching,setSearching] = useState(false)
  const [showNotifications,setShowNotifications] = useState(false)
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); inputRef.current?.focus() } if (event.key === 'Escape') { setSearch('');setResults([]);setSearching(false);setShowNotifications(false) } }
    window.addEventListener('keydown',shortcut)
    return () => window.removeEventListener('keydown',shortcut)
  },[])
  useEffect(() => {
    if (!window.vertexia || search.trim().length < 2) return
    let active = true
    const timer = window.setTimeout(async () => {
      try { const found = await window.vertexia!.dashboard.search(search,branchId); if (active) setResults(found) }
      catch { if (active) setResults([]) }
      finally { if (active) setSearching(false) }
    },180)
    return () => { active=false;window.clearTimeout(timer) }
  },[search,branchId])
  const selectedBranch = data?.branches.find(branch => branch.id === branchId) ?? data?.branches[0]
  return <header className="topbar dashboard-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field dashboard-search"><Icon name="search" size={19} /><input ref={inputRef} value={search} onChange={event => { const value=event.target.value;setSearch(value);setResults([]);setSearching(value.trim().length>=2) }} aria-label="Search products, customers, invoices and suppliers" placeholder="Search products, customers, invoices, suppliers..." /><kbd>Ctrl K</kbd>{search.trim().length >= 2 && <div className="dashboard-search-results">{searching && <p>Searching…</p>}{!searching && !results.length && <p>No matching records.</p>}{results.map(result => <button key={`${result.type}-${result.id}`} onClick={() => { setSearch('');setResults([]);onNavigate(result.targetPage) }}><span>{result.type}</span><strong>{result.title}</strong><small>{result.subtitle}</small></button>)}</div>}</div><div className="topbar-right"><div className="dashboard-notifications"><button className="icon-button notification-button" aria-label={`${data?.unreadNotifications ?? 0} stock alerts`} onClick={() => setShowNotifications(value => !value)}><Icon name="bell" size={24} />{Boolean(data?.unreadNotifications) && <span>{Math.min(data!.unreadNotifications,99)}</span>}</button>{showNotifications && <div className="dashboard-notification-menu"><strong>Stock Alerts</strong>{data?.lowProducts.map(product => <button key={product.id} onClick={() => onNavigate('Inventory')}><ProductThumb kind={product.kind} /><span>{product.name}<small>{quantity(product.quantityMilli)} remaining</small></span></button>)}{!data?.lowProducts.length && <p>No stock alerts.</p>}</div>}</div><label className="store-switcher dashboard-branch-select"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>{selectedBranch?.name ?? 'Noor Mart'}</strong><small>{selectedBranch?.subtitle ?? 'Main Branch'}</small></span><select value={branchId} onChange={event => onBranch(event.target.value)} aria-label="Select branch">{data?.branches.map(branch => <option value={branch.id} key={branch.id}>{branch.name} — {branch.subtitle}</option>)}</select><Icon name="chevron" size={16} /></label><button className="profile-button" onClick={() => onNavigate('My Account')}><span className="avatar"><Icon name="user" size={26} /></span><span><strong>{data?.userName ?? 'Riyaz Ahmed'}</strong><small>{data?.userRole ?? 'Owner'}</small></span><Icon name="chevron" size={16} /></button></div></header>
}

function DashboardScreen({ data,dateRange,onDateRange,chartPeriod,onChartPeriod,onNavigate }: { data:DashboardSnapshot; dateRange:DashboardDateRange; onDateRange:(range:DashboardDateRange)=>void; chartPeriod:DashboardChartPeriod; onChartPeriod:(period:DashboardChartPeriod)=>void; onNavigate:(page:string)=>void }) {
  const [now,setNow] = useState(() => new Date())
  useEffect(() => { const timer=window.setInterval(() => setNow(new Date()),30_000);return () => window.clearInterval(timer) },[])
  return <motion.main className="dashboard" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.2}}><div className="welcome-row"><div><h1>Good Morning, {data.userName.split(' ')[0]} <span className="wave">👋</span></h1><p>Here's what's happening in your store today.</p></div><div className="date-controls"><span className="date"><Icon name="calendar" size={19} />{now.toLocaleDateString('en-PK',{ weekday:'long',day:'numeric',month:'long',year:'numeric' })}</span><span className="time"><Icon name="clock" size={17} />{now.toLocaleTimeString('en-PK',{ hour:'2-digit',minute:'2-digit' })}</span><select aria-label="Dashboard date range" value={dateRange} onChange={event => onDateRange(event.target.value as DashboardDateRange)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="this_week">This Week</option></select></div></div><StatCards data={data} onNavigate={onNavigate} /><div className="overview-grid"><SalesChart data={data} period={chartPeriod} onPeriod={onChartPeriod} /><QuickActions onNavigate={onNavigate} /><MoneyOverview data={data} onNavigate={onNavigate} /></div><div className="tables-grid"><ProductTables data={data} onNavigate={onNavigate} /><RecentSales data={data} onNavigate={onNavigate} /></div><div className="bottom-grid"><RecentActivity data={data} onNavigate={onNavigate} /><GrowthCard onNavigate={onNavigate} /></div></motion.main>
}

export default function DashboardPage(props: PageProps) {
  const dashboard = useDashboardData()
  const header = (onMenu:()=>void) => <DashboardHeader onMenu={onMenu} data={dashboard.snapshot} branchId={dashboard.branchId} onBranch={dashboard.setBranchId} onNavigate={props.onNavigate} />
  return <PageShell {...props} activePage="Dashboard" header={header}>{dashboard.loading && !dashboard.snapshot ? <main className="dashboard dashboard-state"><section className="card"><span className="dashboard-spinner" /><h1>Loading Dashboard</h1><p>Reading verified figures from the local Vertexia database…</p></section></main> : dashboard.error || !dashboard.snapshot ? <main className="dashboard dashboard-state"><section className="card error"><Icon name="warning" size={28} /><h1>Dashboard unavailable</h1><p>{dashboard.error}</p><button onClick={() => void dashboard.refresh()}>Retry</button></section></main> : <DashboardScreen data={dashboard.snapshot} dateRange={dashboard.dateRange} onDateRange={dashboard.setDateRange} chartPeriod={dashboard.chartPeriod} onChartPeriod={dashboard.setChartPeriod} onNavigate={props.onNavigate} />}</PageShell>
}
