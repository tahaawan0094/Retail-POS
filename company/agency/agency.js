const $ = selector => document.querySelector(selector)
let csrf = '', data = null, changing = false, loading = null, noticeTimer, errorTimer, lastActivity = Date.now(), lastTouch = Date.now()
const date = value => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node }
function message(id, value) { const node = $(id); node.textContent = value; node.hidden = !value }
function error(cause) { message('#error', cause.message || 'Request failed.'); clearTimeout(errorTimer); errorTimer = setTimeout(() => message('#error', ''), 12000) }
function notice(value) { message('#notice', value); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => message('#notice', ''), 7000) }
function signedOut() {
  csrf = ''; data = null; $('#businesses').replaceChildren(); $('#audit').replaceChildren(); $('#stats').replaceChildren()
  $('#activation-key').value = ''; document.querySelectorAll('dialog[open]').forEach(d => d.close())
  $('#dashboard').hidden = true; $('#identity').hidden = true; $('#login-panel').hidden = false; $('#secure-label').hidden = false
}
async function api(path, body) {
  const response = await fetch('/agency/api/' + path, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000), ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) }) })
  const value = await response.json()
  if (!response.ok) { if (response.status === 401) signedOut(); throw new Error(value.error || 'Company request failed.') }
  return value
}
function signedIn(session) {
  csrf = session.csrf; $('#admin-name').textContent = session.username
  $('#login-panel').hidden = true; $('#secure-label').hidden = true; $('#dashboard').hidden = false; $('#identity').hidden = false
  lastActivity = lastTouch = Date.now()
}
async function refresh(force = false) {
  if (!csrf || changing || loading && !force) return
  if (loading) await loading.catch(() => {})
  if (!csrf || changing) return
  const pending = api('dashboard'); loading = pending
  try { const snapshot = await pending; if (!csrf) return; data = snapshot; render(); $('#updated').textContent = 'Updated ' + new Date(data.serverTime).toLocaleTimeString() }
  catch (cause) { error(cause) } finally { if (loading === pending) loading = null }
}
async function change(path, body, text) {
  if (changing) return
  changing = true; document.querySelectorAll('[data-action]').forEach(b => { b.disabled = true })
  try { const value = await api(path, body); notice(text); return value }
  finally { changing = false; document.querySelectorAll('[data-action]').forEach(b => { b.disabled = false }); await refresh(true) }
}
function button(text, className, action) {
  const b = element('button', className, text); b.type = 'button'; b.dataset.action = 'true'; b.disabled = changing
  b.addEventListener('click', () => { if (!changing) Promise.resolve(action()).catch(error) }); return b
}
function render() {
  if (!data) return
  const businesses = data.businesses, branches = businesses.flatMap(b => b.branches)
  $('#stats').replaceChildren(...[['Customers', businesses.length], ['Branches', branches.length], ['Online devices', businesses.reduce((n, b) => n + b.devices.filter(d => d.online && d.active).length, 0)], ['Needs approval', branches.filter(b => b.status === 'pending').length]].map(([name, count]) => { const card = element('div', 'card stat'); card.append(element('small', '', name), element('strong', '', String(count))); return card }))
  const query = $('#search').value.trim().toLowerCase(), filter = $('#filter').value
  const visible = businesses.filter(b => {
    const status = b.expiresAt <= data.serverTime ? 'expired' : b.status
    return (filter === 'all' || filter === status) && (!query || [b.customerName, ...b.devices.flatMap(d => [d.ownerName, d.businessName]), ...b.branches.flatMap(branch => [branch.name, branch.city, branch.code])].filter(Boolean).join(' ').toLowerCase().includes(query))
  })
  const cards = visible.map(b => {
    const card = element('article', 'business-card card'); card.dataset.licenseId = b.licenseId
    const heading = element('div', 'business-heading'), identity = element('div', 'customer-identity'), names = element('div')
    names.append(element('h2', '', b.customerName))
    const ownerNames = [...new Set(b.devices.map(d => d.ownerName).filter(Boolean))].join(', '), businessNames = [...new Set(b.devices.map(d => d.businessName).filter(Boolean))].join(' · ')
    if (ownerNames || businessNames) names.append(element('p', 'muted', [ownerNames && 'Owner: ' + ownerNames, businessNames].filter(Boolean).join(' · ')))
    names.append(element('p', 'muted', 'Expires ' + date(b.expiresAt) + ' · ' + b.registeredDevices + '/' + b.maxDevices + ' devices · ' + b.offlineDays + ' days offline'))
    identity.append(element('div', 'customer-avatar', b.customerName.slice(0, 1).toUpperCase()), names)
    const actions = element('div', 'business-actions'), effective = b.expiresAt <= data.serverTime ? 'expired' : b.status
    actions.append(element('span', 'badge ' + effective, effective === 'active' ? 'Business enabled' : effective === 'suspended' ? 'Business disabled' : 'License expired'))
    actions.append(button(b.status === 'active' ? 'Disable business' : 'Enable business', b.status === 'active' ? 'danger' : 'enable', () => change('license-status', { id: b.licenseId, status: b.status === 'active' ? 'suspended' : 'active' }, 'Business access updated. Connected POS devices will check shortly.')))
    actions.append(button('Renew', 'quiet', () => { $('#renew-form [name=id]').value = b.licenseId; $('#renew-form [name=expiresAt]').value = new Date(Math.max(Date.now(), b.expiresAt) + 30 * 86400000).toISOString().slice(0, 10); $('#renew-dialog').showModal() }))
    heading.append(identity, actions); card.append(heading)
    if (!b.branches.length) card.append(element('p', 'empty', 'Waiting for the customer to activate a POS and register its branches.'))
    else {
      const scroll = element('div', 'table-scroll'), table = element('table', 'branch-table'), head = element('thead'), header = element('tr'), body = element('tbody')
      for (const label of ['Branch', 'City', 'Connection', 'Access', 'Control']) header.append(element('th', '', label))
      head.append(header); table.append(head, body)
      for (const branch of b.branches) {
        const row = element('tr'); row.dataset.branchId = branch.id
        const name = element('td'), connection = element('td'), access = element('td'), control = element('td', 'branch-action')
        name.append(element('span', 'branch-title', branch.name), element('span', 'branch-code', branch.code + ' · Installation ' + branch.installationId.slice(0, 8)))
        connection.append(element('span', 'connection ' + (branch.online ? 'online' : 'offline'), branch.online ? '● Online' : '○ Offline'), element('span', 'delivery', branch.deviceCount + ' registered devices'))
        access.append(element('span', 'badge ' + branch.effectiveStatus, branch.effectiveStatus === 'active' ? 'Enabled' : branch.effectiveStatus === 'pending' ? 'Approval needed' : branch.effectiveStatus === 'expired' ? 'Expired' : 'Disabled'), element('span', 'delivery', branch.applied ? 'Applied · device confirmed' : branch.online ? 'Awaiting device confirmation' : 'Waiting for connection'))
        const enable = branch.status !== 'active'
        control.append(button(enable ? 'Enable branch' : 'Disable branch', enable ? 'enable' : 'danger', () => change('branch-status', { id: branch.id, status: enable ? 'active' : 'suspended' }, 'Branch access updated. Business suspension and expiry still apply.')))
        if (b.status !== 'active' || b.expiresAt <= data.serverTime) control.append(element('span', 'delivery', 'Business license overrides branch access'))
        row.append(name, element('td', '', branch.city || '—'), connection, access, control); body.append(row)
      }
      scroll.append(table); card.append(scroll)
    }
    const footer = element('div', 'license-footer'); footer.append(element('span', '', 'License ' + b.licenseId), element('span', '', 'Tenant ' + b.tenantId)); card.append(footer); return card
  })
  $('#businesses').replaceChildren(...(cards.length ? cards : [element('div', 'card empty', businesses.length ? 'No matching customers.' : 'Create a customer license to get started.')]))
  $('#audit').replaceChildren(...data.audit.map(a => { const row = element('div', 'audit-row'); row.append(element('strong', '', a.action), element('span', '', a.entityId.slice(0, 12)), element('span', '', new Date(a.occurredAt).toLocaleString())); row.title = a.detail; return row }))
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button'); submit.disabled = true; message('#error', '')
  try { const fields = Object.fromEntries(new FormData(form)); fields.username = fields.username.trim().toLowerCase(); signedIn(await api('login', fields)); form.reset(); await refresh() }
  catch (cause) { error(cause); form.elements.password.value = ''; form.elements.code.value = '' } finally { submit.disabled = false }
})
$('#logout').addEventListener('click', async () => { try { await api('logout', {}); signedOut() } catch (cause) { error(cause) } })
$('#refresh').addEventListener('click', () => void refresh())
$('#search').addEventListener('input', render); $('#filter').addEventListener('change', render)
$('#new-license').addEventListener('click', () => { $('#issue-form [name=expiresAt]').value = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10); $('#issue-dialog').showModal() })
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { if (b.dataset.close === 'key-dialog') { $('#activation-key').value = ''; $('#license-reference').textContent = '' } $('#' + b.dataset.close).close() }))
$('#key-dialog').addEventListener('close', () => { $('#activation-key').value = ''; $('#license-reference').textContent = '' })
$('#copy-key').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#activation-key').value); notice('Activation key copied.') } catch { $('#activation-key').select(); notice('Select and copy the activation key.') } })
$('#issue-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('[type=submit]'); submit.disabled = true
  try { const input = Object.fromEntries(new FormData(form)); input.maxDevices = Number(input.maxDevices); input.offlineDays = Number(input.offlineDays); input.expiresAt += 'T23:59:59.999Z'; const result = await change('issue', input, 'Customer license created.'); if (result) { $('#issue-dialog').close(); $('#activation-key').value = result.activationKey; $('#license-reference').textContent = 'License ' + result.licenseId; $('#key-dialog').showModal(); form.reset() } }
  catch (cause) { error(cause) } finally { submit.disabled = false }
})
$('#renew-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('[type=submit]'); submit.disabled = true
  try { const input = Object.fromEntries(new FormData(form)); input.expiresAt += 'T23:59:59.999Z'; await change('renew', input, 'License renewed.'); $('#renew-dialog').close() } catch (cause) { error(cause) } finally { submit.disabled = false }
})
for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, () => { lastActivity = Date.now() })
setInterval(async () => {
  if (!csrf || document.hidden) return
  if (lastActivity > lastTouch && Date.now() - lastTouch > 60000) { lastTouch = Date.now(); try { await api('touch', {}) } catch (cause) { error(cause) } }
  await refresh()
}, 10000)
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh() })
void api('session').then(async session => { signedIn(session); await refresh() }).catch(async () => {
  signedOut()
  try { const state = await api('setup-state'); $('#setup-account').hidden = !state.pending } catch { /* Normal sign-in remains available. */ }
})
