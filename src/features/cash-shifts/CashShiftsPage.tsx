import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../app/auth/useAuth'
import { useOperationIdentity } from '../../shared/hooks/useOperationIdentity'
import { PageShell, type PageProps } from '../../shared/layout/PageShell'
import { Icon } from '../../shared/ui/Icon'
import type { CashSnapshot } from '../../types/recovery'
import '../../styles/recovery.css'

const money = (value: number) => 'Rs ' + (value / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function amount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a positive amount with at most two decimal places.')
  const result = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(result)) throw new Error('Amount is too large.')
  return result
}
export default function CashShiftsPage(props: PageProps) {
  const { session, can } = useAuth()
  const branchId = session!.branchId
  const [data, setData] = useState<CashSnapshot | null>(null)
  const [opening, setOpening] = useState('0'), [counted, setCounted] = useState(''), [note, setNote] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>('out'), [moveAmount, setMoveAmount] = useState(''), [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const openOperation = useOperationIdentity('shift-open'), closeOperation = useOperationIdentity('shift-close'), moveOperation = useOperationIdentity('cash-move')
  const refresh = useCallback(async () => { setData(await window.vertexia!.cash.getSnapshot(branchId)) }, [branchId])
  useEffect(() => {
    const load = () => { void refresh().catch(cause => setError(String(cause.message ?? cause))) }
    const timer = window.setTimeout(load, 0)
    window.addEventListener('vertexia:retail-data-changed', load)
    window.addEventListener('focus', load)
    return () => { window.clearTimeout(timer); window.removeEventListener('vertexia:retail-data-changed', load); window.removeEventListener('focus', load) }
  }, [refresh])
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await action(); await refresh(); window.dispatchEvent(new Event('vertexia:retail-data-changed')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Cash operation failed.') }
    finally { setBusy(false) }
  }
  const shift = data?.activeShift
  const variance = counted !== '' && /^\d+(\.\d{1,2})?$/.test(counted) ? Math.round(Number(counted) * 100) - (shift?.expectedCashPaisa ?? 0) : null
  return <PageShell {...props} activePage="Cash & Shifts" className="cash-shifts-page" header={menu => <header className="recovery-header"><button aria-label="Toggle sidebar" onClick={menu}><Icon name="menu" /></button><h1>Cash & Shifts</h1><button disabled={busy} onClick={() => void run(refresh)}>Refresh</button></header>}>
    <main className="recovery-content"><p>Open a drawer, record cash movements, then count the cash to close the shift. {session!.role === 'Cashier' && 'You can view and close your own shifts.'}</p>
      {error && <p className="recovery-error" role="alert">{error}</p>}{notice && <p className="recovery-notice" role="status">{notice}</p>}
      {!data ? <p>Loading cash records...</p> : <>
        <div className="recovery-stats"><section><small>Shift status</small><strong>{shift ? 'Open' : 'Closed'}</strong><span>{shift?.cashierName ?? 'No open shift available'}</span></section><section><small>Opening cash</small><strong>{money(shift?.openingCashPaisa ?? 0)}</strong></section><section><small>Expected drawer cash</small><strong>{money(shift?.expectedCashPaisa ?? 0)}</strong><span>All transactions in this shift, including earlier dates</span></section></div>
        <div className="recovery-columns">
          <section className="recovery-card">{!shift ? <><h2>Open shift</h2><form onSubmit={event => { event.preventDefault(); void run(async () => { const value = amount(opening); const request = { branchId, openingCashPaisa: value }; await window.vertexia!.pos.openShift(branchId, value, openOperation.idFor(request)); openOperation.reset(); setNotice('Shift opened. You can now record cash sales.') }) }}><fieldset disabled={busy}><label>Opening cash (Rs)<input name="openingCash" inputMode="decimal" required value={opening} onChange={event => setOpening(event.target.value)} /></label><button type="submit" className="recovery-primary">Open shift</button></fieldset></form></> : <><h2>Close shift</h2><p>Opened {new Date(shift.openedAt).toLocaleString()}. Closing saves the counted amount and any shortage or excess.</p><form onSubmit={event => { event.preventDefault(); void run(async () => { const request = { branchId, shiftId: shift.id, countedCashPaisa: amount(counted), note }; const result = await window.vertexia!.cash.closeShift({ ...request, operationId: closeOperation.idFor(request) }); closeOperation.reset(); setCounted(''); setNote(''); setNotice('Shift closed. Cash difference: ' + money(result.variancePaisa ?? 0)) }) }}><fieldset disabled={busy}><label>Counted cash (Rs)<input name="countedCash" required inputMode="decimal" value={counted} onChange={event => setCounted(event.target.value)} /></label>{variance !== null && <p>Difference: <strong className={variance ? 'recovery-difference' : ''}>{money(variance)}</strong></p>}<label>Closing note {variance ? '(required for a difference)' : '(optional)'}<textarea name="closingNote" maxLength={500} required={Boolean(variance)} minLength={variance ? 3 : undefined} value={note} onChange={event => setNote(event.target.value)} /></label><button type="submit" className="recovery-primary">Close shift</button></fieldset></form></>}</section>
          {can('cash.manage') && <section className="recovery-card"><h2>Cash in / cash out</h2><p>Use for drawer transfers. Record business expenses separately when the Expenses module is available.</p><form onSubmit={event => { event.preventDefault(); if (!shift) return; void run(async () => { const request = { branchId, shiftId: shift.id, direction, amountPaisa: amount(moveAmount), reason }; await window.vertexia!.cash.move({ ...request, operationId: moveOperation.idFor(request) }); moveOperation.reset(); setMoveAmount(''); setReason(''); setNotice('Cash movement saved.') }) }}><fieldset disabled={busy || !shift}><label>Movement<select name="cashDirection" value={direction} onChange={event => setDirection(event.target.value as 'in' | 'out')}><option value="out">Cash out</option><option value="in">Cash in</option></select></label><label>Amount (Rs)<input name="moveAmount" required inputMode="decimal" value={moveAmount} onChange={event => setMoveAmount(event.target.value)} /></label><label>Reason<input name="moveReason" minLength={3} maxLength={250} required value={reason} onChange={event => setReason(event.target.value)} /></label><button type="submit">Save cash movement</button></fieldset></form></section>}
        </div>
        <section className="recovery-card"><h2>Shift history</h2><p>Latest 100 shifts. Older imported closings may have no recorded cash count.</p><div className="recovery-table"><table><thead><tr><th>Opened</th><th>Cashier</th><th>Status</th><th>Expected</th><th>Counted</th><th>Difference</th><th>Closing note / closed by</th></tr></thead><tbody>{data.shifts.map(row => <tr key={row.id}><td>{new Date(row.openedAt).toLocaleString()}</td><td>{row.cashierName}</td><td>{row.status}</td><td>{money(row.expectedCashPaisa)}</td><td>{row.countedCashPaisa === null ? '-' : money(row.countedCashPaisa)}</td><td className={row.variancePaisa ? 'recovery-difference' : ''}>{row.variancePaisa === null ? '-' : money(row.variancePaisa)}</td><td>{row.closingNote || '-'}{row.closedByName && <small>{row.closedByName}</small>}</td></tr>)}</tbody></table>{!data.shifts.length && <p>No shifts recorded.</p>}</div></section>
        <section className="recovery-card"><h2>Drawer transactions</h2><p>Latest {data.movements.length} of {data.movementCount} transactions for {shift ? 'the open' : 'your latest'} shift.</p><div className="recovery-table"><table><thead><tr><th>Time</th><th>Type</th><th>Direction</th><th>Amount</th><th>Reference / reason</th></tr></thead><tbody>{data.movements.map(row => <tr key={row.id}><td>{new Date(row.occurredAt).toLocaleString()}</td><td>{row.type.replaceAll('_', ' ')}</td><td>{row.direction}</td><td>{money(row.amountPaisa)}</td><td>{row.reference}<small>{row.note}</small></td></tr>)}</tbody></table></div></section>
      </>}
    </main>
  </PageShell>
}
