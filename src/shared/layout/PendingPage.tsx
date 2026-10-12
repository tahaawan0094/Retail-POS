import { PageShell, type PageProps } from './PageShell'
import { Icon } from '../ui/Icon'
import '../../styles/recovery.css'

export function PendingPage(props: PageProps & { activePage: string }) {
  return <PageShell {...props} header={menu => <header className="recovery-header"><button aria-label="Toggle sidebar" onClick={menu}><Icon name="menu" /></button><h1>{props.activePage}</h1></header>}><main className="recovery-content"><section className="recovery-card"><h2>Coming in a later milestone</h2><p>This module is planned and is not ready for business use yet.</p><button onClick={() => props.onNavigate('Dashboard')}>Back to dashboard</button></section></main></PageShell>
}
