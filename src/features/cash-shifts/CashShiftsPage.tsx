import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'

function CashShiftsHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar cash-shifts-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field cash-shifts-global-search"><Icon name="search" size={19} /><input aria-label="Search" placeholder="Search invoices, products, customers..." /><kbd>Ctrl + K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 3 unread"><Icon name="bell" size={24} /><span>3</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>Noor Mart</strong><small>Main Branch</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong>Riyaz Ahmed</strong><small>Owner</small></span><Icon name="chevron" size={16} /></button></div></header>
}

const cashTransactions = [
  ['03 Oct 2026', '01:15 PM', 'Cash Sale', 'Invoice #SAL-2026-105', '+ Rs. 2,450', 'Cash', 'sale'],
  ['03 Oct 2026', '12:30 PM', 'Cash Sale', 'Invoice #SAL-2026-104', '+ Rs. 1,850', 'Cash', 'sale'],
  ['03 Oct 2026', '11:20 AM', 'Customer Payment', 'Received from Ahmed Khan', '+ Rs. 5,000', 'Cash', 'payment'],
  ['03 Oct 2026', '11:05 AM', 'Cash Sale', 'Invoice #SAL-2026-103', '+ Rs. 3,200', 'Cash', 'sale'],
  ['03 Oct 2026', '10:45 AM', 'Cash Sale', 'Invoice #SAL-2026-102', '+ Rs. 1,280', 'Cash', 'sale'],
  ['03 Oct 2026', '10:10 AM', 'Cash Sale', 'Invoice #SAL-2026-101', '+ Rs. 3,450', 'Cash', 'sale'],
  ['03 Oct 2026', '09:45 AM', 'Expense', 'Snacks for staff', '- Rs. 1,200', 'Cash', 'expense'],
  ['03 Oct 2026', '09:30 AM', 'Expense', 'Transport', '- Rs. 2,000', 'Cash', 'expense'],
  ['03 Oct 2026', '09:00 AM', 'Opening Cash', 'Opening cash for shift', '+ Rs. 5,000', 'Cash', 'opening'],
]

function CashShiftStats() {
  const stats: [IconName, string, string, string, string][] = [
    ['cash', 'Opening Cash', 'Rs. 5,000', 'Current Shift', 'green'],
    ['cart', 'Cash Sales', 'Rs. 42,850', 'Today', 'blue'],
    ['arrow', 'Cash Received', 'Rs. 5,000', 'Customer Payments', 'purple'],
    ['arrow', 'Cash Expenses', 'Rs. 3,200', 'Today', 'rose'],
  ]
  return <div className="cash-shift-stats">{stats.map(([icon, label, value, note, tone]) => <section className={`card cash-shift-stat ${tone}`} key={label}><span><Icon name={icon} size={25} /></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></section>)}</div>
}

function ActiveShiftPanel() {
  const [tab, setTab] = useState('Active Shift')
  return <section className="card active-shift-card"><div className="cash-tabs">{['Active Shift', 'Shift History', 'Cash Transactions'].map(label => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}>{label}</button>)}</div><div className="shift-status"><div><i /><span><strong>Shift In Progress</strong><small>Started on 03 Oct 2026 at 09:00 AM</small></span></div><div><small>Cashier</small><span className="cashier-avatar">A</span><span><strong>Ali Raza</strong><small>Cashier</small></span></div><div><small>Shift Duration</small><strong><Icon name="clock" size={16} /> 4h 35m</strong></div></div><div className="cash-transactions-heading"><h2>Recent Cash Transactions</h2><button><Icon name="plus" size={17} /> Add Transaction</button></div><div className="cash-transactions-scroll"><table><thead><tr><th>#</th><th>Date & Time</th><th>Type</th><th>Description</th><th>Amount</th><th>Payment Method</th><th>Added By</th><th>Actions</th></tr></thead><tbody>{cashTransactions.map(([date, time, type, description, amount, method, kind], index) => <tr key={`${time}-${type}`}><td>{index + 1}</td><td><strong>{date}</strong><small>{time}</small></td><td><span className={`cash-type ${kind}`}><Icon name={kind === 'sale' ? 'cart' : kind === 'payment' ? 'cash' : kind === 'expense' ? 'expense' : 'cash'} size={15} />{type}</span></td><td>{description}</td><td className={amount.startsWith('+') ? 'cash-positive' : 'cash-negative'}>{amount}</td><td>{method}</td><td><span className="cash-added-by"><i>A</i>Ali Raza</span></td><td><button className="cash-more" aria-label={`More actions for transaction ${index + 1}`}>•••</button></td></tr>)}</tbody></table></div></section>
}

