'use strict'

const githubUrlFromGit = require('github-url-from-git')
const path = require('path')
const vscode = require('vscode')
const fs = require('fs').promises
const cp = require('child_process')

let isTestEnvironment = false
function setTestEnvironment (isTest) {
  isTestEnvironment = isTest
}

/**
 * Returns a GitHub URL to the currently selected line or range in VSCode instance.
 *
 * @param {Object} editor
 * @param {Object} [type={}]
 * @returns {Promise<string|null>} Returns an URL or `null` if could not be determined.
 */
async function getGithubUrl (editor, type = {}) {
  try {
    const { document, selection } = editor
    const gitExtension = vscode.extensions.getExtension('vscode.git')
    if (!gitExtension) throw new Error('Git extension not found')
    if (!gitExtension.isActive) await gitExtension.activate()

    // Uses vscode.git extension to get repository, does not use .git/config
    const repository = await getRepository(gitExtension.exports.getAPI(1), editor)

    // Uses repository rootUri to get relative path for document
    let relativePath = path.relative(repository.rootUri.fsPath, document.uri.fsPath)
    relativePath = module.exports.normalizePathForGitHub(relativePath)

    const lineRef = `L${selection.start.line + 1}${selection.isSingleLine ? '' : `-L${selection.end.line + 1}`}`

    // Uses repository to find the remote fetchUrl and then uses githubUrlFromGit to generate the URL
    const githubUrl = await getGithubUrlFromRemotes(repository)

    // Uses repository to get location of .git/config, checks for main or master
    // Fallback: uses repository to get root path, and runs git branch -r to get the branch name via origin/HEAD
    // Fallback: user configured default branch
    const getBranch = async () => {
      if (type.perma) return repository.state.HEAD.commit
      return type.default
        ? await module.exports.getDefaultBranch(repository)
        : repository.state.HEAD?.name || 'main'
    }
    const branch = await getBranch()
    return `${githubUrl}/blob/${branch}/${relativePath}#${lineRef}`
  } catch (error) {
    if (!isTestEnvironment) console.error('Failed to get GitHub URL:', error)
    throw error
  }
}

/**
 * Returns the default branch name for the given repository.
 * GitHub API would be more authoritative, but we assume local git info is accurate enough.
 *
 * @param {Object} repository - The repository object.
 * @returns {Promise<string>} The default branch name.
 */
async function getDefaultBranch (repository) {
  try {
    // 1. Try reading .git config
    try {
      const configPath = path.join(repository.rootUri.fsPath, '.git', 'config')
      const gitConfig = await fs.readFile(configPath, 'utf8')
      if (gitConfig.toLowerCase().includes('[branch "main"]'.toLowerCase())) return 'main'
      if (gitConfig.toLowerCase().includes('[branch "master"]'.toLowerCase())) return 'master'
    } catch (error) {
      if (!isTestEnvironment) console.error('Failed to read git config:', error)
    }

    // 2. Try git branch -r
    try {
      let attempts = 0
      while (attempts < 3) { // Fewer retries since this is less common
        try {
          const defaultBranch = await new Promise((resolve, reject) => {
            cp.exec('git branch -r', { cwd: repository.rootUri.fsPath }, (err, stdout) => {
              if (err) {
                reject(err)
                return
              }

              // Get list of branches, removing any whitespace/empty lines
              const branches = stdout.split('\n').map(b => b.trim()).filter(Boolean)

              // Look for HEAD pointer first as it's the most reliable indicator
              const headPointer = branches.find(b => b.startsWith('origin/HEAD'))
              if (headPointer) {
                const match = headPointer.match(/origin\/HEAD -> origin\/(.+)/)
                if (match) {
                  resolve(match[1])
                  return
                }
              }

              // Fallback to other branch detection methods
              if (branches.length === 1) {
                resolve(branches[0].replace('origin/', ''))
              } else if (branches.some(b => b.toLowerCase() === 'origin/main')) {
                resolve('main')
              } else if (branches.some(b => b.toLowerCase() === 'origin/master')) {
                resolve('master')
              } else {
                resolve(undefined)
              }
            })
          })
          if (defaultBranch) return defaultBranch
        } catch (error) {
          if (attempts === 2) throw error // Re-throw on final attempt
        } finally {
          await new Promise(resolve => setTimeout(resolve, 500))
          attempts++
        }
      }
    } catch (error) {
      if (!isTestEnvironment) console.error('Failed to run git branch -r:', error)
    }

    // 3. Try user configuration
    const extensionConfig = vscode.workspace.getConfiguration('copyGithubUrl')
    const defaultBranchFallback = extensionConfig.get('defaultBranchFallback')
    if (defaultBranchFallback) return defaultBranchFallback

    throw new Error('Could not determine default branch. Configure copyGithubUrl.defaultBranchFallback in settings.')
  } catch (error) {
    if (error.message.includes('Configure copyGithubUrl.defaultBranchFallback')) throw error
    throw new Error(`Failed to get default branch: ${error.message}`)
  }
}

