// Git istemcisi — Rust `git_*` komutlarını çağırır (git2/libgit2).

import type {
  GitCommitSummaryDto,
  GitCredentialsDto,
  GitStatusSummaryDto
} from '@shared/ipc-contract'
import { invoke } from '@tauri-apps/api/core'

export function isGitRepo(dir: string): Promise<boolean> {
  return invoke<boolean>('git_is_repo', { dir })
}

export function initGitRepo(dir: string): Promise<void> {
  return invoke('git_init', { dir })
}

export function getGitStatus(dir: string): Promise<GitStatusSummaryDto> {
  return invoke<GitStatusSummaryDto>('git_status', { dir })
}

export function stageGitFile(dir: string, filepath: string): Promise<void> {
  return invoke('git_stage', { dir, filepath })
}

export function unstageGitFile(dir: string, filepath: string): Promise<void> {
  return invoke('git_unstage', { dir, filepath })
}

export function stageAllGitFiles(dir: string): Promise<void> {
  return invoke('git_stage_all', { dir })
}

export function commitGit(
  dir: string,
  message: string,
  authorName: string,
  authorEmail: string
): Promise<string> {
  return invoke<string>('git_commit', { dir, message, authorName, authorEmail })
}

export function getGitLog(dir: string, depth?: number): Promise<GitCommitSummaryDto[]> {
  return invoke<GitCommitSummaryDto[]>('git_log', { dir, depth })
}

export function diffGitFile(dir: string, filepath: string): Promise<string> {
  return invoke<string>('git_diff', { dir, filepath })
}

export function pullGit(
  dir: string,
  authorName: string,
  authorEmail: string,
  credentials?: GitCredentialsDto
): Promise<void> {
  return invoke('git_pull', { dir, authorName, authorEmail, credentials: credentials ?? null })
}

export function pushGit(dir: string, credentials?: GitCredentialsDto): Promise<void> {
  return invoke('git_push', { dir, credentials: credentials ?? null })
}
