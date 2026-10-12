import { createHash, createPrivateKey, createPublicKey, randomUUID } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync, backup } from 'node:sqlite'
import { publicKeyId, validateTrust } from '../electron-dist/electron/licensing/protocol.mjs'

export async function backupCompany(source, output) {
  source = resolve(source); output = resolve(output)
  const relation = relative(source, output)
  if (!relation || !(relation === '..' || relation.startsWith('..' + sep) || isAbsolute(relation))) throw new Error('Company backups must be outside the live company-data directory.')
  const privateKey = readFileSync(join(source, 'issuer-private.pem')), configuration = readFileSync(join(source, 'client-trust.json'))
  const key = createPrivateKey(privateKey), publicKey = createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString()
  const trust = validateTrust(JSON.parse(configuration.toString('utf8')), true)
  if (publicKeyId(publicKey) !== publicKeyId(trust.issuerPublicKey)) throw new Error('Company signing identity and public configuration do not match.')
  mkdirSync(output, { recursive: true, mode: 0o700 })
  const destination = join(output, 'company-snapshot-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8))
  mkdirSync(destination, { mode: 0o700 })
  const db = new DatabaseSync(join(source, 'company.db'), { readOnly: true })
  try { await backup(db, join(destination, 'company.db')) } finally { db.close() }
  chmodSync(join(destination, 'company.db'), 0o600)
  const copy = new DatabaseSync(join(destination, 'company.db'), { readOnly: true })
  try {
    if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || copy.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Company snapshot failed database verification.')
    if (!copy.prepare("SELECT 1 FROM sqlite_master WHERE name='licenses'").get()) throw new Error('Company registry is missing from snapshot.')
  } finally { copy.close() }
  if (!privateKey.equals(readFileSync(join(source, 'issuer-private.pem')))) throw new Error('Company signing identity changed during backup. Snapshot is incomplete.')
  writeFileSync(join(destination, 'issuer-private.pem'), privateKey, { mode: 0o600, flag: 'wx', flush: true })
  writeFileSync(join(destination, 'client-trust.json'), configuration, { mode: 0o600, flag: 'wx', flush: true })
  const hashes = Object.fromEntries(['company.db', 'issuer-private.pem', 'client-trust.json'].map(file => [file, createHash('sha256').update(readFileSync(join(destination, file))).digest('hex')]))
  writeFileSync(join(destination, 'snapshot.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files: hashes }, null, 2) + '\n', { mode: 0o600, flag: 'wx', flush: true })
  return { directory: destination, verified: true }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.env.VERTEXIA_COMPANY_DATA || !process.env.VERTEXIA_COMPANY_BACKUPS) throw new Error('Set VERTEXIA_COMPANY_DATA and VERTEXIA_COMPANY_BACKUPS to private absolute directories.')
    if (![process.env.VERTEXIA_COMPANY_DATA, process.env.VERTEXIA_COMPANY_BACKUPS].every(isAbsolute)) throw new Error('Company data and backup directories must be absolute.')
    console.log(JSON.stringify(await backupCompany(process.env.VERTEXIA_COMPANY_DATA, process.env.VERTEXIA_COMPANY_BACKUPS)))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
