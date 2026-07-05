import { createHmac } from 'node:crypto'
import type { Auth } from '@schema/request'

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function signJwtHs256(secret: string, payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signature = createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export interface AppliedAuth {
  headers: Record<string, string>
  queryParams: Record<string, string>
}

export function resolveAuth(auth: Auth | undefined): AppliedAuth {
  const headers: Record<string, string> = {}
  const queryParams: Record<string, string> = {}

  if (!auth || auth.type === 'none') return { headers, queryParams }

  switch (auth.type) {
    case 'basic': {
      const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
      headers.Authorization = `Basic ${token}`
      break
    }
    case 'bearer': {
      headers.Authorization = `Bearer ${auth.token}`
      break
    }
    case 'apiKey': {
      if (auth.in === 'header') headers[auth.key] = auth.value
      else queryParams[auth.key] = auth.value
      break
    }
    case 'jwt': {
      const token = signJwtHs256(auth.secret, auth.payload ?? {})
      headers.Authorization = `Bearer ${token}`
      break
    }
  }

  return { headers, queryParams }
}
