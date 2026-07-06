// window.antiphon'un IPC-güvenli sarmalayıcısı.
//
// Vue'nun reactive Proxy nesneleri contextBridge/structured-clone sınırından geçemez
// ("An object could not be cloned") — kaydetme, istek gönderme gibi nesne taşıyan tüm
// çağrılar sessizce başarısız olur. Renderer'daki TÜM IPC çağrıları bu modül üzerinden
// yapılır; nesne/dizi argümanları sınırı geçmeden düz (plain) veriye indirgenir,
// fonksiyon argümanları (event callback'leri) aynen geçer.
import type { AntiphonApi } from '@shared/ipc-contract'

function toPlain(value: unknown): unknown {
  return value !== null && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value
}

export const ipc: AntiphonApi = new Proxy({} as AntiphonApi, {
  get(_target, prop: string) {
    const member = (window.antiphon as unknown as Record<string, unknown>)[prop]
    if (typeof member !== 'function') return member
    return (...args: unknown[]) =>
      (member as (...fnArgs: unknown[]) => unknown)(
        ...args.map((arg) => (typeof arg === 'function' ? arg : toPlain(arg)))
      )
  }
})
