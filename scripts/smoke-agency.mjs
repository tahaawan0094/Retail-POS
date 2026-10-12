import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import electron from 'electron'
const directory = mkdtempSync(join(tmpdir(), 'vertexia-agency-smoke-'))
mkdirSync(join(process.cwd(), '.screenshots'), { recursive: true })
const environment = { ...process.env, VERTEXIA_AGENCY_SMOKE_DATA: directory }
delete environment.ELECTRON_RUN_AS_NODE; delete environment.VITE_DEV_SERVER_URL
try {
  process.exitCode = await new Promise((resolveExit, reject) => { const child = spawn(electron, [process.argv.includes('--local-setup') ? 'scripts/local-agency-desktop-smoke.mjs' : 'scripts/agency-desktop-smoke.mjs'], { env: environment, stdio: 'inherit' }); child.on('error', reject); child.on('exit', code => resolveExit(code ?? 1)) })
} finally {
  const target = resolve(directory)
  if (dirname(target) === resolve(tmpdir()) && basename(target).startsWith('vertexia-agency-smoke-')) rmSync(target, { recursive: true, force: true })
  else { console.error('Unsafe agency test cleanup target; test directory preserved.'); process.exitCode = 1 }
}
