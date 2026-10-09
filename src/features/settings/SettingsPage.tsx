import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'

function SettingsHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar settings-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field settings-global-search"><Icon name="search" size={19} /><input aria-label="Search settings" placeholder="Search settings..." /><kbd>Ctrl + K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 3 unread"><Icon name="bell" size={24} /><span>3</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>Noor Mart</strong><small>Main Branch</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong>Riyaz Ahmed</strong><small>Owner</small></span><Icon name="chevron" size={16} /></button></div></header>
}

function SettingsCategories() {
  const categories: [IconName, string, string, string][] = [
    ['store', 'Store Settings', 'Manage your store information, address, contact details and basic configuration.', 'blue'],
    ['money', 'Tax & Pricing', 'Configure tax rates, pricing options, discounts and currency settings.', 'green'],
    ['receipt', 'Receipt Settings', 'Customize receipt layout, logo, printer settings and receipt content.', 'purple'],
    ['box', 'Product & Inventory', 'Set default units, low stock alerts, barcode settings and stock options.', 'amber'],
    ['cart', 'Sales & Purchase', 'Configure invoice numbers, returns, payment methods and purchasing options.', 'rose'],
    ['users', 'Users & Permissions', 'Manage staff accounts, roles, permissions and access control.', 'blue'],
    ['report', 'Devices', 'Configure receipt printers, barcode scanners, label printers and other hardware.', 'purple'],
    ['supplier', 'Integrations', 'Connect with third party services like JazzCash, Easypaisa, SMS and Email.', 'teal'],
    ['cash', 'Backup & Data', 'Backup, restore and manage your store data.', 'blue'],
    ['settings', 'System Settings', 'Manage application preferences, language, date and time settings.', 'blue'],
  ]
  return <div className="settings-category-grid">{categories.map(([icon,title,description,tone]) => <button className={`card settings-category ${tone}`} key={title}><span><Icon name={icon} size={29} /></span><div><strong>{title}</strong><p>{description}</p></div><Icon name="chevron" size={20} /></button>)}</div>
}

function StoreProfileSettings() {
  const rows = [['user','Owner Name','Riyaz Ahmed'], ['sale','Phone','0301 1234567'], ['supplier','Email','noormart@gmail.com'], ['cash','CNIC / NTN','42201-1234567-9'], ['store','Address','Shop #12, Gulshan-e-Iqbal\nKarachi, Pakistan']]
  return <section className="card settings-store-profile"><div className="settings-side-heading"><h2><Icon name="settings" size={18} /> Store Profile</h2><button>⌕ &nbsp; Edit</button></div><div className="settings-store-name"><span><Icon name="store" size={29} /></span><div><strong>Noor Mart</strong><small>Main Branch - Karachi</small></div><b>Active</b></div><div className="settings-profile-list">{rows.map(([icon,label,value]) => <div key={label}><Icon name={icon as IconName} size={16} /><span>{label}</span><strong>{value.split('\n').map((line,i) => <span key={line}>{line}{i === 0 && value.includes('\n') && <br />}</span>)}</strong></div>)}</div></section>
}

function SettingsQuickActions() {
  const actions: [IconName, string, string][] = [['cash','Backup Now',''], ['arrow','Restore Data','restore'], ['report','Export Data',''], ['expense','Clear Old Data','danger']]
  return <section className="card settings-quick-actions"><div className="settings-side-heading"><h2><Icon name="bolt" size={18} /> Quick Actions</h2></div><div>{actions.map(([icon,label,tone]) => <button className={tone} key={label}><Icon name={icon} size={18} />{label}</button>)}</div></section>
}

function SystemStatus() {
  const rows = [['Database Connection','Connected','good'], ['Receipt Printer','Ready','good'], ['Barcode Scanner','Not Connected','neutral'], ['Internet Connection','Online','good']]
  return <section className="card system-status"><div className="settings-side-heading"><h2><Icon name="check" size={18} /> System Status</h2></div><div>{rows.map(([label,status,tone]) => <div key={label}><i className={tone}>✓</i><span>{label}</span><strong className={tone}>{status}</strong></div>)}</div></section>
}

function SettingsScreen() {
  return <motion.main className="settings-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}><div className="settings-title"><span><Icon name="settings" size={32} /></span><div><h1>Settings</h1><p>Manage your store configuration, preferences and system settings</p></div></div><div className="settings-layout"><SettingsCategories /><aside className="settings-side"><StoreProfileSettings /><SettingsQuickActions /><SystemStatus /></aside></div></motion.main>
}


export default function SettingsPage(props: PageProps) { return <PageShell {...props} activePage="Settings" className="settings-app" header={onMenu => <SettingsHeader onMenu={onMenu} />}><SettingsScreen /></PageShell> }
