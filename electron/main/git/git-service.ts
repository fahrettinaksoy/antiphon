import * as fs from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import { createTwoFilesPatch } from 'diff'

export interface GitFileStatus {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'untracked' | 'unmodified'
  staged: boolean
}

export interface GitCommitSummary {
  oid: string
  message: string
  author: string
  timestamp: number
}

export interface GitStatusSummary {
  branch: string | null
  files: GitFileStatus[]
  ahead: number
  behind: number
}

// isomorphic-git's per-file `status()` strings: a leading `*` means the change is unstaged
// (workdir differs from the index); no prefix means the index already matches the change (staged).
// "*added" specifically is an untracked new file (present in workdir, absent from HEAD and index).
function toFriendlyStatus(raw: string): { status: GitFileStatus['status']; staged: boolean } {
  const staged = raw !== 'unmodified' && !raw.startsWith('*')
  if (raw === '*added') return { status: 'untracked', staged: false }
  if (raw.endsWith('added')) return { status: 'added', staged }
  if (raw.endsWith('deleted')) return { status: 'deleted', staged }
  if (raw.endsWith('modified')) return { status: 'modified', staged }
  return { status: 'unmodified', staged }
}

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    // HEAD only resolves to an OID once a repo has its first commit, so a freshly `git init`ed
    // (but empty) repo must be detected via `.git`'s presence instead.
    await access(join(dir, '.git'))
    return true
  } catch {
    return false
  }
}

export async function initRepo(dir: string): Promise<void> {
  await git.init({ fs, dir })
}

export async function getStatus(dir: string): Promise<GitStatusSummary> {
  const branch = (await git.currentBranch({ fs, dir }).catch(() => null)) ?? null
  const matrix = await git.statusMatrix({ fs, dir })
  const changed = matrix.filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1))

  const files: GitFileStatus[] = []
  for (const [filepath] of changed) {
    const raw = await git.status({ fs, dir, filepath })
    if (raw === 'unmodified' || raw === 'ignored') continue
    const { status, staged } = toFriendlyStatus(raw)
    files.push({ path: filepath, status, staged })
  }

  return { branch, files, ahead: 0, behind: 0 }
}

export async function stageFile(dir: string, filepath: string): Promise<void> {
  await git.add({ fs, dir, filepath })
}

export async function unstageFile(dir: string, filepath: string): Promise<void> {
  await git.resetIndex({ fs, dir, filepath }).catch(() => git.remove({ fs, dir, filepath }))
}

export async function stageAll(dir: string): Promise<void> {
  const status = await getStatus(dir)
  for (const file of status.files) {
    if (file.status === 'deleted') await git.remove({ fs, dir, filepath: file.path })
    else await git.add({ fs, dir, filepath: file.path })
  }
}

export async function commit(dir: string, message: string, authorName: string, authorEmail: string): Promise<string> {
  return git.commit({ fs, dir, message, author: { name: authorName, email: authorEmail } })
}

export async function getLog(dir: string, depth = 30): Promise<GitCommitSummary[]> {
  const commits = await git.log({ fs, dir, depth })
  return commits.map((c) => ({
    oid: c.oid,
    message: c.commit.message,
    author: c.commit.author.name,
    timestamp: c.commit.author.timestamp * 1000
  }))
}

export async function diffFile(dir: string, filepath: string): Promise<string> {
  let oldContent = ''
  try {
    const headOid = await git.resolveRef({ fs, dir, ref: 'HEAD' })
    const { blob } = await git.readBlob({ fs, dir, oid: headOid, filepath })
    oldContent = Buffer.from(blob).toString('utf8')
  } catch {
    oldContent = ''
  }

  let newContent = ''
  try {
    newContent = await readFile(join(dir, filepath), 'utf8')
  } catch {
    newContent = ''
  }

  return createTwoFilesPatch(filepath, filepath, oldContent, newContent, 'HEAD', 'çalışma dizini')
}

export interface GitCredentials {
  username: string
  password: string
}

export async function pull(dir: string, authorName: string, authorEmail: string, credentials?: GitCredentials): Promise<void> {
  await git.pull({
    fs,
    http,
    dir,
    author: { name: authorName, email: authorEmail },
    onAuth: () => credentials ?? {}
  })
}

export async function push(dir: string, credentials?: GitCredentials): Promise<void> {
  await git.push({
    fs,
    http,
    dir,
    onAuth: () => credentials ?? {}
  })
}
