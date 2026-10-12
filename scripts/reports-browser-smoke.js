(async () => {
  const assert=(value,message)=>{if(!value)throw new Error(message)}
  const wait=async(predicate,label)=>{const deadline=Date.now()+15000;while(Date.now()<deadline){if(await predicate())return;await new Promise(r=>setTimeout(r,80))}throw new Error('Timed out: '+label+' '+document.body.innerText.slice(-1500))}
  const input=(name,value)=>{const e=document.querySelector('[name="'+name+'"]');assert(e,'Missing '+name);Object.getOwnPropertyDescriptor(e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}))}
  const click=(text)=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert(e&&!e.disabled,'Missing action '+text);e.click()}
  const api=window.vertexia,branchId='branch-main'
  await wait(()=>document.body.innerText.includes('Current balances and stock value'),'reports screen')
  assert(!document.body.innerText.includes('Planned'),'Reports still marked planned')
  const today=(await api.customers.list({branchId,search:'',filter:'all',page:1,pageSize:25})).businessDate
  const product=await api.products.save(branchId,{name:'Report Smoke Rice',sku:'REP-001',barcode:'REP-001',category:'Grocery',subcategory:'',brand:'',unit:'Kg',purchasePricePaisa:10000,sellingPricePaisa:30000,mrpPaisa:0,minimumStockMilli:0,openingStockMilli:10000,status:'active',imageDataUrl:null})
  await api.pos.openShift(branchId,1000000,crypto.randomUUID())
  await api.retail.receivePurchase({branchId,operationId:crypto.randomUUID(),supplierName:'Report Smoke Supplier',supplierInvoiceNumber:'',businessDate:today,paidAmountPaisa:0,paymentMethod:'Cash',lines:[{productId:product.id,quantityMilli:10000,unitCostPaisa:20000}]})
  const sale=await api.pos.completeSale({branchId,operationId:crypto.randomUUID(),customerId:'customer-walk-in',paymentMethod:'Cash',cashReceivedPaisa:60000,lines:[{productId:product.id,quantityMilli:2000,discountBasisPoints:0}]})
  assert((await api.sales.getDetail(branchId,sale.saleId)).costPaisa===30000,'Sale cost is not weighted average')
  await api.expenses.post({branchId,operationId:crypto.randomUUID(),businessDate:today,description:'Report Smoke Bill',category:'Utilities',amountPaisa:5000,method:'Cash',reference:''})
  input('reportFrom',today);input('reportTo',today);window.dispatchEvent(new Event('vertexia:retail-data-changed'))
  await wait(()=>document.querySelector('.report-stats')?.textContent.includes('600')&&!document.body.innerText.includes('Loading reports...'),'real report totals')
  const reportQuery={branchId,dateFrom:today,dateTo:today,section:'overview',page:1,pageSize:25}
  const report=await api.reports.snapshot(reportQuery)
  assert(report.summary.grossProfitPaisa===30000&&report.summary.operatingProfitPaisa===25000,'Profit report totals wrong')
  assert(report.summary.valuePaisa===270000,'Stock value wrong')
  for(const [section,title] of [['transfers','Transfers dispatched in period'],['sales','Sales and returns by posting date'],['expenses','Paid expenses and reversals'],['purchases','Purchases in period'],['customers','Customer balances now'],['suppliers','Supplier balances now'],['shifts','Cash shifts opened in period'],['stock','Stock valuation now']]) {
    input('reportSection',section);await wait(()=>[...document.querySelectorAll('.recovery-card h2')].some(h=>h.textContent.includes(title))&&!document.body.innerText.includes('Loading reports...'),section+' table')
  }
  assert(document.body.innerText.includes('Report Smoke Rice'),'Stock rows missing')
  click('Export full report CSV');await wait(()=>document.querySelector('[role="status"]')?.textContent.includes('Full report saved'),'native CSV round trip')
  assert(document.body.innerText.includes('reports.csv'),'Export path not reported')
  const nav=document.querySelector('[aria-label="Main navigation"] [aria-label="Inventory"]');nav.click()
  await wait(()=>document.querySelector('.inventory-stat-grid')?.textContent.includes('2,700')||document.querySelector('.inventory-stats')?.textContent.includes('2,700')||document.body.innerText.includes('Stock Cost Value')&&document.body.innerText.includes('2,700'),'inventory uses branch valuation')
  document.querySelector('[aria-label="Main navigation"] [aria-label="Reports"]').click()
  await wait(()=>document.body.innerText.includes('Current balances and stock value'),'return to reports')
  input('reportSection','stock');await wait(()=>document.body.innerText.includes('Stock valuation now'),'stock report for capture')
  return {offline:true,weightedCostPaisa:30000,grossProfitPaisa:30000,operatingProfitPaisa:25000,stockValuePaisa:270000,reportSections:9,csvExport:true,inventoryValuation:true}
})()
