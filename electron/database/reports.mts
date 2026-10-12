import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type { ReportColumn, ReportQuery, ReportSection, ReportSnapshot, ReportTable, StockValuation } from '../../src/types/reports.js'
import { expenseFacts } from './accounts.mjs'
import { requireBusinessDate, requireSafeInteger } from './posting.mjs'
import { proportionalCost } from './valuation.mjs'

type Row = Record<string, string | number | null>
const saleFacts = `(SELECT s.branch_id,s.business_date,s.invoice_number AS document,c.name AS customer,p.method,
  s.total_paisa AS amount,s.cost_paisa AS cost,'Sale' AS type,s.completed_at AS occurred_at
  FROM sales s JOIN customers c ON c.id=s.customer_id LEFT JOIN sale_payments p ON p.sale_id=s.id WHERE s.status!='voided'
  UNION ALL SELECT r.branch_id,date(r.occurred_at,'+5 hours'),r.return_number,c.name,r.refund_method,-r.total_paisa,-r.cost_paisa,'Return',r.occurred_at
  FROM sale_returns r JOIN sales s ON s.id=r.sale_id JOIN customers c ON c.id=s.customer_id)`
const sections = new Set<ReportSection>(['transfers','overview','sales','expenses','purchases','customers','suppliers','stock','shifts'])
const column = (key: string, label: string, kind?: ReportColumn['kind']): ReportColumn => ({ key, label, kind })
const money = (key: string, label: string) => column(key,label,'money')

