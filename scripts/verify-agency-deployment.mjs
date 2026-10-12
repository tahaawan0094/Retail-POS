import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
export async function verifyAgencyDeployment(origin, allowLocal = false) {
  const url = new URL(origin)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(url.protocol === 'https:' || allowLocal && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Deployment verification requires an HTTPS origin; --local permits numeric loopback HTTP only.')
  const get = path => fetch(url.origin + path, { redirect: 'error', signal: AbortSignal.timeout(10000) })
  const health = await get('/healthz'); assert.equal(health.status, 200, 'Company service readiness failed')
  assert.deepEqual(await health.json(), { status: 'ok', service: 'vertexia-agency' })
  const page = await get('/agency/'); assert.equal(page.status, 200, 'Agency dashboard unavailable')
  assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/)
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff')
  assert.match(await page.text(), /Agency sign in/)
  for (const path of ['/agency/agency.css', '/agency/agency.js']) assert.equal((await get(path)).status, 200, 'Dashboard asset unavailable')
  assert.equal((await get('/agency/api/dashboard')).status, 401, 'Private company dashboard accepted an anonymous request')
  if (url.protocol === 'https:') assert.match(page.headers.get('strict-transport-security') || '', /max-age=/)
  return { origin: url.origin, health: true, dashboard: true, assets: true, anonymousAccessBlocked: true }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await verifyAgencyDeployment(process.argv[2], process.argv.includes('--local')), null, 2)) }
  catch (error) { console.error('Agency deployment check failed: ' + error.message); process.exitCode = 1 }
}
