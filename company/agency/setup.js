const setup = document.getElementById('setup-form'), enrollment = document.getElementById('enrollment-form'), error = document.getElementById('error'), key = document.getElementById('enrollment-key')
let token = new URLSearchParams(location.hash.slice(1)).get('token') || '', credentials = null
history.replaceState(null, '', '/agency/setup')
function showError(message) { error.textContent = message; error.hidden = false }
async function post(path, input, headers = {}) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(input), credentials: 'same-origin', redirect: 'error' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Unable to complete setup. Please retry.')
  return data
}
setup.querySelector('button').disabled = true
fetch('/agency/api/setup-state', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.json()).then(state => {
  if (state.authorized || /^[a-f0-9]{64}$/.test(token)) setup.querySelector('button').disabled = false
  else showError('Open the private setup window using npm run dev:agency. Then return here to create your account.')
}).catch(() => showError('Cannot check local setup. Make sure the agency service is running.'))
setup.addEventListener('submit', async event => {
  event.preventDefault(); error.hidden = true
  const input = new FormData(setup), username = input.get('username'), password = input.get('password')
  if (password !== input.get('confirmation')) { showError('Passwords do not match.'); return }
  const button = setup.querySelector('button'); button.disabled = true
  try {
    const result = await post('/agency/api/setup', { username, password }, { 'x-setup-token': token })
    token = ''; credentials = { username, password }; key.value = result.secret
    setup.reset(); setup.hidden = true; enrollment.hidden = false; enrollment.elements.code.focus()
  } catch (failure) { showError(failure.message); button.disabled = false }
})
document.getElementById('copy-secret').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(key.value) } catch { key.focus(); key.select(); showError('Select and copy the setup key manually.') }
})
enrollment.addEventListener('submit', async event => {
  event.preventDefault(); error.hidden = true; const button = enrollment.querySelector('button[type="submit"]'); button.disabled = true
  try {
    await post('/agency/api/login', { ...credentials, code: enrollment.elements.code.value })
    credentials = null; key.value = ''; enrollment.reset(); location.replace('/agency/')
  } catch (failure) { showError(failure.message); button.disabled = false }
})
addEventListener('pagehide', () => { token = ''; credentials = null; key.value = ''; setup.reset(); enrollment.reset() })
