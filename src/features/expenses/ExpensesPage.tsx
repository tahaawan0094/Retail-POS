import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'

function ExpensesHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar expenses-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field expenses-global-search"><Icon name="search" size={19} /><input aria-label="Search expenses" placeholder="Search expenses by description, category, date..." /><kbd>Ctrl + K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 3 unread"><Icon name="bell" size={24} /><span>3</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>Noor Mart</strong><small>Main Branch</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong>Riyaz Ahmed</strong><small>Owner</small></span><Icon name="chevron" size={16} /></button></div></header>
}

const expenseRows = [
  ['EXP-2026-001', '03 Oct 2026', 'Electricity Bill (KE)', 'Utilities', 'Rs. 18,500', 'Cash', 'A', 'Ali Raza', 'blue'],
  ['EXP-2026-002', '01 Oct 2026', 'Shop Rent - October', 'Rent', 'Rs. 60,000', 'Bank Transfer', 'R', 'Riyaz Ahmed', 'rose'],
  ['EXP-2026-003', '29 Sep 2026', 'Staff Salaries', 'Salaries', 'Rs. 45,000', 'Bank Transfer', 'R', 'Riyaz Ahmed', 'amber'],
  ['EXP-2026-004', '27 Sep 2026', 'Shop Maintenance', 'Maintenance', 'Rs. 8,500', 'Cash', 'A', 'Ali Raza', 'purple'],
  ['EXP-2026-005', '25 Sep 2026', 'Internet Bill', 'Utilities', 'Rs. 3,200', 'Easypaisa', 'A', 'Ali Raza', 'blue'],
  ['EXP-2026-006', '23 Sep 2026', 'Cleaning Supplies', 'Office Supplies', 'Rs. 2,800', 'Cash', 'S', 'Saad Khan', 'green'],
  ['EXP-2026-007', '20 Sep 2026', 'Transport / Delivery', 'Transport', 'Rs. 4,500', 'JazzCash', 'A', 'Ali Raza', 'orange'],
  ['EXP-2026-008', '18 Sep 2026', 'Marketing / Promotion', 'Marketing', 'Rs. 6,750', 'Cash', 'R', 'Riyaz Ahmed', 'purple'],
  ['EXP-2026-009', '15 Sep 2026', 'Office Stationery', 'Office Supplies', 'Rs. 2,450', 'Cash', 'S', 'Saad Khan', 'green'],
  ['EXP-2026-010', '12 Sep 2026', 'Equipment Repair', 'Maintenance', 'Rs. 12,500', 'Bank Transfer', 'R', 'Riyaz Ahmed', 'purple'],
]

function ExpenseStats() {
  const stats: [IconName, string, string, string, string, string][] = [
    ['expense', 'Total Expenses', 'Rs. 186,750', 'This Month', '↑ 12%', 'rose'],
    ['wallet', "Today's Expenses", 'Rs. 3,200', '03 Oct 2026', '↑ 8%', 'green'],
    ['chart', 'Highest Category', 'Rent', 'Rs. 60,000', '32% of total', 'amber'],
    ['calendar', 'Total Expenses (Year)', 'Rs. 1,950,400', '2026', '↓ 5%', 'blue'],
  ]
  return <div className="expense-stats">{stats.map(([icon, label, value, note, trend, tone]) => <section className={`card expense-stat ${tone}`} key={label}><span><Icon name={icon} size={24} /></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div><b className={tone === 'rose' || label === "Today's Expenses" ? 'negative' : ''}>{trend}</b></section>)}</div>
}

