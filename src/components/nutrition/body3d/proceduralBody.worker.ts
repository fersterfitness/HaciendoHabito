/// <reference lib="webworker" />
import { buildProceduralBodyData } from './proceduralBody'
import type { BodySex } from './types'

self.onmessage = (e: MessageEvent<BodySex>) => {
  const data = buildProceduralBodyData(e.data)
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(data, [data.positions.buffer, data.normals.buffer, data.index.buffer, data.zones.buffer])
}
