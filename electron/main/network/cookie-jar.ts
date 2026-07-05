import { CookieJar } from 'tough-cookie'

let jar: CookieJar | null = null

export function getCookieJar(): CookieJar {
  if (!jar) jar = new CookieJar()
  return jar
}

export interface CookieSummary {
  domain: string
  path: string
  key: string
  value: string
  expires: string
}

export async function listCookies(): Promise<CookieSummary[]> {
  const serialized = await getCookieJar().serialize()
  return serialized.cookies.map((cookie) => ({
    domain: cookie.domain ? String(cookie.domain) : '',
    path: cookie.path ? String(cookie.path) : '/',
    key: cookie.key ? String(cookie.key) : '',
    value: cookie.value ? String(cookie.value) : '',
    expires: typeof cookie.expires === 'string' ? cookie.expires : 'Session'
  }))
}

export async function clearCookies(): Promise<void> {
  await getCookieJar().removeAllCookies()
}
