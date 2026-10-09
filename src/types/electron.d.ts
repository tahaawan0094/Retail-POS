import type { VertexiaDesktopApi } from './desktop-api'

declare global {
  interface Window {
    vertexia?: VertexiaDesktopApi
  }
}

export {}
