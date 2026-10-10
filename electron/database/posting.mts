import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

// The result and every business effect belong to the same database transaction.
// Retrying a committed operation returns its original result, even after restart.
export function postOperation<T>(db: DatabaseSync, branchId: string, operationId: string | undefined, kind: string, request: unknown, occurredAt: string, work: () => T): T {
  const id = operationId === undefined ? randomUUID() : operationId
  if (typeof id !== 'string' || id.length < 8 || id.length > 100 || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid operation identifier.')
  const hash = createHash('sha256').update(canonical(request)).digest('hex')
  db.exec('BEGIN IMMEDIATE')
  try {
    const existing = db.prepare('SELECT kind,request_hash,result_json FROM operation_results WHERE branch_id=? AND operation_id=?').get(branchId, id)
    if (existing) {
      if (existing.kind !== kind || existing.request_hash !== hash) throw new Error('This operation identifier was already used for a different request.')
      const result = JSON.parse(String(existing.result_json)) as T
      db.exec('COMMIT')
      return result
    }
    const result = work()
    db.prepare('INSERT INTO operation_results(branch_id,operation_id,kind,request_hash,result_json,occurred_at) VALUES (?,?,?,?,?,?)').run(branchId, id, kind, hash, JSON.stringify(result), occurredAt)
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

// Keep existing human-readable formats, but never derive numbers from row counts.
export function nextDocumentNumber(db: DatabaseSync, branchId: string, kind: 'sale' | 'return' | 'purchase', date: string): string {
  const prefix = { sale: 'SAL', return: 'RET', purchase: 'PUR' }[kind]
  const table = { sale: 'sales', return: 'sale_returns', purchase: 'purchases' }[kind]
  const column = { sale: 'invoice_number', return: 'return_number', purchase: 'purchase_number' }[kind]
  const start = `${prefix}-${date.replaceAll('-', '')}-`
  const maximum = Number(db.prepare(`SELECT COALESCE(MAX(CAST(substr(${column},14) AS INTEGER)),0) AS value FROM ${table} WHERE branch_id=? AND ${column} LIKE ?`).get(branchId, `${start}%`)!.value)
  db.prepare('INSERT OR IGNORE INTO document_sequences(branch_id,kind,business_date,last_value) VALUES (?,?,?,?)').run(branchId, kind, date, maximum)
  const row = db.prepare('UPDATE document_sequences SET last_value=MAX(last_value,?)+1 WHERE branch_id=? AND kind=? AND business_date=? RETURNING last_value').get(maximum, branchId, kind, date)!
  return `${start}${String(row.last_value).padStart(4, '0')}`
}

export function requireSafeInteger(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`${label} must be a safe integer${minimum > 0 ? ' greater than zero' : ' at least zero'}.`)
  return value
}

export function requireText(value: unknown, label: string, maximum: number, allowEmpty = false): string {
  if (typeof value !== 'string') throw new Error(`${label} is required.`)
  const text = value.trim()
  if ((!allowEmpty && !text) || text.length > maximum) throw new Error(`${label} must contain ${allowEmpty ? 'at most' : 'between 1 and'} ${maximum} characters.`)
  return text
}

export function requireBusinessDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a valid purchase date.')
  const date = new Date(`${value}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Enter a valid purchase date.')
  return value
}
