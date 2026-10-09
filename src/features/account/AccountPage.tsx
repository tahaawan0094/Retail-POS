import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'

function AccountHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar account-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field account-global-search"><Icon name="search" size={19} /><input aria-label="Search" placeholder="Search anything..." /><kbd>Ctrl + K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 3 unread"><Icon name="bell" size={24} /><span>3</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>Noor Mart</strong><small>Main Branch</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar account-header-avatar">RA</span><span><strong>Riyaz Ahmed</strong><small>Owner</small></span><Icon name="chevron" size={16} /></button></div></header>
}

function AccountProfile() {
  const rows: [IconName,string,string][] = [['user','Full Name','Riyaz Ahmed'], ['sale','Phone Number','0301 1234567'], ['supplier','Email Address','noormart@gmail.com'], ['cash','CNIC / NTN','42201-1234567-9'], ['store','Role','Owner'], ['calendar','Joined Date','15 Jan 2024, 10:30 AM']]
  return <section className="card account-profile"><div className="account-card-heading"><h2><Icon name="user" size={20} /> Profile Information</h2><button>⌕ &nbsp; Edit</button></div><div className="account-person"><span>RA<i>◉</i></span><div><h3>Riyaz Ahmed <b>Owner</b></h3><p>Noor Mart</p><p>Main Branch - Karachi</p></div></div><div className="account-profile-list">{rows.map(([icon,label,value]) => <div key={label}><Icon name={icon} size={17} /><span>{label}</span><strong>{value}</strong></div>)}</div></section>
}

function ChangePasswordCard() {
  return <section className="card change-password"><div className="account-card-heading"><h2><Icon name="lock" size={20} /> Change Password</h2></div><p>Update your password to keep your account secure</p><form onSubmit={event => event.preventDefault()}>{[['Current Password','Enter current password'], ['New Password','Enter new password'], ['Confirm New Password','Confirm new password']].map(([label,placeholder]) => <label key={label}><span><Icon name="lock" size={15} /></span><div><strong>{label}</strong><span><input type="password" placeholder={placeholder} /><button type="button" aria-label={`Show ${label.toLowerCase()}`}>◉</button></span></div></label>)}<div className="password-requirements"><strong><Icon name="lock" size={16} /> Password Requirements:</strong>{['At least 8 characters','Include uppercase and lowercase letters','Include at least one number','Include at least one special character'].map(item => <span key={item}>✓ <small>{item}</small></span>)}</div><button className="update-password"><Icon name="lock" size={15} /> Update Password</button></form></section>
}

function AccountPreferences() {
  const [email, setEmail] = useState(true)
  const [pos, setPos] = useState(true)
  const [dark, setDark] = useState(false)
  const selects: [IconName,string,string][] = [['supplier','Language','English'], ['calendar','Date Format','31 Oct 2026'], ['clock','Time Format','12 Hour (AM/PM)'], ['clock','Timezone','Asia/Karachi (GMT +5)']]
  const toggles: [IconName,string,string,boolean,() => void][] = [['supplier','Email Notifications','Get important updates on your email',email,()=>setEmail(v=>!v)], ['report','POS Notifications','Show system notifications',pos,()=>setPos(v=>!v)], ['clock','Dark Mode','Use dark theme (coming soon)',dark,()=>setDark(v=>!v)]]
  return <section className="card account-preferences"><div className="account-card-heading"><h2><Icon name="settings" size={20} /> Preferences</h2></div><p>Customize your account preferences</p><div className="preference-selects">{selects.map(([icon,label,value]) => <label key={label}><Icon name={icon} size={16} /><span>{label}</span><button>{value}<Icon name="chevron" size={13} /></button></label>)}</div><div className="preference-toggles">{toggles.map(([icon,label,description,on,toggle]) => <div key={label}><Icon name={icon} size={19} /><span><strong>{label}</strong><small>{description}</small></span><button className={on ? 'on' : ''} onClick={toggle} aria-label={`Toggle ${label}`} aria-pressed={on}><i /></button></div>)}</div><button className="save-preferences"><Icon name="settings" size={15} /> Save Preferences</button></section>
}

