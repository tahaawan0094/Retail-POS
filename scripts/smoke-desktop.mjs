process.env.VERTEXIA_SMOKE_TEST = process.argv.includes('--pos') ? 'pos' : process.argv.includes('--products') ? 'products' : 'dashboard'
await import('./dev-desktop.mjs')
