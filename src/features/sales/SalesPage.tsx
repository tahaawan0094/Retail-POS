import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'

const salesTransactions = [
  ['INV-1024', '2 Oct, 10:42 AM', 'Walk-in Customer', '5', 'Rs 1,250', 'Cash', 'Completed'],
  ['INV-1023', '2 Oct, 10:31 AM', 'Ahmed Khan', '8', 'Rs 3,400', 'Udhaar', 'Pending'],
  ['INV-1022', '2 Oct, 10:18 AM', 'Walk-in Customer', '3', 'Rs 850', 'Card', 'Completed'],
  ['INV-1021', '2 Oct, 09:54 AM', 'Ali Raza', '6', 'Rs 2,100', 'Easypaisa', 'Completed'],
  ['INV-1020', '2 Oct, 09:37 AM', 'Fatima Noor', '4', 'Rs 980', 'Cash', 'Completed'],
  ['INV-1019', '2 Oct, 09:12 AM', 'Walk-in Customer', '2', 'Rs 560', 'JazzCash', 'Completed'],
]

function SalesHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar sales-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field"><Icon name="search" size={19} /><input aria-label="Search sales" placeholder="Search invoices, customers, products..." /><kbd>⌘ K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 3 unread"><Icon name="bell" size={24} /><span>3</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>Noor Mart</strong><small>Main Branch</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong>Riyaz Ahmed</strong><small>Owner</small></span><Icon name="chevron" size={16} /></button></div></header>
}

function SalesRevenueChart() {
  const [range, setRange] = useState('This Week')
  const points = [[50, 184], [143, 143], [236, 158], [329, 92], [422, 119], [515, 66], [608, 84], [701, 31]]
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ')
  return <section className="card sales-revenue-card"><div className="sales-section-heading"><div><h2>Sales Overview</h2><p>Revenue performance over time</p></div><div className="sales-range-tabs">{['Today', 'This Week', 'This Month'].map(item => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div><div className="sales-chart-value"><strong>Rs 125,450</strong><span>↑ 12.4% <small>vs last week</small></span></div><div className="revenue-chart"><svg viewBox="0 0 750 245" role="img" aria-label="Sales revenue chart"><defs><linearGradient id="sales-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#5E0CF3" stopOpacity=".22" /><stop offset="1" stopColor="#5E0CF3" stopOpacity=".02" /></linearGradient></defs>{[0, 1, 2, 3, 4].map(index => <g key={index}><line x1="49" x2="715" y1={28 + index * 43} y2={28 + index * 43} /><text x="38" y={32 + index * 43} textAnchor="end">{`${150 - index * 30}K`}</text></g>)}<path d={`${line} L701 200 L50 200 Z`} fill="url(#sales-area)" /><path d={line} fill="none" stroke="#5E0CF3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map(([x, y]) => <circle key={x} cx={x} cy={y} r="4" fill="#fff" stroke="#5E0CF3" strokeWidth="3" />)}{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Today'].map((day, index) => <text key={day} x={points[index][0]} y="229" textAnchor="middle">{day}</text>)}</svg></div></section>
}

function PaymentBreakdown() {
  const methods = [['Cash', 'Rs 62,725', '50%', '#0aa47b'], ['Card', 'Rs 27,599', '22%', '#5E0CF3'], ['Easypaisa', 'Rs 17,563', '14%', '#9a56f7'], ['JazzCash', 'Rs 11,291', '9%', '#ee9a17'], ['Udhaar', 'Rs 6,272', '5%', '#e54563']]
  return <section className="card payment-breakdown"><div className="sales-section-heading"><div><h2>Payment Methods</h2><p>Sales by payment type</p></div><button className="view-all">View Report →</button></div><div className="donut-wrap"><div className="payment-donut"><div><strong>Rs 125K</strong><small>Total Sales</small></div></div></div><div className="payment-legend">{methods.map(([name, value, percent, color]) => <div key={name}><i style={{ background: color }} /><span>{name}</span><strong>{value}</strong><small>{percent}</small></div>)}</div></section>
}

function SalesTransactions() {
  return <section className="card sales-transactions"><div className="sales-section-heading"><div><h2>Recent Sales</h2><p>Latest transactions from your store</p></div><div className="sales-table-actions"><button><Icon name="report" size={15} /> Export</button><button className="primary"><Icon name="plus" size={15} /> New Sale</button></div></div><div className="sales-table-scroll"><table><thead><tr><th>Invoice</th><th>Date & Time</th><th>Customer</th><th>Items</th><th>Amount</th><th>Payment</th><th>Status</th><th /></tr></thead><tbody>{salesTransactions.map(([invoice, date, customer, items, amount, payment, status]) => <tr key={invoice}><td><b>{invoice}</b></td><td>{date}</td><td>{customer}</td><td>{items}</td><td><strong>{amount}</strong></td><td><span className={`sales-payment ${payment.toLowerCase()}`}>{payment}</span></td><td><span className={`sales-status ${status.toLowerCase()}`}>{status}</span></td><td><button className="more-button">⋮</button></td></tr>)}</tbody></table></div><div className="sales-pagination"><span>Showing 1 to 6 of 1,248 sales</span><div><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div></div></section>
}

function SalesScreen() {
  return <motion.main className="sales-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .25 }}><div className="sales-page-title"><div><h1>Sales</h1><p>Track and manage all your store sales</p></div><div className="sales-page-actions"><button className="sales-date"><Icon name="calendar" size={17} /> 26 Sep - 2 Oct 2026 <Icon name="chevron" size={14} /></button><button className="sales-new"><Icon name="plus" size={17} /> New Sale</button></div></div><div className="sales-kpis">{[
    ['money', 'Total Sales', 'Rs 125,450', '↑ 12.4%', 'vs last week', 'green'],
    ['receipt', 'Transactions', '1,248', '↑ 8.2%', 'vs last week', 'blue'],
    ['chart', 'Average Order', 'Rs 1,005', '↑ 3.1%', 'vs last week', 'purple'],
    ['expense', 'Returns & Refunds', 'Rs 4,850', '↓ 1.8%', 'vs last week', 'rose'],
  ].map(([icon, label, value, trend, compare, color]) => <section className={`card sales-kpi ${color}`} key={label}><span className="round-icon"><Icon name={icon as IconName} size={22} /></span><div><p>{label}</p><strong>{value}</strong><small><b>{trend}</b> {compare}</small></div></section>)}</div><div className="sales-insights"><SalesRevenueChart /><PaymentBreakdown /></div><SalesTransactions /></motion.main>
}


export default function SalesPage(props: PageProps) { return <PageShell {...props} activePage="Sales" className="sales-app" header={onMenu => <SalesHeader onMenu={onMenu} />}><SalesScreen /></PageShell> }
