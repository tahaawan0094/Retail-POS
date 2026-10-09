import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'

function CustomersHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar customers-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field customers-global-search"><Icon name="search" size={19} /><input aria-label="Search customers" placeholder="Search customers by name, phone, CNIC..." /><kbd>Ctrl + K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 2 unread"><Icon name="bell" size={24} /><span>2</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>Noor Mart</strong><small>Main Branch</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong>Riyaz Ahmed</strong><small>Owner</small></span><Icon name="chevron" size={16} /></button></div></header>
}

const customerRows = [
  ['AK', 'Ahmed Khan', '0301 2345678', 'Rs. 125,400', 'Rs. 100,000', 'Rs. 25,400', '02 Oct 2026', 'Active', 'blue'],
  ['BT', 'Bilal Traders', '0321 9876543', 'Rs. 450,800', 'Rs. 300,000', 'Rs. 150,800', '01 Oct 2026', 'Active', 'violet'],
  ['ZA', 'Zara Ali', '0305 1122334', 'Rs. 28,600', 'Rs. 28,600', 'Rs. 0', '29 Sep 2026', 'Active', 'pink'],
  ['KG', 'Karachi General Store', '0333 4455667', 'Rs. 220,900', 'Rs. 120,000', 'Rs. 100,900', '28 Sep 2026', 'Active', 'teal'],
  ['UR', 'Usman Retail', '0312 7788990', 'Rs. 65,400', 'Rs. 65,400', 'Rs. 0', '27 Sep 2026', 'Active', 'slate'],
  ['HS', 'Hina Store', '0322 6677889', 'Rs. 12,500', 'Rs. 5,000', 'Rs. 7,500', '25 Sep 2026', 'Active', 'orange'],
  ['IF', 'Imran Foods', '0300 9988776', 'Rs. 310,200', 'Rs. 310,200', 'Rs. 0', '24 Sep 2026', 'Inactive', 'red'],
  ['RM', 'Rehman Mart', '0315 6677880', 'Rs. 95,600', 'Rs. 70,600', 'Rs. 25,000', '22 Sep 2026', 'Active', 'brown'],
  ['AC', 'Ayesha Cosmetics', '0331 4455662', 'Rs. 48,300', 'Rs. 48,300', 'Rs. 0', '20 Sep 2026', 'Active', 'cyan'],
  ['FK', 'Faizan Kiryana', '0320 3344556', 'Rs. 78,900', 'Rs. 30,000', 'Rs. 48,900', '18 Sep 2026', 'Active', 'yellow'],
]

function CustomerStats() {
  const stats: [IconName, string, string, string, string, string][] = [
    ['users', 'Total Customers', '248', 'All registered customers', '↑ 12%', 'purple'],
    ['cart', 'Total Purchases', 'Rs. 1,856,400', 'Total sales to customers', '↑ 18%', 'green'],
    ['wallet', 'Total Received', 'Rs. 1,450,000', 'Total payments received', '↑ 15%', 'amber'],
    ['receipt', 'Outstanding Amount', 'Rs. 406,400', 'Total customer due', '↑ 8%', 'rose'],
  ]
  return <div className="customer-stats">{stats.map(([icon, label, value, note, trend, tone]) => <section className={`card customer-stat ${tone}`} key={label}><span><Icon name={icon} size={24} /></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div><b className={tone === 'rose' ? 'negative' : ''}>{trend}</b></section>)}</div>
}

