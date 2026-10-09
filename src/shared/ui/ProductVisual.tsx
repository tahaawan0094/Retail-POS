import { ProductThumb } from './ProductThumb'

export function PosProductVisual({ kind }: { kind: string }) {
  if (['eggs', 'bananas', 'onion', 'tomato', 'potato'].includes(kind)) {
    const emoji: Record<string, string> = { eggs: '🥚', bananas: '🍌', onion: '🧅', tomato: '🍅', potato: '🥔' }
    return <span className={`fresh-product ${kind}`} aria-hidden="true">{kind === 'eggs' ? <><i>🥚</i><i>🥚</i><i>🥚</i><i>🥚</i><i>🥚</i><i>🥚</i></> : emoji[kind]}</span>
  }
  if (kind === 'colgate') return <span className="pack-art colgate-art"><b>Colgate</b><small>MAX FRESH</small></span>
  if (kind === 'lux') return <span className="pack-art lux-art"><b>LUX</b><small>soft touch</small></span>
  if (kind === 'tide') return <span className="pack-art tide-art"><b>Tide</b><small>ORIGINAL</small></span>
  return <span className="pos-packaged"><ProductThumb kind={kind} /></span>
}

