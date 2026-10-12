import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LicenseAuthority } from './authority.mjs'
import { AgencyAuth } from './agency-auth.mjs'
import { publicKeyId, validateTrust, verifyDeviceRequest } from './protocol.mjs'

type AgencyOptions = { origin: string; allowLocal?: boolean; assetsPath?: string; localSetupToken?: string; localControlToken?: string }
export function createLicenseServer(authority: LicenseAuthority, agency?: AgencyOptions) {
  const origin = agency ? validateTrust({ serviceUrl: agency.origin, issuerPublicKey: authority.publicKey }, agency.allowLocal).serviceUrl : null
  const secure = origin?.startsWith('https:') ?? false
  const cookieName = secure ? '__Host-vertexia_agency' : 'vertexia_agency'
  const auth = agency ? new AgencyAuth(authority.db) : null
  for (const token of [agency?.localSetupToken, agency?.localControlToken]) if (token && (secure || !origin?.startsWith('http:') || !/^[a-f0-9]{64}$/.test(token))) throw new Error('First-run browser setup requires a numeric loopback HTTP origin and a private setup token.')
  let setupBusy = false
  const assets = new Map<string, { type: string; content: Buffer }>()
  if (agency) {
    const directory = agency.assetsPath ?? fileURLToPath(new URL('../../../company/agency/', import.meta.url))
    for (const [name, type] of [['index.html', 'text/html'], ['agency.css', 'text/css'], ['agency.js', 'text/javascript']]) assets.set(name, { type: type + '; charset=utf-8', content: readFileSync(join(directory, name)) })
    if (agency.localSetupToken) for (const [name, type] of [['setup.html', 'text/html'], ['setup.js', 'text/javascript']]) assets.set(name, { type: type + '; charset=utf-8', content: readFileSync(join(directory, name)) })
  }
  const attempts = new Map<string, { start: number; count: number }>()
  function limited(key: string, limit: number) {
    const now = Date.now()
    for (const [id, entry] of attempts) if (now - entry.start >= 60000) attempts.delete(id)
    if (!attempts.has(key) && attempts.size >= 10000) return true
    const attempt = attempts.get(key) ?? { start: now, count: 0 }
    attempts.set(key, attempt)
    return ++attempt.count > limit || attempts.size > 10000
  }
  const cookie = (token: string, clear = false) => cookieName + '=' + token + '; Path=/; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : '') + (clear ? '; Max-Age=0' : '')
  const setupCookieName = 'vertexia_agency_setup'
  const equalToken = (value: unknown, expected: string | undefined) => typeof value === 'string' && !!expected && /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
    if (secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000')
    const send = (status: number, value: unknown) => response.writeHead(status).end(JSON.stringify(value))
    const address = request.socket.remoteAddress ?? 'unknown', path = request.url ?? ''
    const body = async () => {
      if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('JSON request required.')
      const chunks: Buffer[] = []; let size = 0
      for await (const chunk of request) {
        const buffer = Buffer.from(chunk as Buffer); size += buffer.length
        if (size > 16000) throw new Error('Request too large.')
        chunks.push(buffer)
      }
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request.')
      return input
    }
    try {
      if (agency && request.method === 'GET' && path === '/healthz') {
        try { authority.db.prepare('SELECT 1').get(); send(200, { status: 'ok', service: 'vertexia-agency' }) }
        catch { send(503, { status: 'unavailable' }) }
        return
      }
      if (path.startsWith('/agency')) {
        if (!agency || !origin || !auth) { send(404, { error: 'Unavailable endpoint.' }); return }
        if (request.headers.host !== new URL(origin).host) { send(403, { error: 'Invalid dashboard host.' }); request.resume(); return }
        const setupCookie = request.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(setupCookieName + '='))?.slice(setupCookieName.length + 1)
        if (request.method === 'GET' && path.startsWith('/agency/setup/start/')) {
          if (!agency.localSetupToken || !equalToken(path.slice('/agency/setup/start/'.length), agency.localSetupToken)) { send(403, { error: 'Invalid private setup link.' }); return }
          if (authority.db.prepare('SELECT 1 FROM agency_admins LIMIT 1').get()) { response.writeHead(303, { Location: '/agency/' }).end(); return }
          response.setHeader('Set-Cookie', setupCookieName + '=' + agency.localSetupToken + '; Path=/agency; HttpOnly; SameSite=Strict; Max-Age=900')
          response.writeHead(303, { Location: '/agency/setup' }).end(); return
        }
        if (request.method === 'GET' && ['/agency/setup', '/agency/setup.js'].includes(path)) {
          if (!agency.localSetupToken) { send(404, { error: 'Unavailable endpoint.' }); return }
          if (path === '/agency/setup' && authority.db.prepare('SELECT 1 FROM agency_admins LIMIT 1').get()) { response.writeHead(303, { Location: '/agency/' }).end(); return }
          const asset = assets.get(path.endsWith('.js') ? 'setup.js' : 'setup.html')!
          response.setHeader('Content-Type', asset.type); response.writeHead(200).end(asset.content); return
        }
        if (request.method === 'GET' && ['/agency', '/agency/', '/agency/agency.css', '/agency/agency.js'].includes(path)) {
          const asset = assets.get(path.endsWith('agency.css') ? 'agency.css' : path.endsWith('agency.js') ? 'agency.js' : 'index.html')!
          response.setHeader('Content-Type', asset.type); response.writeHead(200).end(asset.content); return
        }
        if (!path.startsWith('/agency/api/') || !['GET', 'POST'].includes(request.method ?? '')) { send(404, { error: 'Unavailable endpoint.' }); return }
        if (request.method === 'POST' && request.headers.origin !== origin) { send(403, { error: 'Dashboard origin verification failed.' }); request.resume(); return }
        if (path === '/agency/api/setup-state' && request.method === 'GET') {
          const pending = !!agency.localSetupToken && !authority.db.prepare('SELECT 1 FROM agency_admins LIMIT 1').get()
          send(200, { pending, authorized: pending && equalToken(setupCookie, agency.localSetupToken) }); return
        }
        if (path === '/agency/api/local-open' && request.method === 'POST') {
          if (!agency.localControlToken) { send(404, { error: 'Unavailable endpoint.' }); request.resume(); return }
          const token = request.headers['x-local-control-token']
          if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(agency.localControlToken))) { send(403, { error: 'Private local startup token required.' }); request.resume(); return }
          const setupPending = agency.localSetupToken && !authority.db.prepare('SELECT 1 FROM agency_admins LIMIT 1').get()
          send(200, { issuerKeyId: publicKeyId(authority.publicKey), path: setupPending ? '/agency/setup#token=' + agency.localSetupToken : '/agency/' }); request.resume(); return
        }
        if (path === '/agency/api/setup' && request.method === 'POST') {
          if (!agency.localSetupToken) { send(404, { error: 'Unavailable endpoint.' }); request.resume(); return }
          const token = request.headers['x-setup-token'] || setupCookie
          if (!equalToken(token, agency.localSetupToken)) { send(403, { error: 'Open the private setup window using npm run dev:agency.' }); request.resume(); return }
          if (setupBusy || authority.db.prepare('SELECT 1 FROM agency_admins LIMIT 1').get()) { send(409, { error: 'Agency setup is already complete or in progress.' }); request.resume(); return }
          if (limited('setup:' + address, 5)) { send(429, { error: 'Too many setup attempts. Retry in one minute.' }); request.resume(); return }
          setupBusy = true
          try {
            const input = await body(), enrollment = await auth.provision(input.username, input.password, false, true)
            response.setHeader('Set-Cookie', setupCookieName + '=; Path=/agency; HttpOnly; SameSite=Strict; Max-Age=0')
            send(201, enrollment)
          }
          finally { setupBusy = false }
          return
        }
        const token = request.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
        if (path === '/agency/api/login' && request.method === 'POST') {
          if (limited('login:' + address, 10)) { send(429, { error: 'Too many login attempts. Retry later.' }); request.resume(); return }
          const input = await body()
          const session = await auth.login(input.username, input.password, input.code)
          response.setHeader('Set-Cookie', cookie(session.token)); send(200, { username: session.username, csrf: session.csrf }); return
        }
        const session = auth.session(token)
        if (!session) { send(401, { error: 'Sign in to the agency dashboard.' }); request.resume(); return }
        if (request.method === 'GET') {
          if (limited('agency-read:' + session.adminId, 120)) { send(429, { error: 'Too many dashboard requests.' }); return }
          if (path === '/agency/api/session') send(200, { username: session.username, csrf: session.csrf })
          else if (path === '/agency/api/dashboard') send(200, authority.dashboard())
          else send(404, { error: 'Unavailable endpoint.' })
          return
        }
        if (request.headers['x-csrf-token'] !== session.csrf) { send(403, { error: 'Dashboard security token is invalid. Reload and sign in again.' }); request.resume(); return }
        if (limited('agency-write:' + session.adminId, 60)) { send(429, { error: 'Too many dashboard changes.' }); request.resume(); return }
        const input = await body()
        if (!auth.session(token, true)) { send(401, { error: 'Agency session expired.' }); return }
        if (path === '/agency/api/logout') {
          auth.logout(token!); response.setHeader('Set-Cookie', cookie('', true)); send(200, { ok: true }); return
        }
        if (path === '/agency/api/touch') { send(200, { ok: true }); return }
        const result = authority.asAdmin(session.adminId, () => {
          if (path === '/agency/api/license-status') { authority.changeStatus(input.id, input.status, 'Agency dashboard: ' + input.status); return { ok: true } }
          if (path === '/agency/api/branch-status') { authority.changeBranchStatus(input.id, input.status, 'Agency dashboard: ' + input.status); return { ok: true } }
          if (path === '/agency/api/issue') return authority.issue(input.customerName, Date.parse(input.expiresAt), input.maxDevices, input.offlineDays)
          if (path === '/agency/api/renew') { authority.renew(input.id, Date.parse(input.expiresAt), 'Agency dashboard renewal'); return { ok: true } }
          throw new Error('Unavailable dashboard action.')
        })
        send(200, result); return
      }
      if (request.method !== 'POST' || !['/v1/activate', '/v1/refresh'].includes(path)) { send(404, { error: 'Unavailable endpoint.' }); request.resume(); return }
      const invalid = attempts.get('invalid-device:' + address)
      if (agency && path === '/v1/refresh' && invalid && invalid.count >= 30 && Date.now() - invalid.start < 60000) { send(429, { error: 'Too many invalid device requests.' }); request.resume(); return }
      // Dashboard mode limits authenticated heartbeats per device, keeping shared NATs usable.
      if ((!agency || path === '/v1/activate') && limited('device-ip:' + address, 30)) { send(429, { error: 'Too many requests. Retry in one minute.' }); request.resume(); return }
      const input = await body()
      if (input.action !== (path === '/v1/activate' ? 'activate' : 'refresh')) throw new Error('Request action does not match endpoint.')
      if (agency && path === '/v1/refresh') {
        const verified = verifyDeviceRequest(input, Date.now()), id = publicKeyId(verified.publicKey)
        if (!authority.db.prepare('SELECT 1 FROM devices WHERE id=?').get(id)) throw new Error('Device is not registered.')
        if (limited('device:' + id, 20)) { send(429, { error: 'Too many device checks. Retry in one minute.' }); return }
      }
      const result = authority.exchange(input)
      send(200, result)
    } catch (error) {
      if (agency && path === '/v1/refresh' && limited('invalid-device:' + address, 30)) { send(429, { error: 'Too many invalid device requests.' }); return }
      const message = error instanceof Error && !/SQLITE|constraint|database|JSON|Unexpected/i.test(error.message) ? error.message : 'Invalid request.'
      if (!response.headersSent) send(message === 'Request too large.' ? 413 : 400, { error: message })
    }
  })
  server.requestTimeout = 10000; server.headersTimeout = 10000
  return server
}

