import { forwardRef } from 'react'
import { Icon } from '../../shared/ui/Icon'
import type { PosBootstrap } from '../../types/desktop-api'

type Props = {
  onMenu:()=>void
  data:PosBootstrap | null
  search:string
  onSearch:(value:string)=>void
  onSearchEnter:()=>void
  customerId:string
  onCustomer:(id:string)=>void
  onAddCustomer:()=>void
  onScan:()=>void
}

export const PosHeader = forwardRef<HTMLInputElement,Props>(function PosHeader({ onMenu,data,search,onSearch,onSearchEnter,customerId,onCustomer,onAddCustomer,onScan },ref) {
  return <header className="topbar pos-topbar">
    <button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button>
    <div className="search-field pos-search"><Icon name="search" size={19} /><input ref={ref} value={search} onChange={event => onSearch(event.target.value)} onKeyDown={event => { if(event.key==='Enter') onSearchEnter() }} aria-label="Scan barcode or search product" placeholder="Scan barcode or search product..." /><kbd>F2</kbd></div>
    <button className="scan-button" onClick={onScan}><span>▥</span>Scan</button>
    <div className="pos-customer-control"><label className="customer-select"><Icon name="user" size={19} /><select value={customerId} onChange={event => onCustomer(event.target.value)} aria-label="Select customer">{data?.customers.map(customer => <option value={customer.id} key={customer.id}>{customer.name}{customer.balancePaisa > 0 ? ` — Due Rs ${(customer.balancePaisa/100).toLocaleString('en-PK')}` : ''}</option>)}</select><Icon name="chevron" size={15} /></label><button className="pos-add-customer" onClick={onAddCustomer} aria-label="Add customer"><Icon name="plus" size={16} /></button></div>
    <div className="topbar-right"><button className="icon-button notification-button" aria-label={`${data?.lowStockCount ?? 0} stock alerts`}><Icon name="bell" size={24} />{Boolean(data?.lowStockCount) && <span>{data!.lowStockCount}</span>}</button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong>{data?.businessName ?? 'Loading?'}</strong><small>{data?.branchName ?? 'Main Branch'}</small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong>{data?.userName ?? 'Loading?'}</strong><small>{data?.userRole ?? '?'}</small></span><Icon name="chevron" size={16} /></button></div>
  </header>
})
