// Explicit allowlist: new IPC endpoints stay locked until classified here.
const availableWhenLocked = new Set([
  'branches:list', 'transfers:list', 'transfers:detail', 'reports:snapshot', 'reports:export-csv', 'reports:valuation',
  'customers:list', 'customers:detail', 'customers:receipt', 'expenses:list', 'cash:get-snapshot', 'cash:close-shift',
  'backup:get-status', 'backup:create', 'backup:export', 'backup:preview', 'backup:cancel', 'backup:restore',
  'retail:get-snapshot', 'dashboard:get-snapshot', 'dashboard:search', 'system:get-database-path', 'pos:get-bootstrap',
  'products:list', 'products:export-csv', 'sales:get-snapshot', 'sales:get-detail', 'sales:export-csv',
  'auth:status', 'auth:setup', 'auth:login', 'auth:logout', 'auth:select-branch', 'auth:list-users', 'auth:change-password',
  'licensing:status', 'licensing:activate', 'licensing:refresh',
])
// Closing an existing drawer records reconciliation; opening or moving cash stays locked.
export function requiresTransactionLicense(channel: string) { return !availableWhenLocked.has(channel) }
