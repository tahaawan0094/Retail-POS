import { BusinessName, BranchName, UserName, UserRoleName } from '../../shared/layout/SessionIdentity'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'
import { PosProductVisual } from '../../shared/ui/ProductVisual'
import { useRetailData } from '../../app/data/useRetailData'
import { useOperationIdentity } from '../../shared/hooks/useOperationIdentity'
import { RetailDataStatus } from '../../shared/ui/RetailDataStatus'
import type { InventoryMovementRecord, ProductRecord } from '../products/products.types'

import { useAuth } from '../../app/auth/useAuth'
import { useDesktopQuery } from '../../shared/hooks/useDesktopQuery'

const money = (value: number) => value.toLocaleString('en-PK')
const categoryColors = ['#287be5','#ee9418','#17ad86','#7653ec','#e84b6d','#15aa91']

function InventoryHeader({ onMenu }: { onMenu: () => void }) {
  return <header className="topbar inventory-topbar"><button className="icon-button menu-button" aria-label="Toggle sidebar" onClick={onMenu}><Icon name="menu" size={23} /></button><div className="search-field inventory-global-search"><Icon name="search" size={19} /><input aria-label="Search" placeholder="Search products, customers, invoices, suppliers..." /><kbd>Ctrl + K</kbd></div><div className="topbar-right"><button className="icon-button notification-button" aria-label="Notifications, 2 unread"><Icon name="bell" size={24} /><span>2</span></button><button className="store-switcher"><span className="store-avatar"><Icon name="store" size={22} /></span><span><strong><BusinessName /></strong><small><BranchName /></small></span><Icon name="chevron" size={16} /></button><button className="profile-button"><span className="avatar"><Icon name="user" size={26} /></span><span><strong><UserName /></strong><small><UserRoleName /></small></span><Icon name="chevron" size={16} /></button></div></header>
}

function InventoryStats({ products, movements }: { products: ProductRecord[]; movements: InventoryMovementRecord[] }) {
  const { session } = useAuth()
  const branchId = session!.branchId
  const valuation = useDesktopQuery(useCallback(() => window.vertexia!.reports.valuation(branchId),[branchId]))
  const totalValue = valuation.data ? valuation.data.valuePaisa/100 : null
  const low = products.filter(product => product.stock > 0 && product.stock <= product.minimumStock).length
  const out = products.filter(product => product.stock <= 0).length
  const stockIn = movements.filter(movement => movement.quantityDelta > 0).reduce((total,movement) => total + movement.quantityDelta,0)
  const cards: [IconName,string,string,string,string,string][] = [
    ['box','Stock Cost Value',totalValue===null ? 'Loading...' : `Rs ${money(totalValue)}`,valuation.data?.estimatedProducts ? 'Includes estimates' : 'Live value',valuation.error ? 'Valuation unavailable' : 'branch average cost','green'],
    ['warning','Low Stock Items',String(low),'View Items','→','amber'],
    ['users','Out of Stock Items',String(out),'View Items','→','rose'],
    ['sale','Stock In',`${money(stockIn)} units`,'From movements','','blue'],
  ]
  return <div className="inventory-stats">{cards.map(([icon,label,value,note,compare,tone]) => <section className={`card inventory-stat ${tone}`} key={label}><span className="round-icon"><Icon name={icon} size={22} /></span><div><p>{label}</p><strong>{value}</strong><small className={note === 'View Items' ? 'inventory-view-link' : ''}><b>{note}</b> {compare}</small></div></section>)}</div>
}

function InventoryTable({ products }: { products: ProductRecord[] }) {
  return <section className="card inventory-table-card"><div className="inventory-table-heading"><h2>Products Inventory</h2><div><button><span>⇩</span> Export</button><button className="primary"><Icon name="plus" size={16} /> Add Product</button></div></div><div className="inventory-filters"><label><Icon name="search" size={17} /><input aria-label="Search inventory" placeholder="Search by product name, barcode, SKU..." /></label>{['All Categories','All Brands','All Suppliers'].map(item => <button key={item}>{item}<Icon name="chevron" size={14} /></button>)}<button className="filter-button">≡ &nbsp; Filters</button></div><div className="inventory-table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all inventory products" /></th><th>Product</th><th>Barcode / SKU</th><th>Category</th><th>Brand</th><th>Unit</th><th>Stock</th><th>Min. Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{products.map(product => { const low = product.stock <= product.minimumStock; return <tr key={product.id}><td><input type="checkbox" aria-label={`Select ${product.name}`} /></td><td><div className="inventory-product"><PosProductVisual kind={product.kind} /><span><strong>{product.name}</strong><small>SKU: {product.sku}</small></span></div></td><td><span>{product.barcode || '—'}</span><small>{product.sku}</small></td><td>{product.category}</td><td>{product.brand || '—'}</td><td>{product.unit}</td><td><b>{product.stock}</b></td><td>{product.minimumStock}</td><td><span className={`catalog-status ${low ? 'low-stock' : 'in-stock'}`}>{product.stock <= 0 ? 'Out of Stock' : low ? 'Low Stock' : 'In Stock'}</span></td><td><div className="catalog-actions"><button aria-label={`Edit ${product.name}`}>⌕</button><button aria-label={`More actions for ${product.name}`}>⋮</button></div></td></tr> })}</tbody></table></div><div className="catalog-pagination inventory-pagination"><span>Showing {products.length ? 1 : 0} to {products.length} of {products.length} products</span><div><button>‹</button><button className="active">1</button><button>›</button></div></div></section>
}

