// All smoke targets use isolated temporary app data and a production build.
if (!process.argv.includes('--pos') && !process.argv.includes('--products')) process.argv.push('--dashboard')
await import('./smoke-retail.mjs')