function ExpensesTable() {
  const [tab, setTab] = useState('All Expenses')
  return <section className="card expenses-table-card"><div className="expense-tabs">{['All Expenses', 'By Category', 'Monthly Summary'].map(label => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}>{label}</button>)}</div><div className="expense-filters"><label><Icon name="search" size={17} /><input aria-label="Search expense list" placeholder="Search expenses by description..." /></label><button>01 Oct 2026 <Icon name="calendar" size={14} /></button><span>→</span><button>31 Oct 2026 <Icon name="calendar" size={14} /></button><button>All Categories <Icon name="chevron" size={14} /></button><button>All Payment Methods <Icon name="chevron" size={14} /></button><button className="clear">Clear</button></div><div className="expenses-table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all expenses" /></th><th>#</th><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Payment Method</th><th>Added By</th><th>Actions</th></tr></thead><tbody>{expenseRows.map(([invoice, date, description, category, amount, payment, initials, name, tone]) => <tr key={invoice}><td><input type="checkbox" aria-label={`Select ${invoice}`} /></td><td><b>{invoice}</b></td><td>{date}</td><td><strong>{description}</strong></td><td><span className={`expense-category ${tone}`}>{category}</span></td><td className="expense-amount">{amount}</td><td><span className={`expense-payment ${payment.toLowerCase().replace(' ', '-')}`}>{payment}</span></td><td><span className="expense-added-by"><i>{initials}</i>{name}</span></td><td><button className="expense-more" aria-label={`More actions for ${invoice}`}>•••</button></td></tr>)}</tbody></table></div><div className="expense-pagination"><span>Showing 1 to 10 of 86 entries</span><div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button>…</button><button>9</button><button className="page-size">10 / page <Icon name="chevron" size={13} /></button></div></div></section>
}

function ExpenseQuickActions() {
  const actions: [IconName, string][] = [['plus', 'Add Expense'], ['report', 'Import Expenses'], ['report', 'Export Expenses'], ['box', 'Manage Categories'], ['arrow', 'Recurring Expenses']]
  return <section className="card expense-quick-actions"><div className="expense-side-heading"><h2><Icon name="bolt" size={18} /> Quick Actions</h2></div><div>{actions.map(([icon, label], index) => <button className={index === 0 ? 'primary' : ''} key={label}><Icon name={icon} size={16} />{label}</button>)}</div></section>
}

function ExpensesCategoryChart() {
  const rows = [['Rent', '32%', '#ef4d70'], ['Salaries', '24%', '#ffb810'], ['Utilities', '12%', '#3b9ee9'], ['Maintenance', '9%', '#7550e9'], ['Transport', '8%', '#f18d21'], ['Marketing', '6%', '#9a6bf0'], ['Office Supplies', '5%', '#43c9aa'], ['Others', '4%', '#91a1bd']]
  return <section className="card expenses-category-card"><div className="expense-side-heading"><h2><Icon name="plus" size={18} /> Expenses by Category</h2></div><div className="expenses-chart-wrap"><div className="expenses-donut"><div><strong>Rs. 186,750</strong><small>This Month</small></div></div><div className="expenses-chart-legend">{rows.map(([label, percent, color]) => <div key={label}><i style={{ background: color }} /><span>{label}</span><strong>{percent}</strong></div>)}</div></div></section>
}

function RecentExpenses() {
  const recent = [['expense', 'Electricity Bill (KE)', '03 Oct 2026', 'Rs. 18,500'], ['home', 'Shop Rent - October', '01 Oct 2026', 'Rs. 60,000'], ['users', 'Staff Salaries', '29 Sep 2026', 'Rs. 45,000'], ['bolt', 'Internet Bill', '25 Sep 2026', 'Rs. 3,200']]
  return <section className="card recent-expenses"><div className="expense-side-heading"><h2><Icon name="clock" size={18} /> Recent Expenses</h2><button>View All</button></div><div>{recent.map(([icon, label, date, amount]) => <button key={label}><Icon name={icon as IconName} size={18} /><span><strong>{label}</strong><small>{date}</small></span><b>{amount}</b><Icon name="chevron" size={14} /></button>)}</div></section>
}

function ExpensesScreen() {
  return <motion.main className="expenses-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}><div className="expenses-title-row"><div className="expenses-title"><span><Icon name="expense" size={28} /></span><div><h1>Expenses</h1><p>Manage business expenses and track operational costs</p></div></div><button className="add-expense"><Icon name="plus" size={18} /> Add Expense</button></div><ExpenseStats /><div className="expenses-layout"><ExpensesTable /><aside className="expenses-side"><ExpenseQuickActions /><ExpensesCategoryChart /><RecentExpenses /></aside></div></motion.main>
}


export default function ExpensesPage(props: PageProps) { return <PageShell {...props} activePage="Expenses" className="expenses-app" header={onMenu => <ExpensesHeader onMenu={onMenu} />}><ExpensesScreen /></PageShell> }
