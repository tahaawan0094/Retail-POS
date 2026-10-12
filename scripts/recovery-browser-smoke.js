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
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  }
  const submit = async name => { await new Promise(resolve => setTimeout(resolve, 100)); document.querySelector('[name="' + name + '"]').closest('form').requestSubmit() }
  const click = text => { const button = [...document.querySelectorAll('.recovery-content button')].find(element => element.textContent.trim() === text); assert(button && !button.disabled, 'Missing enabled action: ' + text); button.click() }
  const navigate = name => { const button = document.querySelector('[aria-label="Main navigation"] button[aria-label="' + name + '"]'); assert(button, 'Missing navigation item: ' + name); button.click() }
  const api = window.vertexia, branchId = 'branch-main'
  await wait(() => document.querySelector('[name="openingCash"]'), 'cash shift screen')
  for (const name of ['Customers', 'Expenses', 'Reports', 'Cash & Shifts', 'Settings']) assert(document.querySelector('[aria-label="Main navigation"] button[aria-label="' + name + '"]'), 'Owner menu missing: ' + name)
  navigate('Reports'); await wait(() => document.body.innerText.includes('Current balances and stock value'), 'live reports screen')
  navigate('Cash & Shifts'); await wait(() => document.querySelector('[name="openingCash"]'), 'cash screen again')
  const product = await api.products.save(branchId, { name: 'Recovery Smoke Rice', sku: 'REC-001', barcode: 'REC-001', category: 'General', subcategory: '', brand: '', unit: 'Kg', purchasePricePaisa: 10000, sellingPricePaisa: 15000, mrpPaisa: 0, minimumStockMilli: 0, openingStockMilli: 10000, status: 'active', imageDataUrl: null })
  input('openingCash', '1000'); await submit('openingCash')
  await wait(async () => (await api.cash.getSnapshot(branchId)).activeShift?.openingCashPaisa === 100000, 'opening cash persisted')
  await wait(() => document.querySelector('[name="moveAmount"]') && !document.querySelector('[name="moveAmount"]').disabled, 'cash movement form')
  input('moveAmount', '200'); input('moveReason', 'Bank deposit'); await submit('moveAmount')
  await wait(async () => (await api.cash.getSnapshot(branchId)).activeShift?.expectedCashPaisa === 80000, 'cash out persisted')
  await wait(() => document.querySelector('.recovery-notice')?.textContent.includes('Cash movement saved'), 'cash out form completion')
  const saleInput = { branchId, customerId: 'customer-walk-in', cashReceivedPaisa: 15000, lines: [{ productId: product.id, quantityMilli: 1000, discountBasisPoints: 0 }] }
  await api.pos.completeSale({ ...saleInput, operationId: crypto.randomUUID(), paymentMethod: 'Cash' })
  await api.pos.completeSale({ ...saleInput, operationId: crypto.randomUUID(), paymentMethod: 'Card', cashReceivedPaisa: 0 })
  window.dispatchEvent(new Event('vertexia:retail-data-changed'))
  await wait(() => document.querySelector('.recovery-stats').textContent.includes('950.00'), 'expected drawer displayed')
  input('countedCash', '930'); input('closingNote', 'Cash shortage twenty rupees'); await submit('countedCash')
  await wait(async () => !(await api.cash.getSnapshot(branchId)).activeShift, 'shift closed through UI')
  await wait(() => document.querySelector('[name="openingCash"]'), 'closing form completed')
  const closed = (await api.cash.getSnapshot(branchId)).shifts[0]
  assert(closed.variancePaisa === -2000 && closed.countedCashPaisa === 93000, 'Cash reconciliation wrong')
  navigate('Settings'); await wait(() => [...document.querySelectorAll('.recovery-content button')].some(button => button.textContent === 'Create backup'), 'backup screen')
  click('Create backup')
  await wait(() => document.querySelector('.recovery-table tbody tr'), 'backup listed')
  await wait(() => ![...document.querySelectorAll('.recovery-content button')].find(button => button.textContent === 'Save copy')?.disabled, 'backup finished')
  click('Save copy'); await wait(() => document.querySelector('.recovery-notice')?.textContent.includes('Backup copy saved'), 'native export round trip')
  await api.retail.adjustStock({ branchId, operationId: crypto.randomUUID(), productId: product.id, quantityDeltaMilli: 1000, reason: 'After backup change' })
  const laterShift = await api.pos.openShift(branchId, 10000, crypto.randomUUID())
  await api.cash.closeShift({ branchId, operationId: crypto.randomUUID(), shiftId: laterShift, countedCashPaisa: 10000, note: '' })
  assert((await api.cash.getSnapshot(branchId)).shifts.length === 2, 'Later shift not recorded')
  click('Select backup to restore')
  await wait(() => document.querySelector('.restore-review'), 'validated restore summary')
  assert(document.querySelector('.restore-review').textContent.includes('2 sales'), 'Restore summary counts wrong')
  input('currentOwnerPassword', 'wrong password'); input('backupOwnerUsername', 'smoke.owner'); input('backupOwnerPassword', 'Smoke owner passphrase 2026'); input('restoreConfirmation', 'RESTORE')
  await submit('restoreConfirmation')
  await wait(() => document.querySelector('.recovery-error')?.textContent.includes('incorrect'), 'current owner password required')
  assert((await api.cash.getSnapshot(branchId)).shifts.length === 2, 'Failed authentication changed data')
  input('currentOwnerPassword', 'Smoke owner passphrase 2026'); await submit('restoreConfirmation')
  await wait(() => document.querySelector('.auth-card input[name="username"]'), 'restore signs out current session')
  await wait(() => document.querySelector('.auth-card [role="status"]')?.textContent.includes('Safety copy:'), 'restore recovery notice')
  input('username', 'smoke.owner'); input('password', 'Smoke owner passphrase 2026'); await submit('username')
  await wait(() => document.querySelector('.session-bar'), 'owner login after restore')
  assert((await api.retail.getSnapshot(branchId)).products.find(row => row.id === product.id).stockMilli === 8000, 'Restored stock differs from backup')
  assert((await api.cash.getSnapshot(branchId)).shifts.length === 1, 'Restore did not remove later shift')
  assert((await api.cash.getSnapshot(branchId)).shifts[0].variancePaisa === -2000, 'Restored closing lost variance')
  const backups = await api.backup.getStatus()
  assert(backups.records.some(record => record.kind === 'before_restore'), 'Safety copy was not retained')
  await wait(() => document.querySelector('.settings-page .recovery-table tbody tr'), 'restored backup screen')
  return { offline: true, cashClosing: true, variancePaisa: -2000, manualBackup: true, export: true, restore: true, safetyBackup: true, ownerMenus: true, restoredStockMilli: 8000 }
})()