export class ReportsRepository {
  constructor(private readonly db: DatabaseSync, private readonly businessId: string, private readonly now: () => Date) {}
  private scope(query: ReportQuery, branchIds: string[]) {
    if (!query || !sections.has(query.section)) throw new Error('Select a valid report.')
    requireBusinessDate(query.dateFrom); requireBusinessDate(query.dateTo)
    if (query.dateFrom > query.dateTo) throw new Error('Report start date must be on or before the end date.')
    if (typeof query.allBranches !== 'undefined' && typeof query.allBranches !== 'boolean') throw new Error('Invalid branch scope.')
    if (!Array.isArray(branchIds) || !branchIds.length || branchIds.length>100) throw new Error('Select a branch for this report.')
    const ids = [...new Set(branchIds)]
    for (const id of ids) if (!this.db.prepare('SELECT 1 FROM branches WHERE id=? AND business_id=? AND is_active=1').get(id,this.businessId)) throw new Error('Report branch is unavailable.')
    if (!ids.includes(query.branchId)) throw new Error('The selected branch is outside the report scope.')
    return { ids, inSql: '('+ids.map(()=>'?').join(',')+')', period: [...ids,query.dateFrom,query.dateTo] as SQLInputValue[] }
  }
  private number(sql: string, params: SQLInputValue[]) {
    const value = Number(this.db.prepare(sql).get(...params)?.value ?? 0)
    if (!Number.isSafeInteger(value)) throw new Error('Report amount exceeds the supported range.')
    return value
  }
  valuation(branchId: string): StockValuation {
    if (!this.db.prepare('SELECT 1 FROM branches WHERE id=? AND business_id=? AND is_active=1').get(branchId,this.businessId)) throw new Error('Branch is unavailable.')
    return this.stockSummary([branchId])
  }
  private stockSummary(ids: string[]): StockValuation {
    const marks=ids.map(()=>'?').join(',')
    const row = this.db.prepare(`SELECT COALESCE(SUM(total_cost_paisa),0) AS value,COALESCE(SUM(CASE WHEN estimated=1 THEN total_cost_paisa ELSE 0 END),0) AS estimated_value,
      COALESCE(SUM(estimated),0) AS estimated_products,COUNT(*) AS products FROM stock_values WHERE branch_id IN (${marks})`).get(...ids)!
    return { valuePaisa:requireSafeInteger(Number(row.value),'Stock value'),estimatedValuePaisa:requireSafeInteger(Number(row.estimated_value),'Estimated stock value'),estimatedProducts:Number(row.estimated_products),productCount:Number(row.products) }
  }
  private table(query: ReportQuery, ids: string[], exporting = false): ReportTable {
    const scope=this.scope(query,ids), filter=`f.branch_id IN ${scope.inSql} AND f.business_date BETWEEN ? AND ?`
    let sql='',params:SQLInputValue[]=scope.period,columns:ReportColumn[]=[],title=''
    const branch=column('branch','Branch')
    if (query.section==='overview'||query.section==='sales') {
      title='Sales and returns by posting date';sql=`SELECT f.business_date AS date,b.name AS branch,f.document,f.customer,f.type,COALESCE(f.method,'Unpaid') AS method,f.amount,f.cost,f.amount-f.cost AS profit FROM ${saleFacts} f JOIN branches b ON b.id=f.branch_id WHERE ${filter}`
      columns=[column('date','Date'),branch,column('document','Document'),column('customer','Customer'),column('type','Type'),column('method','Payment'),money('amount','Net sale / refund'),money('cost','Cost'),money('profit','Gross profit')]
    } else if(query.section==='expenses') {
      title='Paid expenses and reversals';sql=`SELECT f.business_date AS date,b.name AS branch,f.number AS document,f.description,f.category,f.method,f.amount_paisa AS amount,f.created_by AS actor FROM ${expenseFacts} f JOIN branches b ON b.id=f.branch_id WHERE ${filter}`
      columns=[column('date','Date'),branch,column('document','Document'),column('description','Description'),column('category','Category'),column('method','Method'),money('amount','Expense / reversal'),column('actor','Recorded by')]
    } else if(query.section==='purchases') {
      title='Purchases in period; payments allocated as of now';sql=`SELECT f.business_date AS date,b.name AS branch,f.purchase_number AS document,f.supplier_name_snapshot AS supplier,f.total_paisa AS amount,
        COALESCE((SELECT SUM(amount_paisa) FROM supplier_payment_allocations WHERE purchase_id=f.id),0) AS paid,
        f.total_paisa-COALESCE((SELECT SUM(amount_paisa) FROM supplier_payment_allocations WHERE purchase_id=f.id),0) AS due FROM purchases f JOIN branches b ON b.id=f.branch_id WHERE ${filter}`
      columns=[column('date','Date'),branch,column('document','Document'),column('supplier','Supplier'),money('amount','Purchase'),money('paid','Allocated payments now'),money('due','Due now')]
    } else if(query.section==='customers'||query.section==='suppliers') {
      const customer=query.section==='customers',ledger=customer?'customer_ledger':'supplier_ledger',entity=customer?'customers':'suppliers',id=customer?'customer_id':'supplier_id'
      title=customer?'Customer balances now':'Supplier balances now'
      sql=`SELECT b.name AS branch,e.name,e.phone,CASE WHEN e.is_active=1 THEN 'Active' ELSE 'Inactive' END AS status,SUM(f.debit_paisa-f.credit_paisa) AS balance FROM ${ledger} f JOIN ${entity} e ON e.id=f.${id} JOIN branches b ON b.id=f.branch_id WHERE f.branch_id IN ${scope.inSql} AND e.business_id=? GROUP BY f.branch_id,e.id HAVING balance!=0`
      params=[...ids,this.businessId];columns=[branch,column('name','Name'),column('phone','Phone'),column('status','Status'),money('balance','Due (+) / credit (-)')]
    } else if(query.section==='transfers') {
      title='Transfers dispatched in period; current status'
      sql=`SELECT f.business_date AS date,s.name AS branch,f.transfer_number AS document,s.name AS source,d.name AS destination,f.status,f.note,f.finished_at AS finished,
        (SELECT SUM(cost_paisa) FROM stock_transfer_items WHERE transfer_id=f.id) AS cost,
        CASE WHEN EXISTS(SELECT 1 FROM stock_transfer_items WHERE transfer_id=f.id AND estimated=1) THEN 'Estimated' ELSE 'Recorded cost' END AS basis
        FROM stock_transfers f JOIN branches s ON s.id=f.source_branch_id JOIN branches d ON d.id=f.destination_branch_id WHERE (f.source_branch_id IN ${scope.inSql} OR f.destination_branch_id IN ${scope.inSql}) AND f.business_date BETWEEN ? AND ?`
      params=[...ids,...ids,query.dateFrom,query.dateTo]
      columns=[column('date','Dispatched date'),column('document','Document'),column('source','Source'),column('destination','Destination'),column('status','Current status'),money('cost','Cost carried'),column('basis','Cost basis'),column('finished','Finished at'),column('note','Dispatch note')]
    } else if(query.section==='stock') {
      title='Stock valuation now (includes inactive products)';sql=`SELECT b.name AS branch,p.name,p.sku,p.unit,s.quantity_milli AS quantity,v.total_cost_paisa AS value,CASE WHEN v.estimated=1 THEN 'Estimated' ELSE 'Recorded cost' END AS basis FROM stock_values v JOIN stock_levels s USING(branch_id,product_id) JOIN products p ON p.id=v.product_id JOIN branches b ON b.id=v.branch_id WHERE v.branch_id IN ${scope.inSql}`
      params=ids;columns=[branch,column('name','Product'),column('sku','SKU'),column('unit','Unit'),column('quantity','Stock','quantity'),money('average','Average cost / unit'),money('value','Stock cost value'),column('basis','Cost basis')]
    } else {
      title='Cash shifts opened in period';sql=`SELECT date(f.opened_at,'+5 hours') AS date,b.name AS branch,u.name AS cashier,f.status,f.opening_cash_paisa AS opening,c.expected_cash_paisa AS expected,c.counted_cash_paisa AS counted,c.variance_paisa AS variance,COALESCE(c.note,'') AS note FROM cash_shifts f JOIN branches b ON b.id=f.branch_id JOIN users u ON u.id=f.cashier_id LEFT JOIN cash_shift_closings c ON c.shift_id=f.id WHERE f.branch_id IN ${scope.inSql} AND date(f.opened_at,'+5 hours') BETWEEN ? AND ?`
      columns=[column('date','Opened date'),branch,column('cashier','Cashier'),column('status','Status'),money('opening','Opening cash'),money('expected','Expected at closing'),money('counted','Counted at closing'),money('variance','Variance'),column('note','Closing note')]
    }
    const total=Number(this.db.prepare(`SELECT COUNT(*) AS value FROM (${sql})`).get(...params)!.value)
    const pageSize=requireSafeInteger(query.pageSize??25,'Page size',1)
    if(pageSize>100)throw new Error('Report page size cannot exceed 100.')
    const requestedPage=requireSafeInteger(query.page??1,'Page',1),pageCount=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(requestedPage,pageCount)
    if(exporting&&total>100_000)throw new Error('Export exceeds 100,000 rows. Narrow the report dates or branch scope.')
    const order=query.section==='stock'?'branch,name,sku':query.section==='customers'||query.section==='suppliers'?'branch,name':query.section==='shifts'?'date DESC,branch,cashier':'date DESC,branch,document'
    const rows=this.db.prepare(`SELECT * FROM (${sql}) ORDER BY ${order}${exporting?'':' LIMIT ? OFFSET ?'}`).all(...params,...(exporting?[]:[pageSize,(page-1)*pageSize])) as Row[]
    return {title,columns,total,page,pageCount,rows:rows.map(row=>{
      const result:Record<string,string|number>={}
      for(const [key,value] of Object.entries(row)) {if(typeof value==='number'&&!Number.isSafeInteger(value))throw new Error('Report number exceeds the supported range.');result[key]=value??'-'}
      if(query.section==='stock') result.average=Number(row.quantity)>0?proportionalCost(Number(row.value),1000,Number(row.quantity)):0
      return result
    })}
  }
  snapshot(query: ReportQuery, branchIds: string[] = [query.branchId]): ReportSnapshot {
    const {ids,inSql,period}=this.scope(query,branchIds)
    this.db.exec('BEGIN')
    try {
      const value=(sql:string,params:SQLInputValue[]=period)=>this.number(sql,params)
      const sum=(table:string,amount:string,date='business_date')=>value(`SELECT COALESCE(SUM(${amount}),0) AS value FROM ${table} WHERE branch_id IN ${inSql} AND ${date} BETWEEN ? AND ?`)
      const salesPaisa=value(`SELECT COALESCE(SUM(total_paisa),0) AS value FROM sales WHERE status!='voided' AND branch_id IN ${inSql} AND business_date BETWEEN ? AND ?`),returnsPaisa=sum('sale_returns','total_paisa',"date(occurred_at,'+5 hours')")
      const costPaisa=value(`SELECT COALESCE(SUM(cost),0) AS value FROM ${saleFacts} WHERE branch_id IN ${inSql} AND business_date BETWEEN ? AND ?`)
      const expensesPaisa=sum(expenseFacts,'amount_paisa'),netSalesPaisa=salesPaisa-returnsPaisa,grossProfitPaisa=netSalesPaisa-costPaisa
      const balance=(table:string,positive:boolean)=>value(`SELECT COALESCE(SUM(${positive?'MAX(balance,0)':'MAX(-balance,0)'}),0) AS value FROM (SELECT SUM(debit_paisa-credit_paisa) AS balance FROM ${table} WHERE branch_id IN ${inSql} GROUP BY branch_id,${table==='customer_ledger'?'customer_id':'supplier_id'})`,ids)
      const payments=(this.db.prepare(`SELECT COALESCE(method,'Unpaid') AS method,SUM(amount) AS amount FROM ${saleFacts} WHERE branch_id IN ${inSql} AND business_date BETWEEN ? AND ? GROUP BY method ORDER BY method`).all(...period) as Row[]).map(row=>({method:String(row.method),netSalesPaisa:Number(row.amount)}))
      const stockSummary=this.stockSummary(ids)
      const inTransitValuePaisa=value(`SELECT COALESCE(SUM(i.cost_paisa),0) AS value FROM stock_transfer_items i JOIN stock_transfers t ON t.id=i.transfer_id WHERE t.source_branch_id IN ${inSql} AND t.status='dispatched'`,ids)
      const summary={...stockSummary,inTransitValuePaisa,inventoryValuePaisa:stockSummary.valuePaisa+inTransitValuePaisa,salesPaisa,returnsPaisa,netSalesPaisa,costPaisa,grossProfitPaisa,expensesPaisa,operatingProfitPaisa:grossProfitPaisa-expensesPaisa,purchasesPaisa:sum('purchases','total_paisa'),collectionsPaisa:sum('customer_receipts','amount_paisa'),supplierPaymentsPaisa:sum('supplier_payments','amount_paisa'),customerDuePaisa:balance('customer_ledger',true),customerCreditPaisa:balance('customer_ledger',false),supplierDuePaisa:balance('supplier_ledger',true),supplierCreditPaisa:balance('supplier_ledger',false),
        estimatedCostLines:value(`SELECT COUNT(*) AS value FROM sale_items i JOIN sales s ON s.id=i.sale_id LEFT JOIN sale_item_costs c ON c.sale_item_id=i.id WHERE s.branch_id IN ${inSql} AND s.business_date BETWEEN ? AND ? AND COALESCE(c.estimated,1)=1`)+value(`SELECT COUNT(*) AS value FROM sale_return_items i JOIN sale_returns r ON r.id=i.return_id LEFT JOIN sale_item_costs c ON c.sale_item_id=i.sale_item_id WHERE r.branch_id IN ${inSql} AND date(r.occurred_at,'+5 hours') BETWEEN ? AND ? AND COALESCE(c.estimated,1)=1`),
        stockAdjustmentCostPaisa:value(`SELECT COALESCE(SUM(v.cost_delta_paisa),0) AS value FROM stock_value_movements v JOIN stock_movements m ON m.id=v.movement_id WHERE m.branch_id IN ${inSql} AND date(m.occurred_at,'+5 hours') BETWEEN ? AND ? AND m.reference_type='stock_adjustment'`)}
      for(const amount of Object.values(summary)) if(!Number.isSafeInteger(amount))throw new Error('Report total exceeds the supported range.')
      const result={businessName:String(this.db.prepare('SELECT name FROM businesses WHERE id=?').get(this.businessId)!.name),branchNames:(this.db.prepare(`SELECT name FROM branches WHERE id IN ${inSql} ORDER BY name`).all(...ids) as Row[]).map(row=>String(row.name)),dateFrom:query.dateFrom,dateTo:query.dateTo,generatedAt:this.now().toISOString(),summary,payments,table:this.table(query,ids)}
      this.db.exec('COMMIT');return result
    } catch(error){this.db.exec('ROLLBACK');throw error}
  }
  exportCsv(query:ReportQuery,branchIds:string[]=[query.branchId]) {
    const table=this.table(query,branchIds,true)
    const cell=(value:string|number)=>{const text=typeof value==='string'&&/^[\s]*[=+\-@]|^[\t\r\n]/.test(value)?"'"+value:String(value);return '"'+text.replaceAll('"','""')+'"'}
    return [['Business',String(this.db.prepare('SELECT name FROM businesses WHERE id=?').get(this.businessId)!.name)],['Report',table.title],['Branches',...branchIds.map(id=>String(this.db.prepare('SELECT name FROM branches WHERE id=?').get(id)!.name))],['Period',query.dateFrom,query.dateTo],['Generated',this.now().toISOString()],table.columns.map(c=>c.label),...table.rows.map(row=>table.columns.map(c=>typeof row[c.key]==='number'&&c.kind?Number(row[c.key])/(c.kind==='money'?100:1000):row[c.key]??''))].map(row=>row.map(cell).join(',')).join('\r\n')
  }
}
