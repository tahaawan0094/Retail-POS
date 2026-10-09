import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'

function StaffHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar customers-topbar staff-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field customers-global-search"><Icon name="search" size={19} /><input aria-label="Search staff" placeholder="Search staff by name, role, phone, CNIC..." /><kbd>Ctrl + K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 3 unread"><Icon name="bell" size={24} /><span>3</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>Noor Mart</strong><small>Main Branch</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong>Riyaz Ahmed</strong><small>Owner</small></span><Icon name="chevron" size={16} /></button></div></header>
}

const staffRows = [
  ['RA', 'Riyaz Ahmed', 'Owner', '0300 1234567', '42101-1234567-8', '01 Jan 2024', 'Active', 'slate'],
  ['AR', 'Ali Raza', 'Manager', '0301 2345678', '42201-2345678-9', '15 Jan 2024', 'Active', 'blue'],
  ['SK', 'Sana Khan', 'Cashier', '0321 4455667', '42401-3456789-0', '10 Feb 2024', 'Active', 'pink'],
  ['BH', 'Bilal Hussain', 'Cashier', '0333 7788990', '42301-4567890-1', '12 Mar 2024', 'Active', 'brown'],
  ['AM', 'Ayesha Malik', 'Inventory', '0312 6677889', '42501-5678901-2', '20 Mar 2024', 'Active', 'slate'],
  ['UA', 'Usman Ali', 'Purchasing', '0305 1122334', '42201-6789012-3', '05 Apr 2024', 'Active', 'brown'],
  ['HR', 'Hassan Raza', 'Cashier', '0345 5566778', '42101-7890123-4', '18 Apr 2024', 'Active', 'slate'],
  ['FA', 'Fatima Ali', 'Cashier', '0315 6677880', '42301-8901234-5', '25 May 2024', 'Inactive', 'pink'],
  ['AK', 'Ahmed Khan', 'Inventory', '0309 9988776', '42401-9012345-6', '10 Jun 2024', 'Active', 'violet'],
  ['ZS', 'Zeeshan Saleem', 'Cashier', '0320 3344556', '42101-0123456-7', '15 Aug 2024', 'Inactive', 'teal'],
]

function StaffStats() {
  const stats: [IconName, string, string, string, string, string][] = [
    ['users', 'Total Staff', '12', 'All active and inactive staff', '↑ 20%', 'blue'],
    ['user', 'Active Staff', '10', 'Currently working', '↑ 25%', 'green'],
    ['clock', 'Inactive Staff', '2', 'Disabled accounts', '↓ 0%', 'amber'],
    ['lock', 'Admin / Managers', '2', 'With full access', '17%', 'purple'],
  ]
  return <div className="customer-stats staff-stats">{stats.map(([icon, label, value, note, trend, tone]) => <section className={`card customer-stat staff-stat ${tone}`} key={label}><span><Icon name={icon} size={24} /></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div><b>{trend}</b></section>)}</div>
}

function StaffTable() {
  const [tab, setTab] = useState('All Staff')
  return <section className="card customers-table-card staff-table-card"><div className="customer-tabs staff-tabs">{['All Staff', 'Active Staff', 'Inactive Staff'].map(label => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}>{label}</button>)}</div><div className="customer-filters staff-filters"><label><Icon name="search" size={17} /><input aria-label="Search staff list" placeholder="Search staff by name, phone, role..." /></label><button>All Roles <Icon name="chevron" size={14} /></button><button>All Status <Icon name="chevron" size={14} /></button><button className="clear">Clear</button></div><div className="customers-table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all staff" /></th><th>#</th><th>Name</th><th>Role</th><th>Phone</th><th>CNIC</th><th>Join Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{staffRows.map(([initials, name, role, phone, cnic, joinDate, status, tone], index) => <tr key={name}><td><input type="checkbox" aria-label={`Select ${name}`} /></td><td>{index + 1}</td><td><div className="customer-name staff-name"><span className={tone}>{initials}</span><strong>{name}</strong></div></td><td><span className={`staff-role ${role.toLowerCase()}`}>{role}</span></td><td>{phone}</td><td>{cnic}</td><td>{joinDate}</td><td><span className={`customer-status ${status.toLowerCase()}`}>{status}</span></td><td><button className="customer-more" aria-label={`More actions for ${name}`}>•••</button></td></tr>)}</tbody></table></div><div className="customer-pagination"><span>Showing 1 to 10 of 12 entries</span><div><button>‹</button><button className="active">1</button><button>2</button><button>›</button><button className="page-size">10 / page <Icon name="chevron" size={13} /></button></div></div></section>
}

function StaffDetails() {
  return <section className="card staff-details"><div className="staff-profile"><div className="staff-profile-heading"><span><Icon name="user" size={34} /></span><div><h2>Ali Raza</h2><small>Active</small><b>Manager</b></div><button>⌕ &nbsp; Edit</button></div><ul><li>● <span>0301 2345678</span></li><li>✉ <span>ali.raza@noormart.com</span></li><li>▣ <span>42201-2345678-9</span></li><li>◆ <span>Joined: 15 Jan 2024</span></li><li>◈ <span>Last Login: 03 Oct 2026, 11:20 AM</span></li></ul></div><div className="staff-section-heading"><h2><Icon name="lock" size={17} /> Permissions</h2><button>View All</button></div><div className="staff-permissions">{['POS', 'Sales', 'Inventory', 'Purchases', 'Reports'].map(label => <span key={label}><i>✓</i>{label}</span>)}<button>+ 8 more</button></div></section>
}

function RoleDistribution() {
  const roles = [['Cashier', '6 (50%)', '#166fe5'], ['Manager', '2 (17%)', '#19a9c3'], ['Inventory', '2 (17%)', '#8c4de9'], ['Purchasing', '1 (8%)', '#f1b23a'], ['Owner', '1 (8%)', '#ef3658']]
  return <section className="card role-distribution"><div className="staff-section-heading"><h2><Icon name="bolt" size={17} /> Role Distribution</h2></div><div><div className="role-donut"><span><strong>12</strong><small>Staff</small></span></div><div className="role-legend">{roles.map(([role, count, color]) => <div key={role}><i style={{ background: color }} /><span>{role}</span><strong>{count}</strong></div>)}</div></div></section>
}

function StaffQuickActions() {
  const actions: [IconName, string][] = [['plus', 'Add Staff'], ['report', 'Import Staff'], ['lock', 'Manage Roles'], ['clock', 'Activity Logs']]
  return <section className="card staff-quick-actions"><div className="staff-section-heading"><h2><Icon name="bolt" size={17} /> Quick Actions</h2></div><div>{actions.map(([icon, label]) => <button key={label}><Icon name={icon} size={16} />{label}</button>)}</div></section>
}

function StaffScreen() {
  return <motion.main className="customers-page staff-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}><div className="customers-title-row"><div className="customers-title"><span><Icon name="users" size={28} /></span><div><h1>Staff</h1><p>Manage employees, roles, permissions and access control</p></div></div><button className="add-customer staff-add"><Icon name="plus" size={18} /> Add Staff <Icon name="chevron" size={14} /></button></div><StaffStats /><div className="customers-layout"><StaffTable /><aside className="customers-side staff-side"><StaffDetails /><RoleDistribution /><StaffQuickActions /></aside></div></motion.main>
}


export default function StaffPage(props: PageProps) { return <PageShell {...props} activePage="Staff" className="customers-app staff-app" header={onMenu => <StaffHeader onMenu={onMenu} />}><StaffScreen /></PageShell> }
