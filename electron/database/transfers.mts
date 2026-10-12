import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { TransferCancelRequest, TransferDispatchRequest, TransferQuery, TransferReceiveRequest, TransferRecord, TransferSnapshot, TransferStatus } from '../../src/types/branches.js'
import { postOperation, requireSafeInteger, requireText } from './posting.mjs'
import { retailBusinessDate } from './retail.mjs'
import { changeStockValue, stockCost } from './valuation.mjs'

type Row=Record<string,string|number|null>
export class TransferRepository {
  constructor(private readonly db:DatabaseSync,private readonly businessId:string,private readonly actor:()=>string,private readonly now:()=>Date) {}
  private branch(id:string) {
    requireText(id,'Branch',100)
    const row=this.db.prepare('SELECT id,name,code FROM branches WHERE id=? AND business_id=? AND is_active=1').get(id,this.businessId) as Row|undefined
    if(!row)throw new Error('Transfer branch is unavailable.')
    return row
  }
  private transfer(branchId:string,id:string):Row {
    requireText(id,'Transfer',100)
    const row=this.db.prepare('SELECT * FROM stock_transfers WHERE id=? AND business_id=? AND (source_branch_id=? OR destination_branch_id=?)').get(id,this.businessId,branchId,branchId) as Row|undefined
    if(!row)throw new Error('Transfer was not found in this branch.')
    return row
  }
  private record(id:string):TransferRecord {
    const row=this.db.prepare(`SELECT t.*,s.name AS source,d.name AS destination,u.name AS sender,f.name AS finisher FROM stock_transfers t
      JOIN branches s ON s.id=t.source_branch_id JOIN branches d ON d.id=t.destination_branch_id JOIN users u ON u.id=t.dispatched_by LEFT JOIN users f ON f.id=t.finished_by WHERE t.id=? AND t.business_id=?`).get(id,this.businessId) as Row
    const lines=(this.db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id=? ORDER BY product_name_snapshot,product_id').all(id) as Row[]).map(item=>({productId:String(item.product_id),name:String(item.product_name_snapshot),sku:String(item.sku_snapshot),unit:String(item.unit_snapshot),quantityMilli:Number(item.quantity_milli),costPaisa:Number(item.cost_paisa),estimated:Number(item.estimated)===1}))
    return {id,number:String(row.transfer_number),sourceBranchId:String(row.source_branch_id),sourceBranchName:String(row.source),destinationBranchId:String(row.destination_branch_id),destinationBranchName:String(row.destination),status:String(row.status) as TransferStatus,note:String(row.note),dispatchedAt:String(row.dispatched_at),dispatchedBy:String(row.sender),finishedAt:row.finished_at===null?null:String(row.finished_at),finishedBy:row.finisher===null?null:String(row.finisher),finishNote:String(row.finish_note),totalCostPaisa:requireSafeInteger(lines.reduce((sum,item)=>sum+item.costPaisa,0),'Transfer cost'),lines}
  }
  detail(branchId:string,id:string) {
    this.branch(branchId);this.transfer(branchId,id)
    return this.record(id)
  }
  private audit(branchId:string,id:string,description:string,reference:string,time:string) {
    this.db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?,?,?)').run('audit-'+randomUUID(),branchId,this.actor(),'Stock Transfer','stock_transfer',id,description,reference,time)
  }
  private number(branchId:string,code:string,date:string) {
    this.db.prepare('INSERT OR IGNORE INTO transfer_document_sequences VALUES (?,?,0)').run(branchId,date)
    const row=this.db.prepare('UPDATE transfer_document_sequences SET last_value=last_value+1 WHERE branch_id=? AND business_date=? RETURNING last_value').get(branchId,date)!
    return `TRF-${code}-${date.replaceAll('-','')}-${String(requireSafeInteger(Number(row.last_value),'Transfer number',1)).padStart(4,'0')}`
  }
  dispatch(request:TransferDispatchRequest):TransferRecord {
    if(!request||typeof request!=='object')throw new Error('Invalid transfer request.')
    requireText(request.operationId,'Operation identifier',100)
    const note=requireText(request.note,'Dispatch note',250,true)
    if(request.branchId===request.destinationBranchId)throw new Error('Choose a different destination branch.')
    if(!Array.isArray(request.lines)||!request.lines.length||request.lines.length>100)throw new Error('Add between 1 and 100 transfer products.')
    return postOperation(this.db,request.branchId,request.operationId,'transfer.dispatch',request,this.now().toISOString(),()=>{
      const source=this.branch(request.branchId);this.branch(request.destinationBranchId)
      const seen=new Set<string>()
      const lines=request.lines.map(line=>{
        if(!line||typeof line!=='object')throw new Error('Invalid transfer product.')
        requireText(line.productId,'Product',100);requireSafeInteger(line.quantityMilli,'Transfer quantity',1)
        if(seen.has(line.productId))throw new Error('Add each transfer product only once.')
        seen.add(line.productId)
        const product=this.db.prepare('SELECT p.*,s.quantity_milli FROM products p JOIN stock_levels s ON s.product_id=p.id AND s.branch_id=? WHERE p.id=? AND p.business_id=? AND p.is_active=1').get(request.branchId,line.productId,this.businessId) as Row|undefined
        if(!product)throw new Error('Select an active product stocked at the source branch.')
        if(Number(product.quantity_milli)<line.quantityMilli)throw new Error(String(product.name)+' has insufficient stock for transfer.')
        const cost=stockCost(this.db,request.branchId,line.productId,line.quantityMilli)
        return {product,quantityMilli:line.quantityMilli,costPaisa:cost.costPaisa,estimated:cost.estimated}
      })
      requireSafeInteger(lines.reduce((sum,item)=>sum+item.costPaisa,0),'Total transfer cost')
      const id='transfer-'+randomUUID(),time=this.now().toISOString(),date=retailBusinessDate(this.now()),number=this.number(request.branchId,String(source.code),date)
      this.db.prepare(`INSERT INTO stock_transfers(id,business_id,source_branch_id,destination_branch_id,transfer_number,business_date,note,status,dispatched_by,dispatched_at) VALUES (?,?,?,?,?,?,?,'dispatched',?,?)`).run(id,this.businessId,request.branchId,request.destinationBranchId,number,date,note,this.actor(),time)
      for(const line of lines) {
        const productId=String(line.product.id),movementId='stock-'+randomUUID(),balance=Number(line.product.quantity_milli)-line.quantityMilli
        this.db.prepare('INSERT INTO stock_transfer_items VALUES (?,?,?,?,?,?,?,?)').run(id,productId,String(line.product.name),String(line.product.sku),String(line.product.unit),line.quantityMilli,line.costPaisa,Number(line.estimated))
        const updated=this.db.prepare('UPDATE stock_levels SET quantity_milli=?,updated_at=? WHERE branch_id=? AND product_id=? AND quantity_milli>=?').run(balance,time,request.branchId,productId,line.quantityMilli)
        if(updated.changes!==1)throw new Error('Source stock changed. Refresh before dispatching.')
        this.db.prepare('INSERT INTO stock_movements VALUES (?,?,?,?,?,?,?,?,?,?)').run(movementId,request.branchId,productId,'transfer_out',-line.quantityMilli,balance,'stock_transfer',id,number,time)
        changeStockValue(this.db,request.branchId,productId,-line.costPaisa,false,time,movementId)
      }
      this.audit(request.branchId,id,'Stock dispatched to branch',number,time)
      return this.record(id)
    })
  }
  private addStock(branchId:string,transferId:string,number:string,type:'transfer_in'|'transfer_cancel',time:string) {
    const lines=this.db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id=?').all(transferId) as Row[]
    for(const line of lines) {
      const productId=String(line.product_id),quantity=Number(line.quantity_milli),movementId='stock-'+randomUUID()
      // Receipt remains possible if the catalog product was deactivated in transit.
      if(!this.db.prepare('SELECT 1 FROM products WHERE id=? AND business_id=?').get(productId,this.businessId))throw new Error('Transfer product no longer belongs to this business.')
      this.db.prepare('INSERT OR IGNORE INTO stock_levels VALUES (?,?,0,?)').run(branchId,productId,time)
      const old=this.db.prepare('SELECT quantity_milli FROM stock_levels WHERE branch_id=? AND product_id=?').get(branchId,productId)!
      if(Number(old.quantity_milli)>0&&!this.db.prepare('SELECT 1 FROM stock_values WHERE branch_id=? AND product_id=?').get(branchId,productId))throw new Error('Destination stock valuation is missing. Contact support.')
      const balance=requireSafeInteger(Number(old.quantity_milli)+quantity,'Receiving stock balance')
      this.db.prepare('UPDATE stock_levels SET quantity_milli=?,updated_at=? WHERE branch_id=? AND product_id=?').run(balance,time,branchId,productId)
      this.db.prepare('INSERT INTO stock_movements VALUES (?,?,?,?,?,?,?,?,?,?)').run(movementId,branchId,productId,type,quantity,balance,'stock_transfer',transferId,number,time)
      changeStockValue(this.db,branchId,productId,Number(line.cost_paisa),Number(line.estimated)===1,time,movementId)
    }
  }
  receive(request:TransferReceiveRequest):TransferRecord {
    requireText(request.operationId,'Operation identifier',100)
    const note=requireText(request.note,'Receipt note',250,true)
    return postOperation(this.db,request.branchId,request.operationId,'transfer.receive',request,this.now().toISOString(),()=>{
      this.branch(request.branchId);const transfer=this.transfer(request.branchId,request.transferId)
      if(transfer.destination_branch_id!==request.branchId)throw new Error('Only the destination branch can receive this transfer.')
      if(transfer.status!=='dispatched')throw new Error('This transfer is no longer awaiting receipt.')
      const time=this.now().toISOString()
      this.addStock(request.branchId,request.transferId,String(transfer.transfer_number),'transfer_in',time)
      this.db.prepare("UPDATE stock_transfers SET status='received',finished_by=?,finished_at=?,finish_note=? WHERE id=? AND status='dispatched'").run(this.actor(),time,note,request.transferId)
      this.audit(request.branchId,request.transferId,'Branch received transferred stock',String(transfer.transfer_number),time)
      return this.record(request.transferId)
    })
  }
  cancel(request:TransferCancelRequest):TransferRecord {
    requireText(request.operationId,'Operation identifier',100)
    const reason=requireText(request.reason,'Cancellation reason',250)
    if(reason.length<3)throw new Error('Enter a cancellation reason of at least 3 characters.')
    return postOperation(this.db,request.branchId,request.operationId,'transfer.cancel',request,this.now().toISOString(),()=>{
      this.branch(request.branchId);const transfer=this.transfer(request.branchId,request.transferId)
      if(transfer.source_branch_id!==request.branchId)throw new Error('Only the source branch can cancel this transfer.')
      if(transfer.status!=='dispatched')throw new Error('Only a pending transfer can be cancelled.')
      const time=this.now().toISOString()
      this.addStock(request.branchId,request.transferId,String(transfer.transfer_number),'transfer_cancel',time)
      this.db.prepare("UPDATE stock_transfers SET status='cancelled',finished_by=?,finished_at=?,finish_note=? WHERE id=? AND status='dispatched'").run(this.actor(),time,reason,request.transferId)
      this.audit(request.branchId,request.transferId,'Stock transfer cancelled and returned to source',reason,time)
      return this.record(request.transferId)
    })
  }
  list(query:TransferQuery):TransferSnapshot {
    this.branch(query.branchId)
    if(!['all','dispatched','received','cancelled'].includes(query.status))throw new Error('Select a valid transfer filter.')
    const pageSize=requireSafeInteger(query.pageSize,'Page size',1),requested=requireSafeInteger(query.page,'Page',1)
    if(pageSize>100)throw new Error('Transfer page size cannot exceed 100.')
    this.db.exec('BEGIN')
    try {
      const where=`business_id=? AND (source_branch_id=? OR destination_branch_id=?)${query.status==='all'?'':' AND status=?'}`,params=[this.businessId,query.branchId,query.branchId,...(query.status==='all'?[]:[query.status])]
      const total=Number(this.db.prepare(`SELECT COUNT(*) AS n FROM stock_transfers WHERE ${where}`).get(...params)!.n),pageCount=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(requested,pageCount)
      const rows=this.db.prepare(`SELECT id FROM stock_transfers WHERE ${where} ORDER BY dispatched_at DESC,rowid DESC LIMIT ? OFFSET ?`).all(...params,pageSize,(page-1)*pageSize) as Row[]
      const pending=(column:'source_branch_id'|'destination_branch_id')=>this.db.prepare(`SELECT COUNT(*) AS n,COALESCE(SUM((SELECT SUM(cost_paisa) FROM stock_transfer_items WHERE transfer_id=t.id)),0) AS value FROM stock_transfers t WHERE ${column}=? AND business_id=? AND status='dispatched'`).get(query.branchId,this.businessId)!
      const outbound=pending('source_branch_id'),inbound=pending('destination_branch_id')
      const result={records:rows.map(row=>this.record(String(row.id))),total,page,pageCount,outboundCount:Number(outbound.n),inboundCount:Number(inbound.n),outboundValuePaisa:requireSafeInteger(Number(outbound.value),'Outbound stock value'),inboundValuePaisa:requireSafeInteger(Number(inbound.value),'Inbound stock value')}
      this.db.exec('COMMIT');return result
    }catch(error){this.db.exec('ROLLBACK');throw error}
  }
}
