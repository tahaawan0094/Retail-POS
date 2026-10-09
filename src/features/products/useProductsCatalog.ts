import { useCallback,useEffect,useState } from 'react'
import type { ProductCatalogResult,ProductSaveInput } from '../../types/desktop-api'
import type { ProductDraft,ProductRecord } from './products.types'

const emptyResult:ProductCatalogResult={ products:[],total:0,page:1,pageSize:12,pageCount:1,categories:[],brands:[] }
const toRecord=(product:ProductCatalogResult['products'][number]):ProductRecord => ({ id:product.id,kind:product.kind,name:product.name,barcode:product.barcode,sku:product.sku,category:product.category,subcategory:product.subcategory,brand:product.brand,unit:product.unit,purchasePriceRupees:product.purchasePricePaisa/100,sellingPriceRupees:product.sellingPricePaisa/100,mrpRupees:product.mrpPaisa/100,minimumStock:product.minimumStockMilli/1000,stock:product.stockMilli/1000,status:product.status,imageDataUrl:product.imageDataUrl,createdAt:product.createdAt,updatedAt:product.updatedAt })

export function useProductsCatalog() {
  const [result,setResult]=useState(emptyResult)
  const [search,setSearch]=useState('')
  const [category,setCategory]=useState('all')
  const [brand,setBrand]=useState('all')
  const [status,setStatus]=useState<'all'|'active'|'inactive'|'low_stock'|'out_of_stock'>('all')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(12)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  const refresh=useCallback(async() => {
    if(!window.vertexia){setError('Desktop database is unavailable. Start Vertexia with npm run dev:desktop.');setLoading(false);return}
    try { const data=await window.vertexia.products.list({branchId:'branch-main',search,category,brand,status,page,pageSize});setResult(data);setError('');if(data.page!==page)setPage(data.page) }
    catch(cause){setError(cause instanceof Error?cause.message:'Products could not be loaded.')}
    finally{setLoading(false)}
  },[search,category,brand,status,page,pageSize])

  useEffect(() => { const timer=window.setTimeout(() => void refresh(),search?180:0);return () => window.clearTimeout(timer) },[refresh,search])
  useEffect(() => { if(!notice)return;const timer=window.setTimeout(() => setNotice(''),3000);return () => window.clearTimeout(timer) },[notice])
  const changeFilter=(setter:(value:string)=>void,value:string) => { setter(value);setPage(1) }

  const save=async(draft:ProductDraft,id?:string) => {
    if(!window.vertexia)return false
    const input:ProductSaveInput={ id,name:draft.name,sku:draft.sku,barcode:draft.barcode,category:draft.category,subcategory:draft.subcategory,brand:draft.brand,unit:draft.unit,purchasePricePaisa:Math.round(draft.purchasePriceRupees*100),sellingPricePaisa:Math.round(draft.sellingPriceRupees*100),mrpPaisa:Math.round(draft.mrpRupees*100),minimumStockMilli:Math.round(draft.minimumStock*1000),openingStockMilli:Math.round(draft.stock*1000),status:draft.status,imageDataUrl:draft.imageDataUrl ?? null }
    setBusy(true);setError('')
    try { await window.vertexia.products.save('branch-main',input);setNotice(id?'Product updated successfully.':'Product and opening stock saved.');await refresh();return true }
    catch(cause){setError(cause instanceof Error?cause.message:'Product could not be saved.');return false}
    finally{setBusy(false)}
  }

  const toggle=async(id:string) => { if(!window.vertexia)return;setBusy(true);try{const next=await window.vertexia.products.toggleStatus('branch-main',id);setNotice(`Product ${next==='active'?'activated':'deactivated'}.`);await refresh()}catch(cause){setError(cause instanceof Error?cause.message:'Status could not be changed.')}finally{setBusy(false)} }
  const importCsv=async(file:File) => { if(!window.vertexia)return;setBusy(true);try{const csv=await file.text();const imported=await window.vertexia.products.importCsv('branch-main',csv);setNotice(`${imported.imported} products imported successfully.`);await refresh()}catch(cause){setError(cause instanceof Error?cause.message:'Products could not be imported.')}finally{setBusy(false)} }
  const exportCsv=async() => { if(!window.vertexia)return;setBusy(true);try{const exported=await window.vertexia.products.exportCsv('branch-main');if(!exported.canceled)setNotice(`Products exported to ${exported.path}.`)}catch(cause){setError(cause instanceof Error?cause.message:'Products could not be exported.')}finally{setBusy(false)} }

  return { products:result.products.map(toRecord),total:result.total,pageCount:result.pageCount,categories:result.categories,brands:result.brands,search,setSearch:(value:string)=>changeFilter(setSearch,value),category,setCategory:(value:string)=>changeFilter(setCategory,value),brand,setBrand:(value:string)=>changeFilter(setBrand,value),status,setStatus:(value:typeof status)=>{setStatus(value);setPage(1)},page,setPage,pageSize,setPageSize:(value:number)=>{setPageSize(value);setPage(1)},loading,busy,error,setError,notice,refresh,save,toggle,importCsv,exportCsv }
}

export type ProductsController=ReturnType<typeof useProductsCatalog>
