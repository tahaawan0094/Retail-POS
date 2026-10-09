import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { ProductThumb } from '../../shared/ui/ProductThumb'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'

function ReportsHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar reports-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field reports-global-search"><Icon name="search" size={19} /><input aria-label="Search reports" placeholder="Search reports (sales, profit, inventory, customers, suppliers...)" /><kbd>Ctrl + K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 3 unread"><Icon name="bell" size={24} /><span>3</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>Noor Mart</strong><small>Main Branch</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong>Riyaz Ahmed</strong><small>Owner</small></span><Icon name="chevron" size={16} /></button></div></header>
}

function ReportStats() {
  const stats: [IconName, string, string, string, string, string][] = [
    ['cart', 'Total Sales', 'Rs. 2,485,600', '1,258 invoices', '↑ 12%', 'green'],
    ['box', 'Gross Profit', 'Rs. 642,300', '25.8% margin', '↑ 18%', 'blue'],
    ['wallet', 'Total Expenses', 'Rs. 186,750', '7.5% of sales', '↑ 6%', 'amber'],
    ['money', 'Net Profit', 'Rs. 455,550', '18.3% margin', '↑ 15%', 'purple'],
  ]
  return <div className="report-stats">{stats.map(([icon, label, value, note, trend, tone]) => <section className={`card report-stat ${tone}`} key={label}><span><Icon name={icon} size={24} /></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div><b className={label === 'Total Expenses' ? 'negative' : ''}>{trend}<small>vs last month</small></b></section>)}</div>
}

function ReportTabs() {
  const [tab, setTab] = useState('Sales')
  return <div className="report-tabs">{['Sales', 'Profit & Loss', 'Inventory', 'Purchases', 'Customers', 'Suppliers', 'Expenses', 'Cash Flow', 'Staff', 'Tax Report'].map(label => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}>{label}</button>)}</div>
}

function ReportSalesTrend() {
  const points = [[42,130], [76,120], [111,111], [145,91], [180,124], [215,117], [249,101], [284,122], [319,119], [353,113], [388,83], [423,76], [457,101], [492,90], [527,77], [561,56], [596,72], [631,61], [665,43], [700,36], [735,56]]
  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  return <section className="card report-trend"><div className="report-section-heading"><h2><Icon name="chart" size={18} /> Sales Trend</h2><button>Daily <Icon name="chevron" size={13} /></button></div><div className="report-line-chart"><svg viewBox="0 0 770 185" role="img" aria-label="Daily sales trend for October"><defs><linearGradient id="report-sales-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#5E0CF3" stopOpacity=".2" /><stop offset="1" stopColor="#5E0CF3" stopOpacity=".02" /></linearGradient></defs>{[0,1,2,3,4].map(i => <g key={i}><line x1="42" x2="735" y1={20+i*34} y2={20+i*34} /><text x="31" y={24+i*34} textAnchor="end">{200-i*50},000</text></g>)}{[42,180,353,492,735].map((x,i) => <g key={x}><line x1={x} x2={x} y1="20" y2="156" /><text x={x} y="177" textAnchor="middle">{['01 Oct','05 Oct','15 Oct','20 Oct','31 Oct'][i]}</text></g>)}<path d={`${path} L735 156 L42 156 Z`} fill="url(#report-sales-fill)" /><path d={path} fill="none" stroke="#5E0CF3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{points.map(([x,y]) => <circle key={x} cx={x} cy={y} r="3" fill="#fff" stroke="#5E0CF3" strokeWidth="2" />)}</svg></div></section>
}

function SalesCategoryReport() {
  const rows = [['Beverages', '28%', 'Rs. 695,200', '#176be8'], ['Groceries', '22%', 'Rs. 546,800', '#f8b515'], ['Snacks', '15%', 'Rs. 372,600', '#ffbd1c'], ['Household', '12%', 'Rs. 298,300', '#ef3d64'], ['Personal Care', '9%', 'Rs. 223,700', '#9c4ee9'], ['Dairy', '7%', 'Rs. 173,000', '#2ba8dc'], ['Others', '7%', 'Rs. 175,000', '#6659de']]
  return <section className="card report-category"><div className="report-section-heading"><h2><Icon name="users" size={18} /> Sales by Category</h2><button>This Month <Icon name="chevron" size={13} /></button></div><div className="report-category-body"><div className="report-category-donut"><span><strong>Rs. 2,485,600</strong><small>Total Sales</small></span></div><div className="report-category-legend">{rows.map(([label, percent, value, color]) => <div key={label}><i style={{ background: color }} /><span>{label}</span><b>{percent}</b><strong>{value}</strong></div>)}</div></div></section>
}

function TopSellingReport() {
  const rows = [['cola', 'Coca Cola 1.5L', 'Beverages', '842', 'Rs. 185,240'], ['lays', 'Lays Classic 52g', 'Snacks', '690', 'Rs. 82,800'], ['shan', 'Nescafe 3in1', 'Beverages', '520', 'Rs. 78,000'], ['surf', 'Surf Excel 1kg', 'Household', '410', 'Rs. 73,800'], ['milk', 'Nestle Milk Pack 1L', 'Dairy', '395', 'Rs. 71,100']]
  return <section className="card report-table-card"><div className="report-section-heading"><h2><Icon name="crown" size={18} /> Top Selling Products</h2><button className="link">View All</button></div><table><thead><tr><th>#</th><th>Product</th><th>Category</th><th>Quantity Sold</th><th>Total Sales</th></tr></thead><tbody>{rows.map(([kind,name,category,qty,total], i) => <tr key={name}><td>{i+1}</td><td><div><ProductThumb kind={kind} /><strong>{name}</strong></div></td><td>{category}</td><td>{qty}</td><td>{total}</td></tr>)}</tbody></table></section>
}

