import chokidar, { type FSWatcher } from 'chokidar'

let activeWatcher: FSWatcher | null = null

export function watchWorkspace(rootPath: string, onChange: () => void): void {
  stopWatching()

  let debounceTimer: NodeJS.Timeout | null = null
  const debouncedChange = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(onChange, 150)
  }

  activeWatcher = chokidar.watch(rootPath, {
    ignoreInitial: true,
    ignored: (path: string) => path.split(/[\\/]/).some((segment) => segment.startsWith('.'))
  })

  activeWatcher
    .on('add', debouncedChange)
    .on('unlink', debouncedChange)
    .on('addDir', debouncedChange)
    .on('unlinkDir', debouncedChange)
    .on('change', debouncedChange)
}

export function stopWatching(): void {
  if (activeWatcher) {
    activeWatcher.close()
    activeWatcher = null
  }
}
