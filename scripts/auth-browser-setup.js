(async () => {
  const wait = async predicate => {
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 80)) }
    throw new Error('Setup/login screen did not become ready: ' + document.body.innerText.slice(-1000))
  }
  const input = (name, value) => {
    const element = document.querySelector('.auth-card input[name="' + name + '"]')
    if (!element) throw new Error('Missing setup input: ' + name)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await wait(() => document.querySelector('.auth-card input[name="username"]'))
  const setup = Boolean(document.querySelector('.auth-card input[name="businessName"]'))
  if (setup) {
    input('businessName', 'Smoke Retail Shop'); input('branchName', 'Smoke Main Branch'); input('city', 'Karachi'); input('ownerName', 'Smoke Owner')
    input('confirmPassword', 'Smoke owner passphrase 2026')
  }
  input('username', 'smoke.owner'); input('password', 'Smoke owner passphrase 2026')
  await new Promise(resolve => setTimeout(resolve, 100))
  document.querySelector('.auth-card').requestSubmit()
  await wait(() => document.querySelector('.session-bar'))
  return { setup, login: true }
})()