function AccountStats() {
  const stats: [IconName,string,string,string,string][] = [['store','1','Branch','Main Branch','blue'], ['user','12','Staff Members','2 Active Now','green'], ['clock','245','Total Transactions','This Month','amber'], ['chart','Rs. 2,485,600','Total Sales','This Month','rose']]
  return <section className="card account-stats"><div className="account-section-heading"><h2><Icon name="chart" size={20} /> Account Stats</h2><p>Your account overview and activity</p></div><div>{stats.map(([icon,value,label,note,tone]) => <div className={tone} key={label}><span><Icon name={icon} size={23} /></span><strong>{value}</strong><p>{label}</p><small>{note}</small></div>)}</div></section>
}

function AccountActivity() {
  const rows: [IconName,string,string,string,string,string][] = [['arrow','Login from Web','Karachi, Pakistan · 192.168.1.12','03 Oct 2026','10:25 AM','green'], ['settings','Updated Store Settings','Changed tax rate and currency','02 Oct 2026','04:15 PM','slate'], ['lock','Password Changed','Account password updated','28 Sep 2026','11:40 AM','amber'], ['report','POS Session Started','Main Branch','25 Sep 2026','09:20 AM','blue'], ['arrow','Logout from Web','Karachi, Pakistan · 192.168.1.12','25 Sep 2026','06:35 PM','rose']]
  return <section className="card account-activity"><div className="account-section-heading"><h2><Icon name="clock" size={20} /> Recent Account Activity</h2><p>Your latest login and account activity</p><button>View All</button></div><div>{rows.map(([icon,title,detail,date,time,tone]) => <div className="account-activity-row" key={title}><span className={tone}><Icon name={icon} size={17} /></span><div><strong>{title}</strong><small>{detail}</small></div><time><strong>{date}</strong><small>{time}</small></time></div>)}</div></section>
}

function SecurityPasswordCard() {
  return <section className="card security-password"><div className="account-section-heading"><h2><Icon name="lock" size={20} /> Change Password</h2><p>Update your password to keep your account secure</p></div><form onSubmit={event => event.preventDefault()}>{[['Current Password','Enter current password'],['New Password','Enter new password'],['Confirm New Password','Confirm new password']].map(([label,placeholder]) => <label key={label}><strong>{label}</strong><span><input type="password" placeholder={placeholder} /><button type="button" aria-label={`Show ${label.toLowerCase()}`}>◉</button></span></label>)}<button className="account-primary-button"><Icon name="lock" size={14} /> Update Password</button></form></section>
}

function AccountSecurityTab() {
  const [twoFactor,setTwoFactor] = useState(false)
  return <div className="account-security-grid account-tab-panel"><SecurityPasswordCard /><div className="security-side"><section className="card two-factor-card"><div className="account-section-heading"><h2><Icon name="settings" size={20} /> Two Factor Authentication</h2><p>Add an extra layer of security to your account</p></div><div className="two-factor-control"><span>Enable Two Factor Authentication</span><button className={`account-switch ${twoFactor?'on':''}`} onClick={()=>setTwoFactor(value=>!value)} aria-pressed={twoFactor} aria-label="Toggle two factor authentication"><i /></button></div></section><section className="card active-sessions-card"><div className="account-section-heading"><h2><Icon name="report" size={20} /> Active Sessions</h2><p>Manage your active login sessions</p></div><div className="security-session"><span className="session-device windows">⊞</span><div><strong>Windows - Chrome</strong><small>Karachi, Pakistan · 192.168.1.12</small></div><b>Current Session</b></div><div className="security-session"><span className="session-device">▯</span><div><strong>Android - Chrome</strong><small>Karachi, Pakistan · 103.48.22.19<br />2 days ago</small></div><button>Logout</button></div><div className="logout-all-row"><span><Icon name="arrow" size={17} /></span><div><strong>Logout from all devices</strong><small>This will end all active sessions except<br />your current one.</small></div><button>Logout All Devices</button></div></section></div></div>
}

