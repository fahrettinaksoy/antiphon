import { randomInt, randomUUID } from 'node:crypto'

export const templateFunctions: Record<string, () => string> = {
  uuid: () => randomUUID(),
  guid: () => randomUUID(),
  timestamp: () => String(Date.now()),
  isoTimestamp: () => new Date().toISOString(),
  randomInt: () => String(randomInt(0, 1000))
}
