(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const wait = async (predicate, label) => {
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 80)) }
    throw new Error('Timed out: ' + label + '\n' + document.body.innerText.slice(-2500))
  }
  const input = (name, value) => {
    const element = document.querySelector('[name="' + name + '"]')
    assert(element, 'Missing input: ' + name)
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  }
  const submit = async name => { await new Promise(resolve => setTimeout(resolve, 100)); document.querySelector('[name="' + name + '"]').closest('form').requestSubmit() }
  const click = text => { const button = [...document.querySelectorAll('.recovery-content button')].find(element => element.textContent.trim() === text); assert(button && !button.disabled, 'Missing enabled action: ' + text); button.click() }
  const navigate = name => { const button = document.querySelector('[aria-label="Main navigation"] button[aria-label="' + name + '"]'); assert(button, 'Missing navigation item: ' + name); button.click() }
  const api = window.vertexia, branchId = 'branch-main'
  await wait(() => document.querySelector('[name="customerName"]'), 'real customers page')
  assert(!document.querySelector('[aria-label="Main navigation"] button[aria-label="Customers"]').textContent.includes('Planned'), 'Customers still marked planned')
  input('customerName', 'Smoke Account Customer'); input('customerPhone', '03001234567'); input('customerOpeningDebt', '100'); await submit('customerName')
  await wait(() => document.querySelector('.customer-account h2')?.textContent === 'Smoke Account Customer', 'customer created with selected account')
  const query = { branchId, search: 'Smoke Account Customer', filter: 'all', page: 1, pageSize: 25 }
  const customer = (await api.customers.list(query)).customers[0]
  assert(customer.balancePaisa === 10000, 'Opening debt not recorded')
  const shiftId = await api.pos.openShift(branchId, 100000, crypto.randomUUID())
  const product = await api.products.save(branchId, { name: 'Accounts Smoke Rice', sku: 'ACCOUNT-001', barcode: 'ACCOUNT-001', category: 'General', subcategory: '', brand: '', unit: 'Kg', purchasePricePaisa: 10000, sellingPricePaisa: 15000, mrpPaisa: 0, minimumStockMilli: 0, openingStockMilli: 5000, status: 'active', imageDataUrl: null })
  await api.pos.completeSale({ branchId, operationId: crypto.randomUUID(), customerId: customer.id, paymentMethod: 'Udhaar', cashReceivedPaisa: 0, lines: [{ productId: product.id, quantityMilli: 1000, discountBasisPoints: 0 }] })
  window.dispatchEvent(new Event('vertexia:retail-data-changed'))
  await wait(() => document.querySelector('.customer-account')?.textContent.includes('250.00'), 'udhaar sale added to account')
  input('customerPaymentAmount', '50'); await submit('customerPaymentAmount')
  await wait(() => document.querySelector('.account-receipt'), 'cash collection receipt')
  assert(document.querySelector('.account-receipt').textContent.includes('200.00'), 'Receipt balance wrong')
  assert([...document.querySelectorAll('.account-receipt button')].some(button => button.textContent === 'Print receipt'), 'Receipt print action missing')
  click('Close receipt')
  await wait(() => document.querySelector('[name="customerPaymentAmount"]') && !document.querySelector('[name="customerPaymentAmount"]').disabled, 'account refreshed after payment')
  input('customerPaymentAmount', '50'); input('customerPaymentMethod', 'Bank Transfer'); input('customerPaymentReference', 'BANK-SMOKE-001'); await submit('customerPaymentAmount')
  await wait(() => document.querySelector('.account-receipt'), 'bank collection receipt'); click('Close receipt')
  assert((await api.cash.getSnapshot(branchId)).activeShift.expectedCashPaisa === 105000, 'Noncash collection affected drawer')
  const account = await api.customers.detail(branchId, customer.id)
  assert(account.customer.balancePaisa === 15000 && account.receipts.length === 2, 'Customer balance or receipts wrong')
  await wait(() => document.querySelector('.customer-account h2'), 'account ready for editing')
  click('Edit customer'); await wait(() => document.querySelector('[name="editCustomerName"]'), 'edit form')
  input('editCustomerName', 'Updated Smoke Customer'); await submit('editCustomerName')
  await wait(() => document.querySelector('.customer-account h2')?.textContent === 'Updated Smoke Customer', 'customer edited')
  assert((await api.customers.detail(branchId, customer.id)).receipts[0].customerName === 'Smoke Account Customer', 'Receipt name changed with profile')
  const zero = await api.customers.create({ branchId, operationId: crypto.randomUUID(), name: 'Zero Balance Customer', phone: '', openingBalancePaisa: 0 })
  window.dispatchEvent(new Event('vertexia:retail-data-changed'))
  await wait(() => document.querySelector('[aria-label="View account for Zero Balance Customer"]'), 'second account in list')
  document.querySelector('[aria-label="View account for Zero Balance Customer"]').click()
  await wait(() => document.querySelector('.customer-account h2')?.textContent === 'Zero Balance Customer', 'switch customer without stale account data')
  assert(document.querySelector('[name="customerPaymentAmount"]').closest('fieldset').disabled, 'Settled account displayed another customer payment form')
  assert((await api.customers.detail(branchId, zero.customerId)).customer.balancePaisa === 0, 'Zero account balance changed')
  navigate('Expenses'); await wait(() => document.querySelector('[name="expenseDescription"]'), 'real expenses page')
  input('expenseDescription', 'Smoke shop electricity'); input('expenseAmount', '200'); await submit('expenseDescription')
  await wait(async () => (await api.cash.getSnapshot(branchId)).activeShift.expectedCashPaisa === 85000, 'cash expense posted')
  await wait(() => document.querySelector('.recovery-notice')?.textContent.includes('expense recorded'), 'expense form completed')
  input('expenseDescription', 'Smoke internet bill'); input('expenseAmount', '100'); input('expenseMethod', 'Bank Transfer'); input('expenseReference', 'BANK-EXPENSE-SMOKE'); await submit('expenseDescription')
  await wait(() => document.querySelector('.recovery-table')?.textContent.includes('Smoke internet bill'), 'bank expense listed')
  assert((await api.cash.getSnapshot(branchId)).activeShift.expectedCashPaisa === 85000, 'Bank expense affected drawer')
  const today = (await api.customers.list(query)).businessDate
  const expenseQuery = { branchId, dateFrom: today.slice(0, 7) + '-01', dateTo: today, search: '', category: '', method: '', page: 1, pageSize: 25 }
  const expense = (await api.expenses.list(expenseQuery)).records.find(row => row.description === 'Smoke shop electricity')
  document.querySelector('[aria-label="Reverse ' + expense.number + '"]').click()
  await wait(() => document.querySelector('[name="expenseReversalReason"]'), 'reversal review')
  input('expenseReversalReason', 'Vendor refunded this payment'); document.querySelector('[name="expenseCashReturned"]').click(); await submit('expenseReversalReason')
  await wait(async () => (await api.expenses.list(expenseQuery)).reversedPaisa === 20000, 'expense reversal saved')
  await wait(() => !document.querySelector('[name="expenseReversalReason"]'), 'reversal form completed')
  assert((await api.cash.getSnapshot(branchId)).activeShift.expectedCashPaisa === 105000, 'Reversal cash not returned to drawer')
  const dashboard = await api.dashboard.getSnapshot({ branchId, dateRange: 'today', chartPeriod: 'today' })
  assert(dashboard.expensesPaisa === 10000 && dashboard.customerDuePaisa === 15000 && dashboard.salesPaisa === 15000, 'Dashboard counted payments or expense totals incorrectly')
  input('expenseSearch', 'internet'); await wait(() => document.querySelector('.recovery-table tbody')?.textContent.includes('Smoke internet bill') && !document.querySelector('.recovery-table tbody')?.textContent.includes('Smoke shop electricity'), 'expense search')
  input('expenseSearch', ''); await wait(() => document.querySelector('.recovery-table tbody')?.textContent.includes('Reversal'), 'expense filter cleared')
  await api.cash.closeShift({ branchId, operationId: crypto.randomUUID(), shiftId, countedCashPaisa: 105000, note: '' })
  await api.backup.create()
  return { offline: true, customerCreateForm: true, openingDebtPaisa: 10000, udhaarSale: true, cashCollectionForm: true, bankCollectionForm: true, receipts: 2, customerEditForm: true, cashExpenseForm: true, bankExpenseForm: true, expenseReversalForm: true, netExpensesPaisa: 10000, customerDuePaisa: 15000, closingCashPaisa: 105000, backup: true }
})()