function CustomersTable() {
  const [tab, setTab] = useState('All Customers')
  return <section className="card customers-table-card"><div className="customer-tabs">{['All Customers', 'Credit Customers', 'Active', 'Inactive'].map(label => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}>{label}</button>)}</div><div className="customer-filters"><label><Icon name="search" size={17} /><input aria-label="Search customer list" placeholder="Search customers by name, phone, CNIC..." /></label>{['All Status', 'All Cities', 'All Groups'].map(label => <button key={label}>{label}<Icon name="chevron" size={14} /></button>)}<button className="clear">Clear</button></div><div className="customers-table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all customers" /></th><th>Customer Name</th><th>Phone</th><th>Total Purchases</th><th>Total Paid</th><th>Outstanding</th><th>Last Purchase</th><th>Status</th><th>Actions</th></tr></thead><tbody>{customerRows.map(([initials, name, phone, purchases, paid, outstanding, lastPurchase, status, tone]) => <tr key={name}><td><input type="checkbox" aria-label={`Select ${name}`} /></td><td><div className="customer-name"><span className={tone}>{initials}</span><strong>{name}</strong></div></td><td>{phone}</td><td>{purchases}</td><td>{paid}</td><td className={outstanding === 'Rs. 0' ? 'settled' : 'customer-due'}>{outstanding}</td><td>{lastPurchase}</td><td><span className={`customer-status ${status.toLowerCase()}`}>{status}</span></td><td><button className="customer-more" aria-label={`More actions for ${name}`}>•••</button></td></tr>)}</tbody></table></div><div className="customer-pagination"><span>Showing 1 to 10 of 248 entries</span><div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button>…</button><button>25</button><button className="page-size">10 / page <Icon name="chevron" size={13} /></button></div></div></section>
}

function CustomerDetails() {
  const [tab, setTab] = useState('Purchase History')
  const history = [['02 Oct 2026', 'SAL-2026-105', '5', 'Rs. 2,450'], ['28 Sep 2026', 'SAL-2026-098', '12', 'Rs. 5,800'], ['20 Sep 2026', 'SAL-2026-087', '8', 'Rs. 3,220'], ['15 Sep 2026', 'SAL-2026-076', '15', 'Rs. 7,450'], ['10 Sep 2026', 'SAL-2026-061', '6', 'Rs. 2,180']]
  return <section className="card customer-details"><div className="customer-profile"><div className="customer-profile-heading"><span>AK</span><div><h2>Ahmed Khan</h2><small>Active</small></div><button>⌕ &nbsp; Edit</button></div><ul><li>● <span>0301 2345678</span></li><li>◆ <span>Karachi, Pakistan</span></li><li>▣ <span>Customer Since: 15 Jan 2026</span></li><li>◆ <span>Group: General</span></li><li>◩ <span>No notes available</span></li></ul><div className="customer-balance-cards"><div><small>Total Purchases</small><strong>Rs. 125,400</strong></div><div><small>Total Paid</small><strong>Rs. 100,000</strong></div><div><small>Outstanding</small><strong>Rs. 25,400</strong></div></div><div className="customer-profile-actions"><button className="primary"><Icon name="money" size={16} /> Receive Payment</button><button><Icon name="cart" size={16} /> New Sale</button></div></div><div className="customer-history-tabs">{['Purchase History', 'Payment History', 'Ledger'].map(label => <button className={tab === label ? 'active' : ''} onClick={() => setTab(label)} key={label}>{label}</button>)}</div><div className="customer-history-scroll"><table><thead><tr><th>Date</th><th>Invoice #</th><th>Items</th><th>Total</th></tr></thead><tbody>{history.map(row => <tr key={row[1]}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div><button className="view-customer-purchases">View All Purchases</button></section>
}

function RecentCustomerPayments() {
  const payments = [['01 Oct 2026', 'Cash', 'Rs. 20,000'], ['22 Sep 2026', 'Easypaisa', 'Rs. 30,000'], ['12 Sep 2026', 'Cash', 'Rs. 25,000'], ['05 Sep 2026', 'JazzCash', 'Rs. 25,000']]
  return <section className="card recent-customer-payments"><div className="customer-side-heading"><h2><Icon name="money" size={18} /> Recent Payments</h2><button>View All</button></div><table><thead><tr><th>Date</th><th>Method</th><th>Amount</th></tr></thead><tbody>{payments.map(row => <tr key={row[0]}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
}

function CustomersScreen() {
  return <motion.main className="customers-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}><div className="customers-title-row"><div className="customers-title"><span><Icon name="users" size={28} /></span><div><h1>Customers</h1><p>Manage customer records, credit (udhaar) and transaction history</p></div></div><button className="add-customer"><Icon name="plus" size={18} /> Add Customer</button></div><CustomerStats /><div className="customers-layout"><CustomersTable /><aside className="customers-side"><CustomerDetails /><RecentCustomerPayments /></aside></div></motion.main>
}


export default function CustomersPage(props: PageProps) { return <PageShell {...props} activePage="Customers" className="customers-app" header={onMenu => <CustomersHeader onMenu={onMenu} />}><CustomersScreen /></PageShell> }
