export const is = {
  dev: !!process.env['ELECTRON_RENDERER_URL'] || process.env.NODE_ENV === 'development',
  mac: process.platform === 'darwin',
  windows: process.platform === 'win32',
  linux: process.platform === 'linux'
}
