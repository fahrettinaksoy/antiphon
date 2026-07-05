import { readdir, readFile, rm, mkdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import yaml from 'js-yaml'
import { EnvironmentFileSchema, SCHEMA_VERSION, type EnvironmentFile } from '@schema/request'
import { atomicWriteFile, slugify, pathExists } from './workspace-service'

export const ENVIRONMENT_EXTENSION = '.env.yaml'
export const ENVIRONMENTS_DIR = 'environments'

export interface EnvironmentSummary {
  name: string
  path: string
}

function environmentsDir(rootPath: string): string {
  return join(rootPath, ENVIRONMENTS_DIR)
}

export async function listEnvironments(rootPath: string): Promise<EnvironmentSummary[]> {
  const dir = environmentsDir(rootPath)
  if (!(await pathExists(dir))) return []

  const entries = await readdir(dir, { withFileTypes: true })
  const summaries: EnvironmentSummary[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(ENVIRONMENT_EXTENSION)) continue
    const path = join(dir, entry.name)
    try {
      const data = await readEnvironment(path)
      summaries.push({ name: data.name, path })
    } catch {
      summaries.push({ name: basename(entry.name, ENVIRONMENT_EXTENSION), path })
    }
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name))
}

export async function readEnvironment(filePath: string): Promise<EnvironmentFile> {
  const raw = await readFile(filePath, 'utf8')
  return EnvironmentFileSchema.parse(yaml.load(raw))
}

export async function writeEnvironment(filePath: string, data: EnvironmentFile): Promise<void> {
  const validated = EnvironmentFileSchema.parse(data)
  const content = yaml.dump(validated, { indent: 2, lineWidth: 100, noRefs: true })
  await atomicWriteFile(filePath, content)
}

export async function createEnvironment(rootPath: string, name: string): Promise<EnvironmentSummary> {
  const dir = environmentsDir(rootPath)
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, `${slugify(name)}${ENVIRONMENT_EXTENSION}`)
  const initial: EnvironmentFile = { schema: SCHEMA_VERSION, name, variables: {} }
  await writeEnvironment(filePath, initial)
  return { name, path: filePath }
}

export async function deleteEnvironment(filePath: string): Promise<void> {
  await rm(filePath, { force: true })
}
