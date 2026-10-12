import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { LicenseAuthority } from '../electron-dist/electron/licensing/authority.mjs'
import { createLicenseServer } from '../electron-dist/electron/licensing/server.mjs'
import { AgencyAuth } from '../electron-dist/electron/licensing/agency-auth.mjs'
import { packageAgency } from '../scripts/package-agency.mjs'
import { backupCompany } from '../scripts/backup-company.mjs'
import { verifyAgencyDeployment } from '../scripts/verify-agency-deployment.mjs'

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'vertexia-deploy-test-')), keys = generateKeyPairSync('ed25519'), privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  writeFileSync(join(directory, 'issuer-private.pem'), privateKey)
  const authority = new LicenseAuthority(join(directory, 'company.db'), privateKey)
  writeFileSync(join(directory, 'client-trust.json'), JSON.stringify({ serviceUrl: 'http://127.0.0.1:8787', issuerPublicKey: authority.publicKey }))
  t.after(() => { authority.close(); const path = resolve(directory); assert.equal(dirname(path), resolve(tmpdir())); assert.ok(basename(path).startsWith('vertexia-deploy-test-')); rmSync(path, { recursive: true, force: true }) })
  return { directory, authority, privateKey }
}

test('standalone release verifies its contents and excludes private registries, issuer secrets and POS code', t => {
  const s = fixture(t), release = packageAgency(process.cwd(), join(s.directory, 'releases'))
  const manifest = JSON.parse(readFileSync(join(release.directory, 'release-manifest.json')))
  assert.equal(Object.keys(manifest.files).length + 1, release.fileCount)
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.ok(!/\.db|private\.pem|node_modules|electron\/main|^src\//.test(file), file)
    assert.equal(createHash('sha256').update(readFileSync(join(release.directory, file))).digest('hex'), hash)
  }
  assert.equal(createHash('sha256').update(readFileSync(release.archive)).digest('hex'), release.sha256)
  const help = spawnSync(process.execPath, [join(release.directory, 'scripts/company-license.mjs'), 'help'], { encoding: 'utf8' })
  assert.equal(help.status, 0); assert.match(help.stdout, /admin-create/)
  const contents = spawnSync('tar', ['-tzf', release.archive], { encoding: 'utf8' }); assert.equal(contents.status, 0); assert.ok(!contents.stdout.includes('issuer-private.pem')); assert.match(contents.stdout, /release-manifest.json/)
})

test('company backup includes committed WAL data, complete identity and validated private snapshot checksums', async t => {
  const s = fixture(t), license = s.authority.issue('Backup Customer', Date.now() + 30 * 86400000)
  await new AgencyAuth(s.authority.db).provision('backup.admin', 'Private backup verification passphrase')
  const result = await backupCompany(s.directory, join(dirname(s.directory), basename(s.directory) + '-backups'))
  const parent = dirname(result.directory)
  try {
    const metadata = JSON.parse(readFileSync(join(result.directory, 'snapshot.json')))
    for (const [file, hash] of Object.entries(metadata.files)) assert.equal(createHash('sha256').update(readFileSync(join(result.directory, file))).digest('hex'), hash)
    const copy = new DatabaseSync(join(result.directory, 'company.db'), { readOnly: true })
    try { assert.equal(copy.prepare('SELECT id FROM licenses').get().id, license.licenseId); assert.equal(copy.prepare('SELECT username FROM agency_admins').get().username, 'backup.admin'); assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check, 'ok') } finally { copy.close() }
    assert.equal(readFileSync(join(result.directory, 'issuer-private.pem'), 'utf8'), s.privateKey)
    assert.equal(result.verified, true)
  } finally { assert.equal(dirname(parent), resolve(tmpdir())); assert.ok(basename(parent).startsWith('vertexia-deploy-test-')); rmSync(parent, { recursive: true, force: true }) }
})

test('company backup rejects live-directory targets and mismatched public signing identity', async t => {
  const s = fixture(t)
  await assert.rejects(backupCompany(s.directory, s.directory), /outside/)
  await assert.rejects(backupCompany(s.directory, join(s.directory, 'backups')), /outside/)
  await assert.rejects(backupCompany(s.directory, join(s.directory, '..nested-backups')), /outside/)
  const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString()
  writeFileSync(join(s.directory, 'client-trust.json'), JSON.stringify({ serviceUrl: 'https://license.vertexiaagency.com', issuerPublicKey: other }))
  await assert.rejects(backupCompany(s.directory, join(s.directory, '..', basename(s.directory) + '-backups')), /do not match/)
})

test('changing the public origin preserves issuer and licenses and rejects insecure origins', t => {
  const s = fixture(t), license = s.authority.issue('Origin Customer', Date.now() + 30 * 86400000)
  const run = (...args) => spawnSync(process.execPath, ['scripts/company-license.mjs', ...args], { env: { ...process.env, VERTEXIA_COMPANY_DATA: s.directory }, encoding: 'utf8' })
  assert.equal(run('configure-origin', 'http://example.com').status, 1)
  assert.equal(run('configure-origin', 'https://license.vertexiaagency.com').status, 0)
  const trust = JSON.parse(readFileSync(join(s.directory, 'client-trust.json')))
  assert.equal(trust.serviceUrl, 'https://license.vertexiaagency.com'); assert.equal(trust.issuerPublicKey, s.authority.publicKey)
  assert.equal(readFileSync(join(s.directory, 'issuer-private.pem'), 'utf8'), s.privateKey); assert.equal(s.authority.list()[0].licenseId, license.licenseId)
  const noAdmin = run('serve', '8787'); assert.equal(noAdmin.status, 1); assert.match(noAdmin.stderr, /administrator/)
})

test('company service rejects mismatched public trust before listening', t => {
  const s = fixture(t), other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString()
  writeFileSync(join(s.directory, 'client-trust.json'), JSON.stringify({ serviceUrl: 'http://127.0.0.1:8787', issuerPublicKey: other }))
  const run = spawnSync(process.execPath, ['scripts/company-license.mjs', 'serve', '8787'], { env: { ...process.env, VERTEXIA_COMPANY_DATA: s.directory }, encoding: 'utf8' })
  assert.equal(run.status, 1); assert.match(run.stderr, /does not match/)
})

test('deployment verifier checks live dashboard/readiness and anonymous access while enforcing HTTPS', async t => {
  const s = fixture(t), probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const origin = 'http://127.0.0.1:' + port, server = createLicenseServer(s.authority, { origin, allowLocal: true })
  await new Promise(r => server.listen(port, '127.0.0.1', r))
  try {
    await assert.rejects(verifyAgencyDeployment(origin), /HTTPS/)
    await assert.rejects(verifyAgencyDeployment('http://example.com', true), /HTTPS/)
    assert.deepEqual(await verifyAgencyDeployment(origin, true), { origin, health: true, dashboard: true, assets: true, anonymousAccessBlocked: true })
    const health = await (await fetch(origin + '/healthz')).json(); assert.deepEqual(Object.keys(health).sort(), ['service', 'status'])
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)) }
})
