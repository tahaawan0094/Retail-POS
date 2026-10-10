import { useRetailData } from '../../app/data/useRetailData'
import './retail-data-status.css'

function downloadLegacyArchive() {
  const raw = window.localStorage.getItem('vertexia.product-inventory.v1')
  if (!raw) return
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = 'vertexia-legacy-retail-data.json'; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function RetailDataStatus() {
  const { loading, error, refresh, legacyDataAvailable } = useRetailData()
  return <>
    {loading && <div className="retail-data-status" role="status">Loading shop records…</div>}
    {error && <div className="retail-data-status error" role="alert">{error}<button onClick={() => void refresh()}>Retry</button></div>}
    {legacyDataAvailable && <div className="retail-data-status legacy" role="status"><span>Older browser records are preserved separately. These screens now use the shop database. Download the older records before arranging an import.</span><button onClick={downloadLegacyArchive}>Download older records</button></div>}
  </>
}
