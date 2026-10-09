import { useState,type FormEvent,type ReactNode } from 'react'
import { Icon } from '../../shared/ui/Icon'
import type { PosController } from './usePos'
import { formatPosMoney as money } from './pos-format'

export type PosDialogName = 'product'|'customer'|'held'|'discount'|'shift'|null

function Modal({ title,onClose,children,className='' }:{ title:string;onClose:()=>void;children:ReactNode;className?:string }) {
  return <div className="pos-modal-backdrop" role="presentation" onMouseDown={event => { if(event.target===event.currentTarget) onClose() }}><section className={`pos-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button onClick={onClose} aria-label="Close">×</button></header>{children}</section></div>
}

function ShiftDialog({ pos,onClose }:{ pos:PosController;onClose:()=>void }) {
  const [cash,setCash]=useState('0')
  const submit=async(event:FormEvent) => { event.preventDefault();if(await pos.openShift(Math.round((Number(cash)||0)*100))) onClose() }
  return <Modal title="Open Cash Shift" onClose={onClose}><form className="pos-form" onSubmit={submit}><p className="pos-form-intro">Enter the physical cash currently available in the drawer.</p><label>Opening Cash (Rs)<input autoFocus type="number" min="0" step="0.01" value={cash} onChange={event => setCash(event.target.value)} required /></label><footer><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={pos.busy}>{pos.busy?'Opening…':'Open Shift'}</button></footer></form></Modal>
}

function ProductDialog({ pos,onClose }:{ pos:PosController;onClose:()=>void }) {
  const [form,setForm]=useState({ name:'',barcode:'',category:'General',unit:'Piece',purchase:'',selling:'',stock:'0' })
  const update=(key:keyof typeof form,value:string) => setForm(current => ({...current,[key]:value}))
  const submit=async(event:FormEvent) => { event.preventDefault();const created=await pos.createProduct({ name:form.name,barcode:form.barcode,category:form.category,unit:form.unit,purchasePricePaisa:Math.round(Number(form.purchase)*100),sellingPricePaisa:Math.round(Number(form.selling)*100),openingStockMilli:Math.round(Number(form.stock)*1000) });if(created) onClose() }
  return <Modal title="Add Custom Product" onClose={onClose} className="pos-modal-wide"><form className="pos-form pos-form-grid" onSubmit={submit}><label className="full">Product Name<input autoFocus value={form.name} onChange={event => update('name',event.target.value)} maxLength={120} required /></label><label>Barcode<input value={form.barcode} onChange={event => update('barcode',event.target.value)} placeholder="Optional" /></label><label>Category<input value={form.category} onChange={event => update('category',event.target.value)} required /></label><label>Unit<select value={form.unit} onChange={event => update('unit',event.target.value)}><option>Piece</option><option>Kg</option><option>Liter</option><option>Pack</option><option>Tray</option></select></label><label>Opening Stock<input type="number" min="0" step="0.001" value={form.stock} onChange={event => update('stock',event.target.value)} required /></label><label>Purchase Price (Rs)<input type="number" min="0" step="0.01" value={form.purchase} onChange={event => update('purchase',event.target.value)} required /></label><label>Sale Price (Rs)<input type="number" min="0.01" step="0.01" value={form.selling} onChange={event => update('selling',event.target.value)} required /></label><footer className="full"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={pos.busy}>{pos.busy?'Saving…':'Save Product'}</button></footer></form></Modal>
}

function CustomerDialog({ pos,onClose }:{ pos:PosController;onClose:()=>void }) {
  const [name,setName]=useState('');const [phone,setPhone]=useState('')
  const submit=async(event:FormEvent) => { event.preventDefault();if(await pos.createCustomer({name,phone})) onClose() }
  return <Modal title="Add Customer" onClose={onClose}><form className="pos-form" onSubmit={submit}><label>Customer Name<input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={100} required /></label><label>Phone Number<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="03XX XXXXXXX" maxLength={25} required /></label><footer><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={pos.busy}>{pos.busy?'Saving…':'Add Customer'}</button></footer></form></Modal>
}

function HeldDialog({ pos,onClose }:{ pos:PosController;onClose:()=>void }) {
  return <Modal title="Held Sales" onClose={onClose} className="pos-modal-wide"><div className="held-sales-list">{pos.data?.heldSales.map(sale => { const customer=pos.data?.customers.find(item => item.id===sale.customerId);return <article key={sale.id}><div><strong>{customer?.name ?? 'Customer'}</strong><span>{sale.itemCount} items · {money(sale.totalPaisa)}</span><small>{new Date(sale.heldAt).toLocaleString('en-PK')}</small></div><button onClick={() => { void pos.deleteHeldSale(sale.id) }} className="danger">Delete</button><button onClick={() => { if(pos.cart.length && !window.confirm('Replace the current cart with this held sale?')) return;void pos.resumeSale(sale.id);onClose() }} className="primary">Resume</button></article>})}{!pos.data?.heldSales.length && <div className="pos-empty"><Icon name="clock" size={32} /><h3>No held sales</h3><p>Held carts will appear here.</p></div>}</div></Modal>
}

function DiscountDialog({ pos,onClose }:{ pos:PosController;onClose:()=>void }) {
  const [percent,setPercent]=useState('5')
  const apply=() => { const basisPoints=Math.round(Math.min(100,Math.max(0,Number(percent)||0))*100);for(const line of pos.cart) pos.setDiscount(line.id,basisPoints);onClose() }
  return <Modal title="Quick Discount" onClose={onClose}><div className="pos-form"><p className="pos-form-intro">Apply the same percentage discount to every item in the cart.</p><label>Discount Percentage<input autoFocus type="number" min="0" max="100" step="0.01" value={percent} onChange={event => setPercent(event.target.value)} /></label><div className="discount-presets">{[5,10,15,20].map(value => <button key={value} onClick={() => setPercent(String(value))}>{value}%</button>)}</div><footer><button onClick={onClose}>Cancel</button><button className="primary" onClick={apply} disabled={!pos.cart.length}>Apply Discount</button></footer></div></Modal>
}

export function PosDialogs({ dialog,pos,onClose }:{ dialog:PosDialogName;pos:PosController;onClose:()=>void }) {
  return <>{dialog==='shift'&&<ShiftDialog pos={pos} onClose={onClose}/>} {dialog==='product'&&<ProductDialog pos={pos} onClose={onClose}/>} {dialog==='customer'&&<CustomerDialog pos={pos} onClose={onClose}/>} {dialog==='held'&&<HeldDialog pos={pos} onClose={onClose}/>} {dialog==='discount'&&<DiscountDialog pos={pos} onClose={onClose}/>}</>
}

export function ReceiptDialog({ pos }:{ pos:PosController }) {
  const receipt=pos.receipt
  if(!receipt) return null
  return <div className="pos-modal-backdrop"><section className="pos-modal receipt-modal" role="dialog" aria-modal="true" aria-label="Sale receipt"><header><h2>Sale Completed</h2><button onClick={() => pos.setReceipt(null)}>×</button></header><div className="receipt-print"><div className="receipt-brand"><strong>{pos.data?.businessName}</strong><span>{pos.data?.branchName}</span></div><div className="receipt-meta"><span>Invoice</span><b>{receipt.invoiceNumber}</b><span>Date</span><b>{new Date(receipt.completedAt).toLocaleString('en-PK')}</b><span>Customer</span><b>{receipt.customerName}</b></div><table><thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead><tbody>{receipt.lines.map((line,index) => <tr key={`${line.name}-${index}`}><td>{line.name}{line.discountPaisa>0&&<small>Discount {money(line.discountPaisa)}</small>}</td><td>{line.quantityMilli/1000}</td><td>{money(line.lineTotalPaisa)}</td></tr>)}</tbody></table><div className="receipt-totals"><span>Subtotal</span><b>{money(receipt.subtotalPaisa)}</b><span>Discount</span><b>{money(receipt.discountPaisa)}</b><strong>Total</strong><strong>{money(receipt.totalPaisa)}</strong><span>{receipt.paymentMethod}</span><b>{money(receipt.cashReceivedPaisa)}</b>{receipt.changePaisa>0&&<><span>Change</span><b>{money(receipt.changePaisa)}</b></>}</div><p>Thank you for shopping with us.</p></div><footer className="receipt-actions"><button onClick={() => pos.setReceipt(null)}>Close</button><button className="primary" onClick={() => window.print()}><Icon name="receipt" size={16}/> Print Receipt</button></footer></section></div>
}
