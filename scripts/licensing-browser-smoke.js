// This function expression is evaluated and called by the isolated Electron smoke runner.
// eslint-disable-next-line no-unused-expressions
async (phase, activationKey) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const wait = async (predicate, label) => {
    const until = Date.now() + 15000
    while (Date.now() < until) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 80)) }
    throw new Error('Timed out: ' + label + '\n' + document.body.innerText.slice(-1200))
  }
  const api = window.vertexia
  const locked = async work => { try { await work() } catch (error) { assert(error.message.includes('POS license locked'), 'Unexpected lock error: ' + error.message); return } throw new Error('Locked license allowed mutation') }
  const click = text => { const button = [...document.querySelectorAll('.license-page button')].find(el => el.textContent.trim() === text); assert(button && !button.disabled, 'Missing enabled button: ' + text); button.click() }
  const refresh = async state => {
    click('Check license online')
    await wait(() => document.querySelector('[data-license-state="' + state + '"]') && !document.querySelector('.license-page fieldset')?.disabled, state + ' displayed')
  }
  const product = { name: 'Licensed Rice', sku: 'LIC-001', barcode: 'LIC-001', category: 'General', subcategory: '', brand: '', unit: 'Kg', purchasePricePaisa: 10000, sellingPricePaisa: 15000, mrpPaisa: 0, minimumStockMilli: 0, openingStockMilli: 10000, status: 'active', imageDataUrl: null }
  if (phase === 'activate') {
    await wait(() => document.querySelector('[data-license-state="unactivated"]'), 'unactivated license page')
    await locked(() => api.products.save('branch-main', product))
    const input = document.querySelector('input[name="activationKey"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, activationKey)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 80))
    input.closest('form').requestSubmit()
    await wait(() => document.querySelector('[data-license-state="active"]'), 'activation by actual form')
    const state = await api.licensing.status()
    assert(state.tenantId && state.deviceId && state.licenseId, 'Cloud identity missing')
    window.__licensedProductId = (await api.products.save('branch-main', product)).id
    await api.pos.openShift('branch-main', 100000, 'license-smoke-shift')
    await api.pos.completeSale({ branchId: 'branch-main', operationId: 'license-smoke-sale', customerId: 'customer-walk-in', lines: [{ productId: window.__licensedProductId, quantityMilli: 1000, discountBasisPoints: 0 }], paymentMethod: 'Cash', cashReceivedPaisa: 15000 })
    return { activationForm: true, signedRegistration: true, saleAllowed: true }
  }
  if (phase === 'branch-create') {
    const result = await api.branches.create({ branchId: 'branch-main', operationId: 'license-branch-create', name: 'License Lahore Branch', code: 'LICLHR', city: 'Lahore' })
    return result.branchId
  }
  if (phase === 'branch-lock') {
    const target = activationKey
    await api.licensing.refresh()
    assert((await api.licensing.status()).canTransact, 'Unlocked main branch stopped working')
    await locked(() => api.products.save(target, { ...product, sku: 'LIC-BRANCH-002', barcode: 'LIC-BRANCH-002', openingStockMilli: 0 }))
    await locked(() => api.transfers.dispatch({ branchId: 'branch-main', destinationBranchId: target, operationId: 'locked-target-transfer', lines: [] }))
    await locked(() => api.branches.update({ branchId: 'branch-main', targetBranchId: target, operationId: 'locked-target-edit', name: 'Renamed Locked Branch', city: 'Lahore' }))
    await api.auth.selectBranch(target)
    assert(!(await api.licensing.status()).canTransact, 'Selected locked branch showed enabled status')
    await locked(() => api.products.save('branch-main', product))
    await api.auth.selectBranch('branch-main')
    return { targetProductPostingBlocked: true, lockedTransferDestinationBlocked: true, lockedBranchRenameBlocked: true, selectedBranchStatusLocked: true, otherBranchAvailable: true }
  }
  if (phase === 'branch-unlock') {
    await api.licensing.refresh()
    await api.auth.selectBranch(activationKey)
    assert((await api.licensing.status()).canTransact, 'Company branch unlock was not applied')
    const saved = await api.products.save(activationKey, { ...product, sku: 'LIC-BRANCH-002', barcode: 'LIC-BRANCH-002', openingStockMilli: 0 })
    assert(saved.id, 'Unlocked branch could not create a product')
    await api.auth.selectBranch('branch-main')
    return { signedBranchUnlock: true, branchPostingResumed: true }
  }
  if (phase === 'suspend') {
    await refresh('suspended')
    await locked(() => api.products.save('branch-main', product))
    await locked(() => api.pos.openShift('branch-main', 0))
    await locked(() => api.pos.completeSale({ branchId: 'branch-main', lines: [] }))
    await locked(() => api.branches.create({ branchId: 'branch-main' }))
    const sales = await api.sales.getSnapshot({ branchId: 'branch-main', period: 'today', search: '', paymentMethod: 'all', status: 'all', page: 1, pageSize: 25 })
    assert(sales.transactionCount === 1, 'Existing records unavailable or changed')
    const backup = await api.backup.create()
    assert(backup.id, 'Suspended license blocked backup')
    const shift = (await api.cash.getSnapshot('branch-main')).activeShift
    const closing = await api.cash.closeShift({ branchId: 'branch-main', operationId: 'licensed-reconciliation', shiftId: shift.id, countedCashPaisa: shift.expectedCashPaisa, note: 'Reconciliation while suspended' })
    assert(closing.status === 'closed', 'Suspended license blocked drawer reconciliation')
    return { directIpcLocked: true, historyReadable: true, backupAllowed: true, cashReconciliationAllowed: true }
  }
  if (phase === 'renew') {
    await refresh('active')
    assert((await api.licensing.status()).canTransact, 'Renewal did not unlock transactions')
    await api.pos.openShift('branch-main', 100000, 'license-renewed-shift')
    await api.retail.adjustStock({ branchId: 'branch-main', operationId: 'license-after-renew', productId: window.__licensedProductId, quantityDeltaMilli: 1000, reason: 'Renewal smoke verification' })
    return { renewalCheck: true, transactionsResumed: true }
  }
  if (phase === 'offline') {
    let failed = false
    try { await api.licensing.refresh() } catch { failed = true }
    assert(failed && (await api.licensing.status()).canTransact, 'Offline check discarded valid signed lease')
    await api.pos.completeSale({ branchId: 'branch-main', operationId: 'license-offline-sale', customerId: 'customer-walk-in', lines: [{ productId: window.__licensedProductId, quantityMilli: 1000, discountBasisPoints: 0 }], paymentMethod: 'Cash', cashReceivedPaisa: 15000 })
    return { signedOfflineSale: true }
  }
  throw new Error('Unknown test phase')
}