function StockMovementTable({ movements }: { movements: InventoryMovementRecord[] }) {
  return <section className="card inventory-table-card inventory-movement-card"><div className="inventory-table-heading"><div><h2>Stock Movement History</h2><p>Every posted stock change remains traceable.</p></div><div><button><span>⇩</span> Export</button></div></div><div className="inventory-table-scroll"><table><thead><tr><th>#</th><th>Date &amp; Time</th><th>Product</th><th>Movement</th><th>Quantity</th><th>Balance</th><th>Reason</th></tr></thead><tbody>{movements.map((movement,index) => <tr key={movement.id}><td>{index + 1}</td><td>{new Date(movement.createdAt).toLocaleString('en-PK')}</td><td><strong>{movement.productName}</strong></td><td><span className="movement-type">{movement.type.replaceAll('_',' ')}</span></td><td className={movement.quantityDelta >= 0 ? 'movement-in' : 'movement-out'}>{movement.quantityDelta >= 0 ? '+' : ''}{movement.quantityDelta}</td><td>{movement.balanceAfter}</td><td>{movement.reason}</td></tr>)}</tbody></table></div>{!movements.length && <div className="inventory-empty">No stock movements recorded yet.</div>}</section>
}

function StockAlerts({ products }: { products: ProductRecord[] }) {
  const alerts = products.filter(product => product.stock <= product.minimumStock).slice(0,5)
  return <section className="card stock-alerts"><div className="inventory-side-heading"><h2><Icon name="bell" size={18} /> Stock Alerts</h2><button>View All →</button></div><div className="stock-alert-list">{alerts.map(product => <div className="stock-alert-row" key={product.id}><PosProductVisual kind={product.kind} /><div><strong>{product.name}</strong><small><span>♟</span> Stock: {product.stock} | Min: {product.minimumStock}</small></div><span>{product.stock <= 0 ? 'Out' : 'Low Stock'}</span></div>)}</div></section>
}

