export const RETAIL_DATA_CHANGED = 'vertexia:retail-data-changed'

export function notifyRetailDataChanged() {
  window.dispatchEvent(new Event(RETAIL_DATA_CHANGED))
}
