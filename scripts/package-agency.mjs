import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

// An allowlist keeps customer databases, company credentials and development dependencies
// out of the standalone company-service release. It needs no npm install on the server.
export function packageAgency(root, output) {
  root = resolve(root); output = resolve(output)
  const files = [
    ...['agency-auth', 'authority', 'client', 'policy', 'protocol', 'server'].map(name => 'electron-dist/electron/licensing/' + name + '.mjs'),
    ...['index.html', 'agency.css', 'agency.js', 'setup.html', 'setup.js'].map(name => 'company/agency/' + name),
    ...['company-license.mjs', 'backup-company.mjs', 'verify-agency-deployment.mjs', 'local-agency.mjs'].map(name => 'scripts/' + name),
    ...['vertexia-agency.service', 'vertexia-agency-backup.service', 'vertexia-agency-backup.timer', 'Caddyfile.example', 'README.md', 'LOCAL.md'].map(name => 'company/deploy/' + name),
  ]
  for (const file of files) if (!existsSync(join(root, file)) || !lstatSync(join(root, file)).isFile()) throw new Error('Missing release input: ' + file + '. Run npm run build:electron first.')
  mkdirSync(output, { recursive: true })
  const release = 'vertexia-agency-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8)
  const staging = join(output, release); mkdirSync(staging)
  const hashes = {}
  for (const file of files) {
    const destination = join(staging, file); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(join(root, file), destination)
    hashes[file] = createHash('sha256').update(readFileSync(destination)).digest('hex')
  }
  const pkg = { name: 'vertexia-agency-service', private: true, version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, type: 'module', engines: { node: '>=24.0.0' }, scripts: { 'dev:agency': 'node scripts/local-agency.mjs', start: 'node scripts/company-license.mjs serve', 'company:license': 'node scripts/company-license.mjs', backup: 'node scripts/backup-company.mjs', verify: 'node scripts/verify-agency-deployment.mjs' } }
  writeFileSync(join(staging, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', { flag: 'wx' })
  hashes['package.json'] = createHash('sha256').update(readFileSync(join(staging, 'package.json'))).digest('hex')
  writeFileSync(join(staging, 'release-manifest.json'), JSON.stringify({ release, createdAt: new Date().toISOString(), files: hashes }, null, 2) + '\n', { flag: 'wx' })
  const archive = join(output, release + '.tar.gz')
  const compressed = spawnSync('tar', ['-czf', archive, '-C', staging, '.'], { encoding: 'utf8' })
  if (compressed.error || compressed.status !== 0) throw new Error('Archive creation failed. The verified release directory remains available: ' + staging)
  const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex')
  writeFileSync(archive + '.sha256', checksum + '  ' + release + '.tar.gz\n', { flag: 'wx' })
  return { archive, directory: staging, sha256: checksum, fileCount: files.length + 2 }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(packageAgency(resolve(dirname(fileURLToPath(import.meta.url)), '..'), resolve('.releases')), null, 2)) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
