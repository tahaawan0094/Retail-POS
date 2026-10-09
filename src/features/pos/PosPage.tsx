import { useEffect,useRef,useState } from 'react'
import { Icon } from '../../shared/ui/Icon'
import { PageShell,type PageProps } from '../../shared/layout/PageShell'
import { PosDialogs,ReceiptDialog,type PosDialogName } from './PosDialogs'
import { PosHeader } from './PosHeader'
import { PosWorkspace } from './PosWorkspace'
import { usePos } from './usePos'

export default function PosPage(props:PageProps) {
  const pos=usePos()
  const [search,setSearch]=useState('')
  const [dialog,setDialog]=useState<PosDialogName>(null)
  const searchRef=useRef<HTMLInputElement>(null)

  useEffect(() => {
    const shortcut=(event:KeyboardEvent) => { if(event.key==='F2'){event.preventDefault();searchRef.current?.focus();searchRef.current?.select()} }
    window.addEventListener('keydown',shortcut)
    return () => window.removeEventListener('keydown',shortcut)
  },[])

  const addSearchMatch=() => {
    const query=search.trim().toLowerCase()
    if(!query) return
    const matches=(pos.data?.products ?? []).filter(product => product.barcode?.toLowerCase()===query || product.sku.toLowerCase()===query || product.name.toLowerCase()===query)
    const fallback=(pos.data?.products ?? []).filter(product => `${product.name} ${product.sku} ${product.barcode ?? ''}`.toLowerCase().includes(query))
    const product=matches[0] ?? (fallback.length===1 ? fallback[0] : undefined)
    if(!product){pos.setError('No unique product matches this barcode or search.');return}
    pos.addProduct(product);setSearch('')
  }

  const header=(onMenu:()=>void) => <PosHeader ref={searchRef} onMenu={onMenu} data={pos.data} search={search} onSearch={setSearch} onSearchEnter={addSearchMatch} customerId={pos.customerId} onCustomer={pos.setCustomerId} onAddCustomer={() => setDialog('customer')} onScan={() => searchRef.current?.focus()} />
  let content
  if(pos.loading && !pos.data) content=<main className="pos-runtime-state"><span className="dashboard-spinner"/><h1>Loading POS</h1><p>Reading products, customers and shift status from SQLite…</p></main>
  else if(pos.error && !pos.data) content=<main className="pos-runtime-state error"><Icon name="warning" size={30}/><h1>POS unavailable</h1><p>{pos.error}</p><button onClick={() => void pos.refresh()}>Retry</button></main>
  else content=<PosWorkspace pos={pos} search={search} onCustom={() => setDialog('product')} onHeld={() => setDialog('held')} onDiscount={() => setDialog('discount')} onOpenShift={() => setDialog('shift')} />

  return <PageShell {...props} activePage="POS" className="pos-app" header={header}>{content}{pos.error && pos.data && <div className="pos-toast error" role="alert"><Icon name="warning" size={17}/>{pos.error}<button onClick={() => pos.setError('')}>×</button></div>}{pos.notice && <div className="pos-toast success" role="status"><Icon name="check" size={17}/>{pos.notice}</div>}<PosDialogs dialog={dialog} pos={pos} onClose={() => setDialog(null)}/><ReceiptDialog pos={pos}/></PageShell>
}