function ShiftActions() {
  const actions: [IconName, string, string][] = [['plus', 'Add Cash Transaction', ''], ['expense', 'Add Expense', ''], ['arrow', 'Cash Deposit', 'deposit'], ['arrow', 'Cash Withdrawal', 'withdrawal']]
  return <section className="card shift-actions"><div className="cash-side-heading"><h2><Icon name="cash" size={18} /> Shift Actions</h2><button><Icon name="settings" size={15} /> Shift Settings</button></div><div className="shift-action-grid"><button className="close-shift"><Icon name="clock" size={17} /> Close Shift</button>{actions.map(([icon, label, tone]) => <button className={tone} key={label}><Icon name={icon} size={17} />{label}</button>)}</div></section>
}

function CurrentShiftSummary() {
  const rows: [IconName, string, string, string][] = [['cash', 'Opening Cash', 'Rs. 5,000', 'green'], ['cart', 'Cash Sales', 'Rs. 42,850', 'blue'], ['supplier', 'Cash Returns', 'Rs. 0', 'rose'], ['cash', 'Customer Payments', 'Rs. 5,000', 'blue'], ['expense', 'Expenses', 'Rs. 3,200', 'rose']]
  return <section className="card current-shift-summary"><div className="cash-side-heading"><h2><Icon name="receipt" size={18} /> Current Shift Summary</h2></div><div className="shift-summary-list">{rows.map(([icon, label, value, tone]) => <div className={tone} key={label}><span><Icon name={icon} size={14} />{label}</span><strong>{value}</strong></div>)}</div><div className="expected-cash"><span>Expected Closing Cash</span><strong>Rs. 49,650</strong></div><label className="actual-cash"><span>Actual Closing Cash</span><span><input value="49650" readOnly /><b>Rs.</b></span></label><div className="cash-difference"><span>Difference</span><strong>Rs. 0</strong></div></section>
}

function TodayCashSummary() {
  const rows = [['Cash Sales', 'Rs. 42,850', '#2679e8'], ['Customer Payments', 'Rs. 5,000', '#1b76b8'], ['Cash Expenses', 'Rs. 3,200', '#f3a13b'], ['Cash Returns', 'Rs. 0', '#ec395d']]
  return <section className="card today-cash-summary"><div className="cash-side-heading"><h2><Icon name="plus" size={18} /> Today's Cash Summary</h2></div><div className="cash-chart-wrap"><div className="cash-donut"><div><strong>Rs. 47,850</strong><small>Net Cash</small></div></div><div className="cash-chart-legend">{rows.map(([label, value, color]) => <div key={label}><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>)}</div></div></section>
}

function CashShiftsScreen() {
  return <motion.main className="cash-shifts-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}><div className="cash-shifts-title-row"><div className="cash-shifts-title"><span><Icon name="cash" size={28} /></span><div><h1>Cash &amp; Shifts</h1><p>Manage cash drawers, shifts and cash transactions</p></div></div><button className="open-shift"><Icon name="plus" size={18} /> Open New Shift</button></div><CashShiftStats /><div className="cash-shifts-layout"><ActiveShiftPanel /><aside className="cash-shifts-side"><ShiftActions /><CurrentShiftSummary /><TodayCashSummary /></aside></div></motion.main>
}


export default function CashShiftsPage(props: PageProps) { return <PageShell {...props} activePage="Cash & Shifts" className="cash-shifts-app" header={onMenu => <CashShiftsHeader onMenu={onMenu} />}><CashShiftsScreen /></PageShell> }
