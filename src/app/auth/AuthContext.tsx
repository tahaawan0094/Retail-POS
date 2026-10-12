import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AuthSession, AuthStatus, BusinessSetupInput } from '../../types/auth'
import { canAccessPage } from '../../shared/auth-policy'
import './auth.css'

import { AuthContext, type AuthValue } from './auth.context'

function PasswordChange({ session, acceptSession }: { session: AuthSession; acceptSession: (session: AuthSession) => void }) {
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [confirm, setConfirm] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  return <form className="auth-card" onSubmit={async event => {
    event.preventDefault(); if (busy) return
    if (next !== confirm) { setError('New passwords do not match.'); return }
    setBusy(true); setError('')
    try { acceptSession(await window.vertexia!.auth.changePassword(current, next)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Password could not be changed.') }
    finally { setBusy(false) }
  }}><span className="auth-eyebrow">{session.businessName}</span><h1>Set your own password</h1><p>{session.name}, change your temporary password to continue.</p><fieldset disabled={busy}><label>Temporary password<input name="currentPassword" type="password" autoComplete="current-password" required value={current} onChange={event => setCurrent(event.target.value)} /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={next} onChange={event => setNext(event.target.value)} /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)} /></label><small>Use 12–128 characters. A long passphrase works well.</small>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-primary">{busy ? 'Updating…' : 'Save password and continue'}</button><button type="button" onClick={() => void window.vertexia!.auth.logout().then(() => window.dispatchEvent(new Event('vertexia:auth-refresh')))}>Sign out</button></fieldset></form>
}
function EntryForm({ status, acceptSession }: { status: AuthStatus; acceptSession: (session: AuthSession) => void }) {
  const [form, setForm] = useState<BusinessSetupInput>({ businessName: '', branchName: 'Main Branch', city: 'Karachi', ownerName: '', username: '', password: '' })
  const [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const setup = status.needsSetup
  const field = (key: keyof BusinessSetupInput, label: string, type = 'text') => <label key={key}>{label}<input name={key} type={type} autoComplete={key === 'username' ? 'username' : key === 'password' ? setup ? 'new-password' : 'current-password' : 'off'} required maxLength={key === 'password' ? 128 : key === 'username' ? 64 : 120} minLength={key === 'password' && setup ? 12 : undefined} value={form[key]} onChange={event => setForm(value => ({ ...value, [key]: event.target.value }))} /></label>
  return <form className="auth-card" onSubmit={async event => {
    event.preventDefault(); if (busy) return
    if (setup && form.password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    try { acceptSession(setup ? await window.vertexia!.auth.setup(form) : await window.vertexia!.auth.login(form.username, form.password)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.') }
    finally { setBusy(false) }
  }}><span className="auth-eyebrow">Vertexia Retail POS</span><h1>{setup ? 'Set up your business' : 'Sign in'}</h1><p>{setup ? 'Create the owner account for this installation. Existing sales and stock will be kept.' : status.businessName + ' · Works offline'}</p><fieldset disabled={busy}>{status.notice && <p role="status">{status.notice}</p>}{setup && <div className="auth-grid">{field('businessName', 'Business name')}{field('branchName', 'Branch name')}{field('city', 'City')}{field('ownerName', 'Owner name')}</div>}{field('username', setup ? 'Owner username' : 'Username')}{field('password', 'Password', 'password')}{setup && <>{<label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)} /></label>}<small>Use 12–128 characters. Keep this owner password safe.</small></>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-primary" type="submit">{busy ? 'Please wait…' : setup ? 'Create business and owner account' : 'Sign in'}</button></fieldset></form>
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null), [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!window.vertexia?.auth) { setError('Start the desktop app with npm run dev:desktop to connect to your local database.'); return }
    try { setStatus(await window.vertexia.auth.status()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load sign in.') }
  }, [])
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 30000)
    const expire = () => { setStatus(value => value ? { ...value, session: null } : value); void refresh() }
    const unsubscribe = window.vertexia?.auth?.onSessionExpired(expire)
    const focus = () => void refresh()
    window.addEventListener('focus', focus); window.addEventListener('vertexia:auth-refresh', focus)
    return () => { window.clearTimeout(initial); window.clearInterval(timer); unsubscribe?.(); window.removeEventListener('focus', focus); window.removeEventListener('vertexia:auth-refresh', focus) }
  }, [refresh])
  const acceptSession = (session: AuthSession) => setStatus(value => ({ needsSetup: false, businessName: value?.businessName === session.businessName ? value.businessName : session.businessName, session }))
  const session = status?.session ?? null
  const value: AuthValue = { session, can: permission => Boolean(session?.permissions.includes(permission)), canPage: page => canAccessPage(page, session?.permissions ?? []), acceptSession,
    logout: async () => { await window.vertexia!.auth.logout(); setStatus(current => current ? { ...current, session: null } : current) },
    selectBranch: async id => acceptSession(await window.vertexia!.auth.selectBranch(id)),
  }
  return <AuthContext.Provider value={value}>{!status || !session || session.mustChangePassword ? <main className="auth-screen">{!status ? <section className="auth-card"><h1>Vertexia Retail POS</h1><p role={error ? 'alert' : 'status'}>{error || 'Loading your local business…'}</p>{error && <button onClick={() => void refresh()}>Retry</button>}</section> : session?.mustChangePassword ? <PasswordChange key={session.userId} session={session} acceptSession={acceptSession} /> : <EntryForm key={String(status.needsSetup)} status={status} acceptSession={acceptSession} />}</main> : children}</AuthContext.Provider>
}
