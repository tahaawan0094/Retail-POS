(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const wait = async (predicate, label) => {
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 80)) }
    throw new Error('Timed out: ' + label + '\n' + document.body.innerText.slice(-1600))
  }
  const input = (selector, value) => {
    const element = document.querySelector(selector)
    assert(element, 'Missing input: ' + selector)
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  }
  const navigate = name => { const button = document.querySelector('[aria-label="Main navigation"] button[aria-label="' + name + '"]'); assert(button, 'Navigation missing: ' + name); button.click() }
  const clickText = (selector, text) => { const button = [...document.querySelectorAll(selector)].find(element => element.textContent.trim() === text); assert(button && !button.disabled, 'Missing action: ' + text); button.click() }
  const denied = async (work, label) => { try { await work() } catch (error) { assert(/permission|Session expired|branch|temporary password/.test(error.message), label + ' failed for the wrong reason: ' + error.message); return } throw new Error(label + ' was permitted') }
  const api = window.vertexia
  const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? ''
  assert(csp.includes("script-src 'self';") && csp.includes("frame-src 'none'"), 'Production CSP is missing')
  const injectedScript = document.createElement('script')
  injectedScript.textContent = 'window.__vertexiaUnsafeInlineExecuted = true'
  document.head.append(injectedScript)
  await new Promise(resolve => setTimeout(resolve, 80))
  assert(!window.__vertexiaUnsafeInlineExecuted, 'Production CSP allowed an inline script')
  injectedScript.remove()
  const branchId = 'branch-main'
  const product = await api.products.save(branchId, { name: 'Auth Smoke Product', sku: 'AUTH-001', barcode: 'AUTH-001', category: 'General', subcategory: '', brand: '', unit: 'Piece', purchasePricePaisa: 10000, sellingPricePaisa: 15000, mrpPaisa: 0, minimumStockMilli: 0, openingStockMilli: 10000, status: 'active', imageDataUrl: null })
  assert(document.querySelector('.session-bar').textContent.includes('Smoke Owner'), 'Owner identity is not visible')
  navigate('Staff')
  await wait(() => document.querySelector('input[name="staffName"]'), 'staff screen')
  input('input[name="staffName"]', 'Smoke Cashier'); input('input[name="staffUsername"]', 'smoke.cashier'); input('input[name="staffPassword"]', 'Smoke temporary passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 100))
  document.querySelector('.identity-form').requestSubmit()
  await wait(() => [...document.querySelectorAll('.identity-table tbody tr')].some(row => row.textContent.includes('smoke.cashier')), 'staff account created by actual form')
  const cashier = (await api.auth.listUsers()).find(user => user.username === 'smoke.cashier')
  assert(cashier.mustChangePassword, 'New cashier did not require a password change')
  clickText('.session-bar button', 'Sign out')
  await wait(() => document.querySelector('.auth-card input[name="username"]'), 'owner signed out')
  // Every protected desktop endpoint must deny a signed-out caller before opening dialogs or changing data.
  const query = { branchId, period: 'today', search: '', paymentMethod: 'all', status: 'all', page: 1, pageSize: 10 }
  const checks = [
    () => api.licensing.status(), () => api.licensing.activate('unknown'), () => api.licensing.refresh(),
    () => api.branches.list(), () => api.branches.create({branchId}), () => api.branches.update({branchId}), () => api.branches.setActive({branchId}),
    () => api.transfers.list({branchId}), () => api.transfers.detail(branchId,'unknown'), () => api.transfers.dispatch({branchId}), () => api.transfers.receive({branchId}), () => api.transfers.cancel({branchId}),
    () => api.reports.snapshot({branchId}), () => api.reports.exportCsv({branchId}), () => api.reports.valuation(branchId),
    () => api.customers.list({ branchId }), () => api.customers.detail(branchId, 'unknown'), () => api.customers.receipt(branchId, 'unknown'), () => api.customers.create({ branchId }), () => api.customers.update({ branchId }), () => api.customers.collect({ branchId }),
    () => api.expenses.list({ branchId }), () => api.expenses.post({ branchId }), () => api.expenses.reverse({ branchId }),
    () => api.cash.getSnapshot(branchId), () => api.cash.closeShift({ branchId }), () => api.cash.move({ branchId }),
    () => api.backup.getStatus(), () => api.backup.create(), () => api.backup.export("unknown"), () => api.backup.previewRestore(), () => api.backup.cancelRestore("unknown"), () => api.backup.restore({}),
    () => api.retail.getSnapshot(branchId), () => api.retail.adjustStock({ branchId }), () => api.retail.receivePurchase({ branchId }), () => api.retail.paySupplier({ branchId }),
    () => api.dashboard.getSnapshot({ branchId, dateRange: 'today', chartPeriod: 'today' }), () => api.dashboard.search('product', branchId), () => api.system.getDatabasePath(),
    () => api.pos.getBootstrap(branchId), () => api.pos.completeSale({ branchId, lines: [] }), () => api.pos.holdSale(branchId, 'customer-walk-in', []), () => api.pos.resumeHeldSale('unknown'), () => api.pos.deleteHeldSale('unknown'), () => api.pos.openShift(branchId, 0), () => api.pos.createProduct(branchId, {}), () => api.pos.createCustomer({}),
    () => api.products.list({ branchId }), () => api.products.save(branchId, {}), () => api.products.toggleStatus(branchId, product.id), () => api.products.importCsv(branchId, ''), () => api.products.exportCsv(branchId),
    () => api.sales.getSnapshot(query), () => api.sales.getDetail(branchId, 'unknown'), () => api.sales.createReturn({ branchId }), () => api.sales.exportCsv(query),
    () => api.auth.listUsers(), () => api.auth.createUser({}), () => api.auth.updateUser({}), () => api.auth.resetPassword(cashier.id, 'Reset temp passphrase 2026'), () => api.auth.changePassword('x', 'y'), () => api.auth.selectBranch(branchId),
  ]
  for (let index = 0; index < checks.length; index++) await denied(checks[index], 'Signed-out endpoint ' + index)
  input('.auth-card input[name="username"]', 'smoke.cashier'); input('.auth-card input[name="password"]', 'wrong password')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.auth-card').requestSubmit()
  await wait(() => document.querySelector('.auth-error')?.textContent.includes('Invalid username'), 'wrong-password error')
  input('.auth-card input[name="password"]', 'Smoke temporary passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.auth-card').requestSubmit()
  await wait(() => document.querySelector('.auth-card input[name="currentPassword"]'), 'mandatory password-change form')
  await denied(() => api.pos.getBootstrap(branchId), 'Temporary password operational block')
  input('.auth-card input[name="currentPassword"]', 'Smoke temporary passphrase 2026'); input('.auth-card input[name="newPassword"]', 'Smoke cashier own passphrase 2026'); input('.auth-card input[name="confirmPassword"]', 'Smoke cashier own passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.auth-card').requestSubmit()
  await wait(() => document.querySelector('.pos-screen'), 'cashier POS')
  for (const page of ['Products', 'Staff', 'Inventory', 'Suppliers', 'Dashboard', 'Expenses', 'Settings', 'Reports', 'Branches', 'Stock Transfers']) assert(!document.querySelector('[aria-label="Main navigation"] button[aria-label="' + page + '"]'), 'Cashier sees restricted page: ' + page)
  await denied(() => api.retail.adjustStock({ branchId }), 'Cashier adjustment')
  await denied(() => api.retail.paySupplier({ branchId }), 'Cashier supplier payment')
  await denied(() => api.sales.createReturn({ branchId }), 'Cashier refund')
  await denied(() => api.auth.listUsers(), 'Cashier staff administration')
  await denied(() => api.pos.getBootstrap('branch-forbidden'), 'Cross-branch request')
  await denied(() => api.pos.completeSale({ branchId, lines: [{ productId: product.id, quantityMilli: 1000, discountBasisPoints: 500 }] }), 'Cashier discount')
  await wait(() => document.querySelector('button[aria-label="Add Auth Smoke Product"]'), 'cashier product grid')
  document.querySelector('button[aria-label="Add Auth Smoke Product"]').click()
  await wait(() => document.querySelector('.line-discount'), 'sale cart')
  assert(document.querySelector('.line-discount').disabled, 'Cashier discount selector enabled')
  document.querySelector('.pos-shift-warning').click()
  await wait(() => document.querySelector('.pos-modal input[type="number"]'), 'shift form')
  input('.pos-modal input[type="number"]', '1000')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.pos-modal form').requestSubmit()
  await wait(() => !document.querySelector('.pos-modal') && !document.querySelector('.pos-shift-warning'), 'cashier shift opened')
  input('.cash-fields input', '150')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.complete-sale').click()
  await wait(() => document.querySelector('.receipt-modal'), 'cashier sale receipt')
  clickText('.receipt-actions button', 'Close')
  navigate('Sales')
  await wait(() => document.querySelector('.sales-transactions tbody tr'), 'cashier sale history')
  document.querySelector('.sales-transactions button[aria-label^="View "]').click()
  await wait(() => document.querySelector('.sales-invoice-modal'), 'cashier invoice')
  assert(document.querySelector('.sales-invoice-content').textContent.includes('Cashier: Smoke Cashier'), 'Invoice attributed to the wrong user')
  assert(!document.querySelector('.sales-return-form'), 'Cashier refund form is visible')
  clickText('.sales-invoice-modal footer button', 'Close')
  navigate('My Account')
  await wait(() => document.querySelector('.identity-summary'), 'real account profile')
  assert(document.querySelector('.identity-summary').textContent.includes('smoke.cashier'), 'Account profile uses a placeholder')
  input('.identity-form input[name="currentPassword"]', 'Smoke cashier own passphrase 2026'); input('.identity-form input[name="newPassword"]', 'Smoke cashier changed passphrase 2026'); input('.identity-form input[name="confirmPassword"]', 'Smoke cashier changed passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.identity-form').requestSubmit()
  await wait(() => document.querySelector('.identity-message')?.textContent.includes('Password updated'), 'account password change')
  clickText('.session-bar button', 'Sign out')
  await wait(() => document.querySelector('.auth-card input[name="username"]'), 'cashier logout')
  input('.auth-card input[name="username"]', 'smoke.owner'); input('.auth-card input[name="password"]', 'Smoke owner passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.auth-card').requestSubmit()
  await wait(() => document.querySelector('.session-bar'), 'owner login')
  navigate('Staff')
  await wait(() => document.querySelector('button[aria-label="Edit access for Smoke Cashier"]'), 'edit staff action')
  document.querySelector('button[aria-label="Edit access for Smoke Cashier"]').click()
  await wait(() => document.querySelector('section[aria-label="Edit staff access"]'), 'staff access editor')
  const editPanel = document.querySelector('section[aria-label="Edit staff access"]')
  input('section[aria-label="Edit staff access"] select:nth-of-type(1)', 'Manager')
  await new Promise(resolve => setTimeout(resolve, 80)); editPanel.querySelector('form').requestSubmit()
  await wait(() => !document.querySelector('section[aria-label="Edit staff access"]'), 'role change saved')
  assert((await api.auth.listUsers()).find(user => user.id === cashier.id).role === 'Manager', 'Staff role update did not persist')
  document.querySelector('button[aria-label="Edit access for Smoke Cashier"]').click()
  await wait(() => document.querySelector('input[aria-label="Reset staff password"]'), 'owner reset-password form')
  input('input[aria-label="Reset staff password"]', 'Smoke reset passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('input[aria-label="Reset staff password"]').closest('form').requestSubmit()
  await wait(() => document.querySelector('.identity-message')?.textContent.includes('Password reset.'), 'owner password reset')
  assert((await api.auth.listUsers()).find(user => user.id === cashier.id).mustChangePassword, 'Owner reset did not force a password change')
  input('section[aria-label="Edit staff access"] label:nth-child(2) select', 'disabled')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('section[aria-label="Edit staff access"] form').requestSubmit()
  await wait(() => !document.querySelector('section[aria-label="Edit staff access"]'), 'staff disabled')
  assert(!(await api.auth.listUsers()).find(user => user.id === cashier.id).isActive, 'Disable did not persist')
  clickText('.session-bar button', 'Sign out')
  await wait(() => document.querySelector('.auth-card input[name="username"]'), 'owner logout after disabling staff')
  input('.auth-card input[name="username"]', 'smoke.cashier'); input('.auth-card input[name="password"]', 'Smoke reset passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.auth-card').requestSubmit()
  await wait(() => document.querySelector('.auth-error')?.textContent.includes('Invalid username'), 'disabled staff login refused')
  input('.auth-card input[name="username"]', 'smoke.owner'); input('.auth-card input[name="password"]', 'Smoke owner passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 80)); document.querySelector('.auth-card').requestSubmit()
  await wait(() => document.querySelector('.session-bar'), 'owner returned')
  navigate('Staff')
  await wait(() => document.querySelector('.identity-table tbody')?.textContent.includes('Disabled'), 'final staff status')
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return { offline: true, protectedEndpoints: checks.length, setupForm: true, staffForm: true, cashierLogin: true, forcedPasswordChange: true, cashierSaleForm: true, cashierActor: true, restrictedIpc: true, accountPasswordForm: true, ownerRoleForm: true, ownerResetForm: true, disabledLoginDenied: true }
})()
