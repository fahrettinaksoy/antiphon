/// <reference types="vite/client" />

import type { AntiphonApi } from '@shared/ipc-contract'

declare global {
  interface Window {
    antiphon: AntiphonApi
  }
}

export {}