function PaymentMethodReport() {
  const rows = [['Cash','62%','Rs. 1,540,700','#176be8'], ['JazzCash','14%','Rs. 347,980','#f6b413'], ['Easypaisa','9%','Rs. 223,700','#ef4b6d'], ['Card','7%','Rs. 173,600','#a64de5'], ['Udhaar (Credit)','8%','Rs. 199,620','#e63350']]
  return <section className="card report-payment"><div className="report-section-heading"><h2><Icon name="cash" size={18} /> Payment Method Breakdown</h2></div><div className="report-payment-donut"><span><strong>Rs. 2,485,600</strong><small>Total Sales</small></span></div><div className="report-payment-legend">{rows.map(([label,percent,value,color]) => <div key={label}><i style={{background:color}} /><span>{label}</span><b>{percent}</b><strong>{value}</strong></div>)}</div></section>
}

function SalesByStaffReport() {
  const rows = [['AR','Ali Raza','520','Rs. 1,035,600','blue'], ['SK','Sana Khan','310','Rs. 620,450','orange'], ['BH','Bilal Hussain','220','Rs. 415,300','pink'], ['AK','Ahmed Khan','150','Rs. 288,600','violet'], ['FA','Fatima Ali','58','Rs. 125,650','green']]
  return <section className="card report-table-card staff-sales-report"><div className="report-section-heading"><h2><Icon name="users" size={18} /> Sales by Staff</h2><button className="link">View All</button></div><table><thead><tr><th>#</th><th>Staff Name</th><th>Invoices</th><th>Total Sales</th></tr></thead><tbody>{rows.map(([initials,name,invoices,total,tone],i) => <tr key={name}><td>{i+1}</td><td><div className="report-staff-name"><i className={tone}>{initials}</i><strong>{name}</strong></div></td><td>{invoices}</td><td>{total}</td></tr>)}</tbody></table></section>
}

function RecentSalesReport() {
  const rows = [['31 Oct 2026 04:25 PM','SAL-2026-1258','Walk-in Customer','Cash','Rs. 2,450'], ['31 Oct 2026 04:18 PM','SAL-2026-1257','Ahmed Khan','Udhaar','Rs. 3,200'], ['31 Oct 2026 03:52 PM','SAL-2026-1256','Walk-in Customer','JazzCash','Rs. 1,850'], ['31 Oct 2026 03:40 PM','SAL-2026-1255','Zara Ali','Card','Rs. 4,320'], ['31 Oct 2026 03:15 PM','SAL-2026-1254','Walk-in Customer','Cash','Rs. 980']]
  return <section className="card report-table-card recent-sales-report"><div className="report-section-heading"><h2><Icon name="report" size={18} /> Recent Sales</h2><button className="link">View All</button></div><table><thead><tr><th>Date &amp; Time</th><th>Invoice #</th><th>Customer</th><th>Payment Method</th><th>Total</th></tr></thead><tbody>{rows.map(([date,invoice,customer,payment,total]) => <tr key={invoice}><td>{date}</td><td>{invoice}</td><td>{customer}</td><td><span className={`report-payment-pill ${payment.toLowerCase()}`}>{payment}</span></td><td>{total}</td></tr>)}</tbody></table></section>
}

function ReportSummary() {
  const left = [['Total Sales','Rs. 2,485,600'], ['Total Cost','Rs. 1,843,300'], ['Gross Profit','Rs. 642,300'], ['Total Expenses','Rs. 186,750']]
  const right = [['Total Invoices','1,258'], ['Items Sold','8,645'], ['Average Invoice Value','Rs. 1,975'], ['New Customers','36'], ['Returning Customers','212']]
  return <section className="card report-summary"><div className="report-section-heading"><h2><Icon name="report" size={18} /> Summary</h2></div><div><div>{left.map(([label,value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}<p className="net-profit"><span>Net Profit</span><strong>Rs. 455,550</strong></p></div><div>{right.map(([label,value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}</div></div></section>
}

function ReportsScreen() {
  return <motion.main className="reports-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}><div className="reports-title-row"><div className="reports-title"><span><Icon name="chart" size={28} /></span><div><h1>Reports</h1><p>Detailed insights into your business performance</p></div></div><div className="reports-controls"><button><Icon name="calendar" size={16} />01 Oct 2026&nbsp; - &nbsp;31 Oct 2026<Icon name="chevron" size={14} /></button><button>All Branches<Icon name="chevron" size={14} /></button><button className="export">Export Report<Icon name="chevron" size={14} /></button></div></div><ReportStats /><ReportTabs /><div className="reports-primary-grid"><ReportSalesTrend /><SalesCategoryReport /></div><div className="reports-secondary-grid"><TopSellingReport /><PaymentMethodReport /><SalesByStaffReport /></div><div className="reports-bottom-grid"><RecentSalesReport /><ReportSummary /></div></motion.main>
}


export default function ReportsPage(props: PageProps) { return <PageShell {...props} activePage="Reports" className="reports-app" header={onMenu => <ReportsHeader onMenu={onMenu} />}><ReportsScreen /></PageShell> }