function AccountPreferencesTab() {
  const [appearance,setAppearance] = useState('Light')
  const [email,setEmail] = useState(true)
  const [pos,setPos] = useState(true)
  const [marketing,setMarketing] = useState(false)
  const notificationRows: [IconName,string,string,boolean,()=>void][] = [['supplier','Email Notifications','Get important updates on your email',email,()=>setEmail(v=>!v)],['report','POS Notifications','Show system notifications',pos,()=>setPos(v=>!v)],['settings','Marketing & Offers','Receive product updates and offers',marketing,()=>setMarketing(v=>!v)]]
  const regionRows: [IconName,string,string][] = [['supplier','Language','English'],['calendar','Date Format','31 Oct 2026'],['clock','Time Format','12 Hour (AM/PM)'],['clock','Timezone','Asia/Karachi (GMT +5)']]
  return <div className="account-preferences-grid account-tab-panel"><div className="preferences-column"><section className="card appearance-card"><div className="account-section-heading"><h2><Icon name="settings" size={20} /> Appearance</h2><p>Customize the look and feel of your POS</p></div><div className="appearance-options">{['Light','Dark','System'].map(mode=><button className={appearance===mode?'selected':''} onClick={()=>setAppearance(mode)} key={mode}><span className={`appearance-preview ${mode.toLowerCase()}`}><i /><i /><i /><b /></span><strong>{mode}</strong>{appearance===mode&&<em>✓</em>}</button>)}</div></section><section className="card notifications-card"><div className="account-section-heading"><h2><Icon name="bell" size={20} /> Notifications</h2><p>Choose what notifications you want to receive</p></div><div className="preference-toggles">{notificationRows.map(([icon,label,description,on,toggle])=><div key={label}><Icon name={icon} size={19} /><span><strong>{label}</strong><small>{description}</small></span><button className={on?'on':''} onClick={toggle} aria-pressed={on}><i /></button></div>)}</div></section></div><div className="preferences-column"><section className="card account-region-card"><div className="account-section-heading"><h2><Icon name="supplier" size={20} /> Language &amp; Region</h2><p>Set your language, date, time and region settings</p></div><div className="preference-selects">{regionRows.map(([icon,label,value])=><label key={label}><Icon name={icon} size={16} /><span>{label}</span><button>{value}<Icon name="chevron" size={13} /></button></label>)}</div></section><section className="card default-branch-card"><div className="account-section-heading"><h2><Icon name="store" size={20} /> Default Branch</h2><p>Set your default working branch</p></div><button className="branch-select">Noor Mart - Main Branch <Icon name="chevron" size={14} /></button><small>This branch will be selected by default when you log in.</small><button className="account-primary-button"><Icon name="settings" size={14} /> Save Preferences</button></section></div></div>
}

const accountActivityRows = [
  ['31 Oct 2026 10:25 AM','Login','Login from Web','192.168.1.12','Windows / Chrome','green'],
  ['30 Oct 2026 04:15 PM','Settings Updated','Changed tax rate','192.168.1.12','Windows / Chrome','amber'],
  ['28 Oct 2026 11:40 AM','Password Changed','Account password updated','103.48.22.19','Android / Chrome','amber'],
  ['25 Oct 2026 09:20 AM','POS Session Started','Main Branch','192.168.1.12','Windows / Chrome','blue'],
  ['25 Oct 2026 06:35 PM','Logout','Logout from Web','192.168.1.12','Windows / Chrome','rose'],
  ['24 Oct 2026 02:18 PM','Login','Login from Web','103.48.22.19','Android / Chrome','green'],
  ['23 Oct 2026 01:10 PM','Profile Updated','Updated phone number','192.168.1.12','Windows / Edge','purple'],
  ['22 Oct 2026 11:05 AM','Login','Login from Web','192.168.1.12','Windows / Chrome','green'],
]
function AccountActivityTab() {
  const stats: [IconName,string,string,string,string][] = [['arrow','145','Total Logins','Last 30 days','green'],['report','12','Devices Used','Last 30 days','blue'],['clock','52h 30m','Total Active Time','Last 30 days','amber'],['settings','0','Failed Logins','Last 30 days','purple']]
  return <div className="account-activity-page account-tab-panel"><div className="activity-kpis">{stats.map(([icon,value,label,note,tone])=><section className={`card activity-kpi ${tone}`} key={label}><span><Icon name={icon} size={22} /></span><div><strong>{value}</strong><p>{label}</p><small>{note}</small></div></section>)}</div><section className="card account-activity-table-card"><div className="account-section-heading"><h2><Icon name="clock" size={20} /> Account Activity</h2><p>See your recent login activity and account actions</p><button>All Activities <Icon name="chevron" size={12} /></button></div><div className="account-data-scroll"><table><thead><tr><th>#</th><th>Date &amp; Time</th><th>Activity</th><th>Details</th><th>IP Address</th><th>Device / Browser</th></tr></thead><tbody>{accountActivityRows.map(([date,activity,detail,ip,device,tone],index)=><tr key={`${date}-${activity}`}><td>{index+1}</td><td>{date}</td><td><span className={`activity-type ${tone}`}>{activity}</span></td><td>{detail}</td><td>{ip}</td><td>{device}</td></tr>)}</tbody></table></div><AccountTableFooter text="Showing 1 to 8 of 145 entries" pages={5} /></section></div>
}