function StockAdjustmentPanel() {
  const { products,adjustStock,busy,loading,error } = useRetailData()
  const operation = useOperationIdentity('stock-adjustment')
  const [selectedProductId,setProductId] = useState('')
  const productId = selectedProductId || products.find(item => item.status === 'active')?.id || ''
  const [direction,setDirection] = useState<'increase' | 'decrease'>('increase')
  const [quantity,setQuantity] = useState(1)
  const [reason,setReason] = useState('Stock count correction')
  const [message,setMessage] = useState<{ tone:'error' | 'success'; text:string } | null>(null)
  const product = products.find(item => item.id === productId)
  const submit = async () => {
    if (!Number.isFinite(quantity) || quantity <= 0) return setMessage({ tone:'error',text:'Quantity must be greater than zero.' })
    const delta = direction === 'increase' ? quantity : -quantity
    try {
    const result = await adjustStock(productId,delta,reason,operation.idFor({productId,delta,reason}))
    if (!result.ok) return setMessage({ tone:'error',text:result.error })
    operation.reset()
    setMessage({ tone:'success',text:'Stock adjustment posted and added to movement history.' })
    setQuantity(1)
    } catch(cause) { setMessage({tone:'error',text:cause instanceof Error ? cause.message : 'Adjustment could not be submitted.'}) }
  }
  return <section className="card stock-adjustment-panel"><div className="inventory-table-heading"><div><h2>New Stock Adjustment</h2><p>Post a traceable correction to the selected product.</p></div></div><div className="stock-adjustment-form"><label>Product<select disabled={busy} value={productId} onChange={event => setProductId(event.target.value)}>{products.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="adjustment-current"><span>Current Stock</span><strong>{product?.stock ?? 0} {product?.unit ?? ''}</strong></div><label>Adjustment Type<select disabled={busy} value={direction} onChange={event => setDirection(event.target.value as 'increase' | 'decrease')}><option value="increase">Increase Stock</option><option value="decrease">Decrease Stock</option></select></label><label>Quantity<input disabled={busy} type="number" min="0.001" step="0.001" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><label className="full">Reason<input disabled={busy} value={reason} onChange={event => setReason(event.target.value)} placeholder="Why is stock being adjusted?" /></label>{message && <p className={`adjustment-message ${message.tone} full`}>{message.text}</p>}<button className="post-adjustment full" disabled={busy || loading || Boolean(error) || !productId} onClick={() => void submit()}><Icon name="check" size={16} /> Post Adjustment</button></div></section>
}

function InventoryQuickActions({ onAdjustment }: { onAdjustment: () => void }) {
  const actions: [IconName,string][] = [['plus','Add Product'],['report','Import Products'],['report','Export Products'],['receipt','Print Barcode'],['inventory','Stock Adjustment'],['cart','New Purchase']]
  return <section className="card inventory-quick-actions"><div className="inventory-side-heading"><h2><Icon name="bolt" size={18} /> Quick Actions</h2></div><div>{actions.map(([icon,label]) => <button onClick={label === 'Stock Adjustment' ? onAdjustment : undefined} key={label}><Icon name={icon} size={17} /><span>{label}</span></button>)}</div></section>
}

function CategoryStockSummary({ products }: { products: ProductRecord[] }) {
  const categories = useMemo(() => Array.from(new Set(products.map(product => product.category))).slice(0,6).map((name,index) => { const count = products.filter(product => product.category === name).reduce((total,product) => total + product.stock,0); return [name,count,categoryColors[index]] as const }), [products])
  const maximum = Math.max(...categories.map(([,count]) => count),1)
  return <section className="card category-stock"><div className="inventory-side-heading"><h2><Icon name="chart" size={18} /> Category Stock Summary</h2><button>View All →</button></div><div className="category-stock-list">{categories.map(([name,count,color]) => <div className="category-stock-row" key={name}><span><i style={{ background: color }} />{name}</span><div><i style={{ width: `${Math.round(count / maximum * 100)}%`, background: color }} /></div><small>{count}</small></div>)}</div></section>
}

function InventoryScreen() {
  const { products,movements } = useRetailData()
  const [currentTime,setCurrentTime] = useState(() => new Date())
  useEffect(() => { const timer=window.setInterval(() => setCurrentTime(new Date()),60_000);return () => window.clearInterval(timer) },[])
  const [tab,setTab] = useState('Stock Overview')
  const lowCount = products.filter(product => product.stock <= product.minimumStock).length
  const tabs = [['Stock Overview',''],['Stock Movement',''],['Stock Adjustments',''],['Low Stock',String(lowCount)],['Expiry','0'],['Dead Stock',''],['Stock Transfer','']]
  const visibleProducts = tab === 'Low Stock' ? products.filter(product => product.stock <= product.minimumStock) : products
  return <motion.main className="inventory-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}><div className="inventory-title-row"><div className="inventory-title"><span><Icon name="box" size={28} /></span><div><h1>Inventory</h1><p>Track your stock, manage inventory and avoid running out of popular items.</p></div></div><div className="inventory-date"><span><Icon name="calendar" size={17} /> {currentTime.toLocaleDateString('en-PK',{timeZone:'Asia/Karachi',weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span><span><Icon name="clock" size={17} /> {currentTime.toLocaleTimeString('en-PK',{timeZone:'Asia/Karachi',hour:'2-digit',minute:'2-digit'})}</span></div></div><RetailDataStatus /><div className="inventory-tabs">{tabs.map(([label,count]) => <button key={label} className={tab === label ? 'active' : ''} disabled={['Expiry','Dead Stock','Stock Transfer'].includes(label)} title={['Expiry','Dead Stock','Stock Transfer'].includes(label) ? 'Planned for a later phase.' : undefined} onClick={() => setTab(label)}>{label}{count && <span className={label === 'Expiry' ? 'orange' : ''}>{count}</span>}</button>)}</div><div className="inventory-layout"><div className="inventory-main">{tab === 'Stock Movement' ? <StockMovementTable movements={movements} /> : tab === 'Stock Adjustments' ? <StockAdjustmentPanel /> : <><InventoryStats products={products} movements={movements} /><InventoryTable products={visibleProducts} /></>}</div><aside className="inventory-side"><StockAlerts products={products} /><InventoryQuickActions onAdjustment={() => setTab('Stock Adjustments')} /><CategoryStockSummary products={products} /></aside></div></motion.main>
}

export default function InventoryPage(props: PageProps) { return <PageShell {...props} activePage="Inventory" className="inventory-app" header={onMenu => <InventoryHeader onMenu={onMenu} />}><InventoryScreen /></PageShell> }
