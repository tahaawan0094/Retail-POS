import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import electronPath from 'electron'

const testDirectory = mkdtempSync(join(tmpdir(), 'vertexia-retail-smoke-'))
mkdirSync(join(process.cwd(), '.screenshots'), { recursive:true })
const environment = { ...process.env, VERTEXIA_SMOKE_TEST:process.argv.includes('--licensing') ? 'licensing' : process.argv.includes('--branches') ? 'branches' : process.argv.includes('--reports') ? 'reports' : process.argv.includes('--accounts') ? 'accounts' : process.argv.includes('--recovery') ? 'recovery' : process.argv.includes('--auth') ? 'auth' : process.argv.includes('--pos') ? 'pos' : process.argv.includes('--products') ? 'products' : process.argv.includes('--dashboard') ? 'dashboard' : 'retail',VERTEXIA_SMOKE_USER_DATA:testDirectory,VERTEXIA_SMOKE_SCREENSHOT:join(process.cwd(),'.screenshots',process.argv.includes('--licensing') ? 'licensing.png' : process.argv.includes('--branches') ? 'branches-transfers.png' : process.argv.includes('--reports') ? 'reports-valuation.png' : process.argv.includes('--accounts') ? 'customer-expenses.png' : process.argv.includes('--recovery') ? 'backup-restore.png' : process.argv.includes('--auth') ? 'auth-staff.png' : 'retail-purchases.png') }
delete environment.ELECTRON_RUN_AS_NODE
delete environment.VITE_DEV_SERVER_URL
let code = 1
try {
  code = await new Promise((resolveExit, reject) => {
    const child = spawn(electronPath, ['.'], { env:environment, stdio:'inherit' })
    child.on('error', reject)
    child.on('close', status => resolveExit(status ?? 1))
  })
} finally {
  // Delete only the exact temporary test directory created above.
  const target = resolve(testDirectory)
  if (dirname(target) === resolve(tmpdir()) && basename(target).startsWith('vertexia-retail-smoke-')) {
    rmSync(target, { recursive:true, force:true })
  } else {
    console.error('Unsafe smoke-test cleanup target; temporary files preserved.')
    code = 1
  }
}
process.exitCode = code