function AccountTableFooter({text,pages}:{text:string;pages:number}) {
  return <div className="account-table-footer"><span>{text}</span><div><button>‹</button>{Array.from({length:pages},(_,index)=><button className={index===0?'active':''} key={index}>{index+1}</button>)}<button>›</button></div></div>
}

function SavedDevicesTab() {
  const devices = [['▣','Windows PC','Karachi, Pakistan','31 Oct 2026 10:25 AM','Chrome / Windows','Current'],['▰','Office Laptop','Karachi, Pakistan','28 Oct 2026 11:40 AM','Edge / Windows','Active'],['▯','Android Phone','Karachi, Pakistan','25 Oct 2026 06:35 PM','Chrome / Android','Active'],['▯','iPad','Karachi, Pakistan','20 Oct 2026 09:15 AM','Safari / iOS','Active'],['▰','Home PC','Hyderabad, Pakistan','15 Oct 2026 04:20 PM','Chrome / Windows','Inactive']]
  return <div className="account-tab-panel"><section className="card saved-devices-card"><div className="account-section-heading"><h2><Icon name="report" size={20} /> Saved Devices</h2><p>Manage devices that have access to your account</p></div><div className="account-data-scroll"><table><thead><tr><th>#</th><th>Device Name</th><th>Location</th><th>Last Active</th><th>Browser / OS</th><th>Status</th><th>Actions</th></tr></thead><tbody>{devices.map(([symbol,name,location,lastActive,browser,status],index)=><tr key={name}><td>{index+1}</td><td><span className="saved-device-name"><i>{symbol}</i>{name}</span></td><td>{location}</td><td>{lastActive}</td><td>{browser}</td><td><span className={`device-status ${status.toLowerCase()}`}>{status}</span></td><td><button className="device-more">•••</button></td></tr>)}</tbody></table></div><div className="remove-devices"><span><Icon name="expense" size={19} /></span><div><strong>Remove All Devices</strong><small>This will remove all saved devices from your account. You will need to login again on each device.</small></div><button><Icon name="expense" size={14} /> Remove All Devices</button></div></section></div>
}

function AccountScreen() {
  const [tab,setTab] = useState('Profile')
  return <motion.main className="account-page" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.18}}><div className="account-title"><span><Icon name="user" size={30} /></span><div><h1>My Account</h1><p>Manage your profile, security, preferences and account settings</p></div></div><div className="account-tabs">{['Profile','Security','Preferences','Activity','Saved Devices'].map(label => <button className={tab===label?'active':''} onClick={()=>setTab(label)} key={label}>{label}</button>)}</div>{tab==='Profile'&&<><div className="account-top-grid"><AccountProfile /><ChangePasswordCard /><AccountPreferences /></div><div className="account-bottom-grid"><AccountStats /><AccountActivity /></div></>}{tab==='Security'&&<AccountSecurityTab />}{tab==='Preferences'&&<AccountPreferencesTab />}{tab==='Activity'&&<AccountActivityTab />}{tab==='Saved Devices'&&<SavedDevicesTab />}</motion.main>
}


export default function AccountPage(props: PageProps) { return <PageShell {...props} activePage="My Account" className="account-app" header={onMenu => <AccountHeader onMenu={onMenu} />}><AccountScreen /></PageShell> }
