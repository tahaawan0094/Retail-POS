import type { Permission } from '../src/types/auth.js'
import { createHash } from 'node:crypto'
import type { AuthRepository } from './database/auth.mjs'
import type { VertexiaDatabase } from './database/database.mjs'

const permissions: Record<string, Permission> = {
  'licensing:activate': 'settings.manage', 'licensing:refresh': 'settings.manage',
  'branches:list': 'branches.manage', 'branches:create': 'branches.manage', 'branches:update': 'branches.manage', 'branches:set-active': 'branches.manage',
  'transfers:list': 'transfers.read', 'transfers:detail': 'transfers.read', 'transfers:dispatch': 'transfers.dispatch', 'transfers:receive': 'transfers.receive', 'transfers:cancel': 'transfers.cancel',
  'reports:snapshot': 'reports.read', 'reports:export-csv': 'reports.read', 'reports:valuation': 'retail.read',
  'customers:list': 'customers.read', 'customers:detail': 'customers.read', 'customers:receipt': 'customers.read', 'customers:create': 'customers.create', 'customers:update': 'customers.manage', 'customers:collect': 'customers.collect',
  'expenses:list': 'expenses.read', 'expenses:post': 'expenses.manage', 'expenses:reverse': 'expenses.manage',
  'cash:get-snapshot': 'shifts.read', 'cash:close-shift': 'shifts.close', 'cash:move': 'cash.manage',
  'backup:get-status': 'backup.manage', 'backup:create': 'backup.manage', 'backup:export': 'backup.manage', 'backup:preview': 'backup.manage', 'backup:cancel': 'backup.manage', 'backup:restore': 'backup.manage',
  'retail:get-snapshot': 'retail.read', 'retail:adjust-stock': 'stock.adjust', 'retail:receive-purchase': 'purchases.receive', 'retail:pay-supplier': 'suppliers.pay',
  'dashboard:get-snapshot': 'dashboard.read', 'dashboard:search': 'dashboard.read', 'system:get-database-path': 'settings.manage',
  'pos:get-bootstrap': 'pos.sell', 'pos:complete-sale': 'pos.sell', 'pos:hold-sale': 'pos.sell', 'pos:resume-held-sale': 'pos.sell', 'pos:delete-held-sale': 'pos.sell', 'pos:open-shift': 'shifts.open', 'pos:create-product': 'products.manage', 'pos:create-customer': 'customers.create',
  'products:list': 'products.read', 'products:save': 'products.manage', 'products:toggle-status': 'products.manage', 'products:import-csv': 'products.manage', 'products:export-csv': 'data.export',
  'sales:get-snapshot': 'sales.read', 'sales:get-detail': 'sales.read', 'sales:create-return': 'sales.return', 'sales:export-csv': 'data.export',
  'auth:list-users': 'users.manage', 'auth:create-user': 'users.manage', 'auth:update-user': 'users.manage', 'auth:reset-password': 'users.manage',
}
const requestBranches = new Set(['branches:create', 'branches:update', 'branches:set-active', 'transfers:list', 'transfers:dispatch', 'transfers:receive', 'transfers:cancel', 'reports:snapshot', 'reports:export-csv', 'customers:list', 'customers:create', 'customers:update', 'customers:collect', 'expenses:list', 'expenses:post', 'expenses:reverse', 'cash:close-shift', 'cash:move', 'retail:adjust-stock', 'retail:receive-purchase', 'retail:pay-supplier', 'dashboard:get-snapshot', 'pos:complete-sale', 'products:list', 'sales:get-snapshot', 'sales:create-return', 'sales:export-csv'])
const idBranches = new Set(['transfers:detail', 'reports:valuation', 'customers:detail', 'customers:receipt', 'cash:get-snapshot', 'retail:get-snapshot', 'pos:get-bootstrap', 'pos:hold-sale', 'pos:open-shift', 'pos:create-product', 'products:save', 'products:toggle-status', 'products:import-csv', 'products:export-csv', 'sales:get-detail', 'auth:select-branch'])
const publicChannels = new Set(['auth:status', 'auth:setup', 'auth:login', 'auth:logout'])
// Licensing follows the actual posting scope as well as the current branch. Renderer arguments
// cannot select an unlocked branch to post into a locked destination or resume its held cart.
export function licenseBranches(database: VertexiaDatabase, channel: string, args: unknown[], current?: string) {
  const ids = new Set<string>(current ? [current] : [])
  const input = args[0] as Record<string, unknown> | undefined
  if (requestBranches.has(channel) && input && typeof input.branchId === 'string') ids.add(input.branchId)
  if (idBranches.has(channel) && typeof args[0] === 'string') ids.add(args[0])
  if (['branches:update', 'branches:set-active'].includes(channel) && typeof input?.targetBranchId === 'string') ids.add(input.targetBranchId)
  if (channel === 'transfers:dispatch' && typeof input?.destinationBranchId === 'string') ids.add(input.destinationBranchId)
  if (['pos:resume-held-sale', 'pos:delete-held-sale'].includes(channel) && typeof args[0] === 'string') {
    const held = database.connection.prepare('SELECT branch_id FROM held_sales WHERE id=?').get(args[0])
    if (held) ids.add(String(held.branch_id))
  }
  return [...ids]
}
export function authorizeIpc(auth: AuthRepository, database: VertexiaDatabase, channel: string, args: unknown[]) {
  if (publicChannels.has(channel)) return
  if (!permissions[channel] && !['auth:change-password', 'auth:select-branch', 'licensing:status'].includes(channel)) throw new Error('Unsupported desktop operation.')
  let branchId: unknown
  if (requestBranches.has(channel)) {
    const request = args[0]
    if (!request || typeof request !== 'object' || !('branchId' in request)) throw new Error('A valid branch request is required.')
    branchId = request.branchId
  } else if (idBranches.has(channel)) branchId = args[0]
  else if (channel === 'dashboard:search') branchId = args[1]
  if (requestBranches.has(channel) || idBranches.has(channel) || channel === 'dashboard:search') {
    if (typeof branchId !== 'string' || !branchId) throw new Error('A branch is required.')
  }
  const session = auth.require(permissions[channel], branchId, channel === 'auth:change-password', channel !== 'licensing:status')
  if (channel === 'branches:set-active' && !(args[0] as {isActive?:unknown}).isActive && (args[0] as {targetBranchId?:unknown}).targetBranchId === session.branchId) throw new Error('Switch to another branch before archiving the current branch.')
  if (channel === 'transfers:dispatch') auth.require('transfers.dispatch',(args[0] as {destinationBranchId?:unknown}).destinationBranchId ?? '')
  if (channel === 'customers:create' && (args[0] as { openingBalancePaisa?: unknown }).openingBalancePaisa !== 0) auth.require('customers.manage', branchId)
  if (channel === 'customers:collect' && (args[0] as { method?: unknown }).method === 'Cash' && !session.permissions.includes('cash.manage')) {
    const shift = database.connection.prepare("SELECT cashier_id FROM cash_shifts WHERE branch_id=? AND status='open'").get(branchId as string)
    if (shift && shift.cashier_id !== session.userId) throw new Error('You can only receive cash into your own open shift.')
  }
  if (channel === 'cash:close-shift' && !session.permissions.includes('cash.manage')) {
    const request = args[0] as { shiftId?: unknown }
    if (typeof request.shiftId !== 'string') throw new Error('Invalid cash shift.')
    const shift = database.connection.prepare('SELECT cashier_id FROM cash_shifts WHERE id=? AND branch_id=?').get(request.shiftId, branchId as string)
    if (!shift || shift.cashier_id !== session.userId) throw new Error('You can only close your own cash shift.')
  }
  if (channel === 'pos:complete-sale' && !session.permissions.includes('cash.manage')) {
    const shift = database.connection.prepare("SELECT cashier_id FROM cash_shifts WHERE branch_id=? AND status='open'").get(branchId as string)
    if (shift && shift.cashier_id !== session.userId) throw new Error('Another cashier owns the open branch shift. Ask a manager to close it first.')
  }
  if (channel === 'retail:receive-purchase') {
    const request = args[0] as { paidAmountPaisa?: unknown }
    if (request.paidAmountPaisa !== 0) auth.require('suppliers.pay', branchId)
  }
  if (channel === 'pos:resume-held-sale' || channel === 'pos:delete-held-sale') {
    if (typeof args[0] !== 'string') throw new Error('Invalid held sale.')
    const held = database.connection.prepare('SELECT branch_id FROM held_sales WHERE id=?').get(args[0])
    if (!held) throw new Error('Held sale is unavailable.')
    auth.require('pos.sell', held.branch_id)
  }
  if (channel === 'pos:complete-sale' || channel === 'pos:hold-sale') {
    const request = args[0]
    const lines = channel === 'pos:hold-sale' ? args[2] : request && typeof request === 'object' && 'lines' in request ? request.lines : undefined
    if (!Array.isArray(lines)) throw new Error('Invalid sale lines.')
    if (lines.some(line => line && typeof line === 'object' && line.discountBasisPoints !== 0)) auth.require('pos.discount', branchId)
  }
  if (channel === 'reports:export-csv') auth.require('data.export',branchId)
  database.setActor(session.userId)
}

