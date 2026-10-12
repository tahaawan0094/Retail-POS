import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { BranchActiveRequest, BranchCreateRequest, BranchRecord, BranchUpdateRequest } from '../../src/types/branches.js'
import { postOperation, requireSafeInteger, requireText } from './posting.mjs'

type Row = Record<string,string|number|null>
export class BranchRepository {
  constructor(private readonly db:DatabaseSync,private readonly businessId:string,private readonly actor:()=>string,private readonly now:()=>Date) {}
  private owner() {
    if(!this.db.prepare("SELECT 1 FROM users WHERE id=? AND business_id=? AND role='Owner' AND is_active=1").get(this.actor(),this.businessId))throw new Error('Only an owner can manage business branches.')
  }
  private branch(id:string,active=false) {
    requireText(id,'Branch',100)
    const row=this.db.prepare(`SELECT * FROM branches WHERE id=? AND business_id=?${active?' AND is_active=1':''}`).get(id,this.businessId) as Row|undefined
    if(!row)throw new Error('Business branch is unavailable.')
    return row
  }
  private label(value:string,name:string,limit:number) {
    const result=requireText(value,name,limit)
    if(Array.from(result).some(c=>c.charCodeAt(0)<32))throw new Error(name+' cannot contain control characters.')
    return result
  }
  private catalog(branchId:string,time:string) {
    this.db.prepare('INSERT OR IGNORE INTO stock_levels SELECT ?,id,0,? FROM products WHERE business_id=?').run(branchId,time,this.businessId)
    this.db.prepare('INSERT OR IGNORE INTO stock_values SELECT branch_id,product_id,0,0,? FROM stock_levels WHERE branch_id=? AND quantity_milli=0').run(time,branchId)
  }
  private audit(branchId:string,id:string,message:string,reference:string,time:string) {
    this.db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?,?,?)').run('audit-'+randomUUID(),branchId,this.actor(),'Branch','branch',id,message,reference,time)
  }
  list():BranchRecord[] {
    this.owner()
    return (this.db.prepare(`SELECT b.*,
      (SELECT COUNT(*) FROM stock_levels WHERE branch_id=b.id AND quantity_milli>0) AS stocked,
      (SELECT COALESCE(SUM(total_cost_paisa),0) FROM stock_values WHERE branch_id=b.id) AS value,
      (SELECT COUNT(*) FROM user_branches ub JOIN users u ON u.id=ub.user_id JOIN user_credentials c ON c.user_id=u.id WHERE ub.branch_id=b.id AND u.is_active=1) AS staff,
      (SELECT COUNT(*) FROM cash_shifts WHERE branch_id=b.id AND status='open') AS shifts,
      (SELECT COUNT(*) FROM stock_transfers WHERE (source_branch_id=b.id OR destination_branch_id=b.id) AND status='dispatched') AS transfers
      FROM branches b WHERE b.business_id=? ORDER BY b.is_active DESC,b.code,b.id`).all(this.businessId) as Row[]).map(row=>({id:String(row.id),name:String(row.name),code:String(row.code),city:String(row.city),isActive:Number(row.is_active)===1,createdAt:String(row.created_at),stockedProducts:Number(row.stocked),stockValuePaisa:requireSafeInteger(Number(row.value),'Branch stock value'),assignedStaff:Number(row.staff),openShifts:Number(row.shifts),pendingTransfers:Number(row.transfers)}))
  }
  create(request:BranchCreateRequest) {
    this.owner();this.branch(request.branchId,true);requireText(request.operationId,'Operation identifier',100)
    const name=this.label(request.name,'Branch name',120),city=this.label(request.city,'City',120),code=this.label(request.code,'Branch code',20).toUpperCase()
    if(!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code))throw new Error('Branch code needs 2–20 letters, numbers, dashes or underscores.')
    return postOperation(this.db,request.branchId,request.operationId,'branch.create',request,this.now().toISOString(),()=>{
      if(this.db.prepare('SELECT 1 FROM branches WHERE business_id=? AND code=? COLLATE NOCASE').get(this.businessId,code))throw new Error('This branch code is already in use.')
      if(Number(this.db.prepare('SELECT COUNT(*) AS n FROM branches WHERE business_id=?').get(this.businessId)!.n)>=100)throw new Error('This installation supports up to 100 branches.')
      const id='branch-'+randomUUID(),time=this.now().toISOString()
      this.db.prepare('INSERT INTO branches VALUES (?,?,?,?,?,?,?)').run(id,this.businessId,name,code,city,1,time)
      this.catalog(id,time)
      this.db.prepare('INSERT INTO user_branches VALUES (?,?)').run(this.actor(),id)
      this.audit(request.branchId,id,'Branch created',code+' · '+name,time)
      return {branchId:id}
    })
  }
  update(request:BranchUpdateRequest) {
    this.owner();this.branch(request.branchId,true)
    const name=this.label(request.name,'Branch name',120),city=this.label(request.city,'City',120)
    return postOperation(this.db,request.branchId,request.operationId,'branch.update',request,this.now().toISOString(),()=>{
      const target=this.branch(request.targetBranchId),time=this.now().toISOString()
      this.db.prepare('UPDATE branches SET name=?,city=? WHERE id=?').run(name,city,request.targetBranchId)
      this.audit(request.branchId,request.targetBranchId,'Branch details updated',String(target.code)+' · '+name,time)
      return {branchId:request.targetBranchId}
    })
  }
  setActive(request:BranchActiveRequest) {
    this.owner();this.branch(request.branchId,true)
    if(typeof request.isActive!=='boolean')throw new Error('Select a valid branch status.')
    const reason=this.label(request.reason,'Status reason',250)
    if(reason.length<3)throw new Error('Branch status reason must contain at least 3 characters.')
    return postOperation(this.db,request.branchId,request.operationId,'branch.status',request,this.now().toISOString(),()=>{
      const target=this.branch(request.targetBranchId)
      if((Number(target.is_active)===1)===request.isActive)throw new Error('Branch already has this status.')
      if(!request.isActive) {
        if(request.targetBranchId===request.branchId)throw new Error('Switch to another branch before archiving the current branch.')
        const exists=(sql:string)=>Boolean(this.db.prepare(sql).get(request.targetBranchId))
        if(exists("SELECT 1 FROM cash_shifts WHERE branch_id=? AND status='open'"))throw new Error('Close the branch cash shift before archiving.')
        if(this.db.prepare("SELECT 1 FROM stock_transfers WHERE (source_branch_id=? OR destination_branch_id=?) AND status='dispatched'").get(request.targetBranchId,request.targetBranchId))throw new Error('Complete or cancel pending transfers before archiving.')
        if(exists('SELECT 1 FROM stock_levels WHERE branch_id=? AND quantity_milli!=0')||exists('SELECT 1 FROM stock_values WHERE branch_id=? AND total_cost_paisa!=0'))throw new Error('Clear branch stock before archiving.')
        if(exists('SELECT 1 FROM held_sales WHERE branch_id=?'))throw new Error('Complete or delete held carts before archiving.')
        for(const [table,key] of [['customer_ledger','customer_id'],['supplier_ledger','supplier_id']])if(exists(`SELECT 1 FROM ${table} WHERE branch_id=? GROUP BY ${key} HAVING SUM(debit_paisa-credit_paisa)!=0`))throw new Error('Settle branch customer and supplier balances before archiving.')
        if(exists(`SELECT 1 FROM user_branches ub JOIN users u ON u.id=ub.user_id JOIN user_credentials c ON c.user_id=u.id WHERE ub.branch_id=? AND u.is_active=1 AND NOT EXISTS(SELECT 1 FROM user_branches other JOIN branches b ON b.id=other.branch_id WHERE other.user_id=u.id AND other.branch_id!=ub.branch_id AND b.is_active=1)`))throw new Error('Assign active staff another branch before archiving their only branch.')
      }
      const time=this.now().toISOString()
      this.db.prepare('UPDATE branches SET is_active=? WHERE id=?').run(Number(request.isActive),request.targetBranchId)
      if(request.isActive) {
        this.catalog(request.targetBranchId,time)
        this.db.prepare('INSERT OR IGNORE INTO user_branches VALUES (?,?)').run(this.actor(),request.targetBranchId)
      }
      this.audit(request.branchId,request.targetBranchId,request.isActive?'Branch reactivated':'Branch archived',reason,time)
      return {branchId:request.targetBranchId}
    })
  }
}
