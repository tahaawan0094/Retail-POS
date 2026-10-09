import { spawn } from 'node:child_process'
import electronPath from 'electron'

const environment = { ...process.env }
delete environment.ELECTRON_RUN_AS_NODE

const electron = spawn(electronPath, ['.'], { stdio:'inherit',env:environment })
electron.on('exit', code => process.exit(code ?? 0))
