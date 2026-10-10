import { useCallback,useEffect,useRef,useState } from 'react'
import { useOperationIdentity } from '../../shared/hooks/useOperationIdentity'
import { notifyRetailDataChanged } from '../../services/retail-events'
import type { SalesDetail,SalesListQuery,SalesPeriod,SalesReturnRequest,SalesSnapshot,SalesStatusFilter } from '../../types/desktop-api'

const empty:SalesSnapshot={businessDate:'',rangeLabel:'Today',comparisonLabel:'vs yesterday',totalSalesPaisa:0,salesChangePercent:0,transactionCount:0,transactionChangePercent:0,averageOrderPaisa:0,averageChangePercent:0,returnsPaisa:0,returnsChangePercent:0,chart:[],payments:[],sales:[],total:0,page:1,pageSize:10,pageCount:1}

export function useSales() {
  const returnOperation = useOperationIdentity('sale-return')
  const returnBusyRef = useRef(false)
  const [data,setData]=useState<SalesSnapshot>(empty)
  const [period,setPeriod]=useState<SalesPeriod>('today')
  const [search,setSearchState]=useState('')
  const [paymentMethod,setPaymentMethodState]=useState('all')
  const [status,setStatusState]=useState<SalesStatusFilter>('all')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSizeState]=useState(10)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [detail,setDetail]=useState<SalesDetail|null>(null)
  const query:SalesListQuery={branchId:'branch-main',period,search,paymentMethod,status,page,pageSize}

  const refresh=useCallback(async()=>{
    if(!window.vertexia){setError('Desktop database is unavailable. Start Vertexia with npm run dev:desktop.');setLoading(false);return}
    try{const snapshot=await window.vertexia.sales.getSnapshot({branchId:'branch-main',period,search,paymentMethod,status,page,pageSize});setData(snapshot);setError('');if(snapshot.page!==page)setPage(snapshot.page)}catch(cause){setError(cause instanceof Error?cause.message:'Sales could not be loaded.')}finally{setLoading(false)}
  },[period,search,paymentMethod,status,page,pageSize])

  useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),search?180:0);return()=>window.clearTimeout(timer)},[refresh,search])
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),3500);return()=>window.clearTimeout(timer)},[notice])
  const setSearch=(value:string)=>{setSearchState(value);setPage(1)}
  const setPaymentMethod=(value:string)=>{setPaymentMethodState(value);setPage(1)}
  const setStatus=(value:SalesStatusFilter)=>{setStatusState(value);setPage(1)}
  const changePeriod=(value:SalesPeriod)=>{setPeriod(value);setPage(1)}
  const setPageSize=(value:number)=>{setPageSizeState(value);setPage(1)}
  const openDetail=async(id:string)=>{if(!window.vertexia)return;setBusy(true);setError('');try{setDetail(await window.vertexia.sales.getDetail('branch-main',id))}catch(cause){setError(cause instanceof Error?cause.message:'Invoice could not be loaded.')}finally{setBusy(false)}}
  const reloadDetail=async()=>{if(detail&&window.vertexia)setDetail(await window.vertexia.sales.getDetail('branch-main',detail.id))}
  const createReturn=async(lines:SalesReturnRequest['lines'],reason:string)=>{if(!window.vertexia||!detail||returnBusyRef.current)return false;returnBusyRef.current=true;setBusy(true);setError('');try{const request={branchId:'branch-main',saleId:detail.id,reason,lines};const result=await window.vertexia.sales.createReturn({...request,operationId:returnOperation.idFor(request)});returnOperation.reset();notifyRetailDataChanged();setNotice(`${result.returnNumber} completed. Refund Rs ${(result.totalPaisa/100).toLocaleString('en-PK')}.`);await refresh();try{await reloadDetail()}catch{setError('Return was posted, but the invoice could not be refreshed. Reload Sales before posting another return.')}return true}catch(cause){setError(cause instanceof Error?cause.message:'Return could not be completed.');return false}finally{returnBusyRef.current=false;setBusy(false)}}
  const exportCsv=async()=>{if(!window.vertexia)return;setBusy(true);try{const result=await window.vertexia.sales.exportCsv(query);if(!result.canceled)setNotice(`Sales exported to ${result.path}.`)}catch(cause){setError(cause instanceof Error?cause.message:'Sales could not be exported.')}finally{setBusy(false)}}

  return{data,period,changePeriod,search,setSearch,paymentMethod,setPaymentMethod,status,setStatus,page,setPage,pageSize,setPageSize,loading,busy,error,setError,notice,detail,setDetail,openDetail,createReturn,exportCsv,refresh}
}

export type SalesController=ReturnType<typeof useSales>
