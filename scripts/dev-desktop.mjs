import { spawn } from 'node:child_process'
import electronPath from 'electron'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5173, strictPort: false } })
await server.listen()

const developmentUrl = server.resolvedUrls?.local[0]?.replace(/\/$/,'')
if (!developmentUrl) throw new Error('Vite did not provide a development URL.')
const environment = { ...process.env, VITE_DEV_SERVER_URL: developmentUrl }
delete environment.ELECTRON_RUN_AS_NODE

const electron = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: environment,
})

const shutdown = async (exitCode = 0) => {
  await server.close()
  process.exit(exitCode)
}

electron.on('exit', code => void shutdown(code ?? 0))
process.on('SIGINT', () => electron.kill('SIGINT'))
process.on('SIGTERM', () => electron.kill('SIGTERM'))