/**
 * Returns a GitHub URL from the given remotes.
 * @param {Object} repository - The repository object to search for a GitHub URL.
 * @returns {Promise<string>} The GitHub URL.
 */
async function getGithubUrlFromRemotes (repository) {
  const config = vscode.workspace.getConfiguration('copyGithubUrl')
  const gitUrl = config.get('gitUrl')
  const remotes = repository.state.remotes

  // Try to get the remote for the current branch first
  const currentBranch = repository.state.HEAD?.name
  if (currentBranch) {
    const branchConfig = repository.state.refs.find(ref =>
      ref.name === currentBranch && ref.remote
    )
    if (branchConfig) {
      const remote = remotes.find(r => r.name === branchConfig.remote)
      if (remote) {
        // Always include both gitUrl and remote domain as extraBaseUrls
        const domain = remote.fetchUrl.match(/(?:https?:\/\/|git@)([^:/]+)/)?.[1]
        return Promise.resolve(githubUrlFromGit(remote.fetchUrl, {
          extraBaseUrls: [gitUrl, domain].filter(Boolean)
        }))
      }
    }
  }

  // If gitUrl is configured, look for that specific domain next
  if (gitUrl) {
    const enterpriseRemote = remotes.find(r => r.fetchUrl.toLowerCase().includes(gitUrl.toLowerCase()))
    if (enterpriseRemote) {
      return Promise.resolve(githubUrlFromGit(enterpriseRemote.fetchUrl, { extraBaseUrls: [gitUrl] }))
    }
  }

  // Try each remote
  for (const remote of remotes) {
    try {
      const domain = remote.fetchUrl.match(/(?:https?:\/\/|git@)([^:/]+)/)?.[1]
      if (!domain) continue

      const url = githubUrlFromGit(remote.fetchUrl, { extraBaseUrls: [gitUrl, domain].filter(Boolean) })
      if (url) return Promise.resolve(url)
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      continue // Try next remote if this one fails
    }
  }

  throw new Error('No Git remote found')
}

/**
 * Normalizes a path for GitHub URL.
 *
 * @param {string} inputPath - The input path to normalize.
 * @param {string} [pathSeparator=path.sep] - The path separator to use.
 * @returns {string} The normalized path.
 */
function normalizePathForGitHub (inputPath, pathSeparator = path.sep) {
  return inputPath.split(pathSeparator).map((p) => encodeURI(p).replace('#', '%23').replace('?', '%3F')).join('/')
}

/**
 * Retrieves the repository from the Git API.
 *
 * @param {Object} git - The Git API instance.
 * @param {Object} editor - The editor object.
 * @returns {Promise<Object>} The repository object.
 */
async function getRepository (git, editor) {
  const activeDoc = editor?.document
  if (!activeDoc) {
    throw new Error('No active document found. Open a file to use GitHub URL features.')
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeDoc.uri)
  if (!workspaceFolder) {
    throw new Error('Active document is not in a workspace folder.')
  }

  // First try to find repository containing the active document
  let repository = git.repositories.find(repo =>
    activeDoc.uri.fsPath.toLowerCase().startsWith(repo.rootUri.fsPath.toLowerCase())
  )

  // If no repository found, try rootGitFolder configuration as fallback
  if (!repository) {
    const config = vscode.workspace.getConfiguration('copyGithubUrl')
    const rootGitFolder = config.get('rootGitFolder')

    if (rootGitFolder) {
      const fullPath = path.resolve(workspaceFolder.uri.fsPath, rootGitFolder)
      repository = git.repositories.find(repo =>
        repo.rootUri.fsPath.toLowerCase() === fullPath.toLowerCase() ||
        repo.rootUri.fsPath.toLowerCase().startsWith(fullPath.toLowerCase())
      )
    }
  }

  // If still no repository, wait for one to be discovered
  if (!repository) {
    repository = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose()
        reject(new Error('Timeout waiting for Git repository'))
      }, 5000)

      const disposable = git.onDidOpenRepository(repo => {
        if (activeDoc.uri.fsPath.toLowerCase().startsWith(repo.rootUri.fsPath.toLowerCase())) {
          clearTimeout(timeout)
          disposable.dispose()
          resolve(repo)
        }
      })
    })
  }

  // Wait for remotes to populate
  let attempts = 0
  while (attempts < 10) {
    if (repository.state.remotes && repository.state.remotes.length > 0) {
      return repository
    }
    await new Promise(resolve => setTimeout(resolve, 500))
    attempts++
  }

  throw new Error('Timeout waiting for repository remotes to populate')
}

module.exports = {
  getDefaultBranch,
  getGithubUrl,
  getGithubUrlFromRemotes,
  getRepository,
  normalizePathForGitHub,
  setTestEnvironment,
  path
}