// Namespace retry IDs by the authenticated user; another staff member cannot replay their result.
export function scopeOperation(channel: string, args: unknown[], userId: string) {
  if (channel === 'pos:open-shift' && args[2] !== undefined) {
    if (typeof args[2] !== 'string' || !args[2].trim() || args[2].length > 100) throw new Error('Invalid operation identifier.')
    args[2] = 'op-' + createHash('sha256').update(JSON.stringify([userId, args[2]])).digest('hex')
    return
  }
  if (!['branches:create', 'branches:update', 'branches:set-active', 'transfers:dispatch', 'transfers:receive', 'transfers:cancel', 'customers:create', 'customers:update', 'customers:collect', 'expenses:post', 'expenses:reverse', 'pos:complete-sale', 'sales:create-return', 'retail:receive-purchase', 'retail:pay-supplier', 'retail:adjust-stock', 'cash:close-shift', 'cash:move'].includes(channel)) return
  const request = args[0]
  if (!request || typeof request !== 'object' || !('operationId' in request) || request.operationId === undefined) return
  if (typeof request.operationId !== 'string' || !request.operationId.trim() || request.operationId.length > 100) throw new Error('Invalid operation identifier.')
  request.operationId = 'op-' + createHash('sha256').update(JSON.stringify([userId, request.operationId])).digest('hex')
}
