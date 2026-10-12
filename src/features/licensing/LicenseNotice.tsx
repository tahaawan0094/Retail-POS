import { useAuth } from '../../app/auth/useAuth'
import { useLicenseStatus } from './useLicenseStatus'
import './licensing.css'

export function LicenseNotice({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { status, error } = useLicenseStatus(), { can } = useAuth()
  if (!error && (!status || status.state === 'active')) return null
  return <div className="license-notice" role="status"><span>{error || status!.message} {status && !status.canTransact && 'Records and backups remain available.'}</span>{can('settings.manage') && <button onClick={() => onNavigate('License')}>Open license</button>}</div>
}
