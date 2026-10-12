(async()=>{
  const assert=(value,message)=>{if(!value)throw new Error(message)}
  const wait=async(predicate,label)=>{const deadline=Date.now()+20000;while(Date.now()<deadline){if(await predicate())return;await new Promise(r=>setTimeout(r,80))}throw new Error('Timed out: '+label+' '+document.body.innerText.slice(-1800))}
  const input=(selector,value)=>{const element=document.querySelector(selector);assert(element,'Missing '+selector);Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}))}
  const set=(name,value)=>input('[name="'+name+'"]',value)
  const click=text=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert(button&&!button.disabled,'Missing action '+text);button.click()}
  const submit=async name=>{await new Promise(r=>setTimeout(r,100));document.querySelector('[name="'+name+'"]').closest('form').requestSubmit()}
  const navigate=name=>{const b=document.querySelector('[aria-label="Main navigation"] [aria-label="'+name+'"]');assert(b,'Missing nav '+name);b.click()}
  const api=window.vertexia,branchId='branch-main'
  const approve=async()=>{window.__vertexiaSmokeBranchApproval='requested';await wait(()=>window.__vertexiaSmokeBranchApproval==='approved','company branch approval')}
  await wait(()=>document.querySelector('[name="branchName"]'),'branch form')
  const product=await api.products.save(branchId,{name:'Branch Smoke Rice',sku:'BRN-001',barcode:'BRN-001',category:'Grocery',subcategory:'',brand:'',unit:'Kg',purchasePricePaisa:10000,sellingPricePaisa:30000,mrpPaisa:0,minimumStockMilli:0,openingStockMilli:10000,status:'active',imageDataUrl:null})
  set('branchName','Lahore Smoke');set('branchCode','LHR01');set('branchCity','Lahore');await submit('branchName')
  await wait(async()=>(await api.branches.list()).length===2,'branch created by form')
  const destination=(await api.branches.list()).find(b=>b.code==='LHR01').id
  await approve()
  await wait(()=>document.querySelector('.session-bar [aria-label="Working branch"] option[value="'+destination+'"]'),'owner branch selector refreshed')
  assert((await api.pos.getBootstrap(destination)).products.find(p=>p.id===product.id).quantityMilli===0,'New branch got invented stock')
  document.querySelector('[aria-label="Edit branch LHR01"]').click();await wait(()=>document.querySelector('[name="branchEditName"]'),'edit branch form')
  set('branchEditName','Lahore Central Smoke');await submit('branchEditName')
  await wait(()=>document.querySelector('.recovery-notice')?.textContent.includes('details updated'),'branch details saved')
  navigate('Staff');await wait(()=>document.querySelector('[name="staffName"]'),'staff screen')
  await wait(()=>[...document.querySelectorAll('fieldset label')].some(l=>l.textContent.includes('Lahore Central Smoke')),'new branch appears for staff assignment')
  set('staffName','Smoke Branch Inventory');set('staffUsername','branch.inventory');set('staffPassword','Branch smoke passphrase 2026');set('staffRole','Inventory')
  const access=[...document.querySelectorAll('.identity-form fieldset label')].find(l=>l.textContent.includes('Lahore Central Smoke'));access.querySelector('input').click()
  await submit('staffName');await wait(async()=>(await api.auth.listUsers()).some(u=>u.username==='branch.inventory'),'assigned inventory staff')
  const user=(await api.auth.listUsers()).find(u=>u.username==='branch.inventory');assert(user.branchIds.includes(destination)&&user.branchIds.includes(branchId),'Staff assignment missing a branch')
  navigate('Stock Transfers');await wait(()=>document.querySelector('[name="transferQuantity"]'),'transfer form')
  await wait(()=>document.querySelector('[name="transferProduct"] option[value="'+product.id+'"]'),'source catalog ready')
  set('transferDestination',destination);set('transferProduct',product.id);set('transferQuantity','2');await new Promise(r=>setTimeout(r,100));click('Add transfer item')
  await wait(()=>document.querySelector('button[aria-label="Remove transfer item '+product.id+'"]'),'item in dispatch cart')
  set('transferNote','Smoke consignment');await submit('transferNote')
  await wait(async()=>(await api.transfers.list({branchId,status:'all',page:1,pageSize:25})).total===1,'dispatch posted')
  const transfer=(await api.transfers.list({branchId,status:'all',page:1,pageSize:25})).records[0]
  assert(transfer.totalCostPaisa===20000,'Transfer cost differs from source cost')
  assert((await api.pos.getBootstrap(branchId)).products.find(p=>p.id===product.id).quantityMilli===8000,'Source stock not deducted')
  assert((await api.pos.getBootstrap(destination)).products.find(p=>p.id===product.id).quantityMilli===0,'Destination received before confirmation')
  input('.session-bar [aria-label="Working branch"]',destination)
  await wait(()=>document.querySelector('.session-bar select').value===destination&&document.querySelector('[aria-label="View transfer '+transfer.number+'"]'),'switch to destination')
  document.querySelector('[aria-label="View transfer '+transfer.number+'"]').click();await wait(()=>document.querySelector('[aria-label="Transfer details"]')?.textContent.includes(transfer.number),'destination details')
  click('Receive transfer');await wait(()=>document.querySelector('[name="transferPhysicalConfirmation"]'),'physical receipt confirmation')
  document.querySelector('[name="transferPhysicalConfirmation"]').click();set('transferFinishNote','Every item counted');await submit('transferFinishNote')
  await wait(async()=>(await api.transfers.detail(destination,transfer.id)).status==='received','receipt posted')
  assert((await api.pos.getBootstrap(destination)).products.find(p=>p.id===product.id).quantityMilli===2000,'Destination receipt stock wrong')
  navigate('Reports');await wait(()=>document.body.innerText.includes('Current balances and stock value'),'branch reports')
  set('reportScope','all');set('reportSection','transfers');await wait(()=>document.body.innerText.includes('Transfers dispatched in period; current status')&&!document.body.innerText.includes('Loading reports...'),'consolidated transfer report')
  assert(document.body.innerText.includes('received')&&document.body.innerText.includes(transfer.number),'Report omitted received transfer')
  const date=(await api.customers.list({branchId,search:'',filter:'all',page:1,pageSize:25})).businessDate
  const report=await api.reports.snapshot({branchId:destination,dateFrom:date,dateTo:date,section:'transfers',allBranches:true})
  assert(report.summary.inventoryValuePaisa===100000&&report.summary.inTransitValuePaisa===0&&report.summary.grossProfitPaisa===0,'Consolidated inventory or profit changed on transfer')
  input('.session-bar [aria-label="Working branch"]',branchId)
  await wait(()=>document.querySelector('.session-bar select').value===branchId,'back to source')
  navigate('Stock Transfers');await wait(()=>document.querySelector('[name="transferQuantity"]'),'second dispatch form')
  set('transferProduct',product.id);set('transferQuantity','1');await new Promise(r=>setTimeout(r,100));click('Add transfer item');await wait(()=>document.querySelector('button[aria-label="Remove transfer item '+product.id+'"]'),'second transfer item')
  set('transferNote','Smoke cancellation');await submit('transferNote')
  await wait(async()=>(await api.transfers.list({branchId,status:'dispatched',page:1,pageSize:25})).total===1,'second transfer dispatched')
  const pending=(await api.transfers.list({branchId,status:'dispatched',page:1,pageSize:25})).records[0]
  await wait(()=>document.querySelector('[aria-label="Transfer details"]')?.textContent.includes(pending.number),'cancel transfer details')
  click('Cancel and return stock');await wait(()=>document.querySelector('[name="transferFinishNote"]'),'cancellation form');set('transferFinishNote','Goods returned to source');document.querySelector('[name="transferPhysicalConfirmation"]').click();await submit('transferFinishNote')
  await wait(async()=>(await api.transfers.detail(branchId,pending.id)).status==='cancelled','physical cancellation')
  assert((await api.pos.getBootstrap(branchId)).products.find(p=>p.id===product.id).quantityMilli===8000,'Cancellation lost original source stock')
  const empty=await api.branches.create({branchId,operationId:crypto.randomUUID(),name:'Empty Smoke',code:'EMPTY',city:'Karachi'});window.dispatchEvent(new Event('vertexia:auth-refresh'))
  await approve()
  navigate('Branches');await wait(()=>document.querySelector('[aria-label="Archive branch EMPTY"]'),'empty branch in list')
  document.querySelector('[aria-label="Archive branch EMPTY"]').click();await wait(()=>document.querySelector('[name="branchStatusReason"]'),'archive confirmation form');set('branchStatusReason','Unused branch closed');await submit('branchStatusReason')
  await wait(async()=>(await api.branches.list()).find(b=>b.id===empty.branchId).isActive===false,'archive form')
  await wait(()=>document.querySelector('[aria-label="Reactivate branch EMPTY"]'),'archive row updated')
  document.querySelector('[aria-label="Reactivate branch EMPTY"]').click();await wait(()=>document.querySelector('[name="branchStatusReason"]'),'reactivation confirmation form');set('branchStatusReason','Branch reopened');await submit('branchStatusReason')
  await wait(async()=>(await api.branches.list()).find(b=>b.id===empty.branchId).isActive,'reactivation form')
  await wait(()=>document.body.innerText.includes('Branch reactivated.'),'final branch screen')
  return {offline:true,branchCreateForm:true,branchEditForm:true,staffAssignment:true,branchSwitch:true,dispatchForm:true,receiveForm:true,cancellationForm:true,archiveForm:true,reactivationForm:true,consolidatedInventoryPaisa:100000,sourceStockMilli:8000,destinationStockMilli:2000}
})()
