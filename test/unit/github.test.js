const assert = require('assert')
const sinon = require('sinon')
const vscode = require('vscode')
const { getVsCodeMock } = require('../helpers/mockFactory')
const { stubWorkspace, stubGitExtension } = require('../helpers/stubs')
const fs = require('fs')
const cp = require('child_process')

// Tests GitHub integration functionality
// - Repository discovery and configuration
// - Default branch detection and fallbacks
// - Remote URL parsing for various Git URL formats
// - Enterprise GitHub handling
suite('GitHub Integration', function () {
  let sandbox
  let extension
  let _main

  setup(async () => {
    sandbox = sinon.createSandbox()
    extension = await vscode.extensions.getExtension('mattlott.copy-github-url')
    await extension.activate()
    _main = extension.exports
    _main.setTestEnvironment(true)
  })

  teardown(() => {
    sandbox.restore()
    _main.setTestEnvironment(false)
  })

  test('getRepository should return the repository', async function () {
    const vsCodeMock = getVsCodeMock({
      projectDirectory: '/Users/user1/GitHub/project1',
      repoUrl: 'https://github.com/user/repo.git'
    })
    stubWorkspace(sandbox, _main, vsCodeMock.workspace.workspaceFolders[0].uri.fsPath)

    const repository = await _main.getRepository(vsCodeMock.extensions.getExtension().exports.getAPI(), vsCodeMock.window.activeTextEditor)
    assert.strictEqual(repository.state.remotes[0].fetchUrl, 'https://github.com/user/repo.git')
  })

  test('getGithubUrl should handle missing git extension', async function () {
    const vsCodeMock = getVsCodeMock({
      projectDirectory: '/test/path'
    })

    sandbox.stub(vscode.extensions, 'getExtension').returns(null)

    try {
      await _main.getGithubUrl(vsCodeMock.window.activeTextEditor)
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert(error.message.includes('Git extension not found'))
    }
  })

  test('getGithubUrl should handle missing repository remotes', async function () {
    this.timeout(10000)
    const clock = sandbox.useFakeTimers({
      shouldAdvanceTime: true,
      shouldClearNativeTimers: true
    })

    const vsCodeMock = getVsCodeMock({
      projectDirectory: '/test/path'
    })
    stubWorkspace(sandbox, _main)

    sandbox.stub(vscode.extensions, 'getExtension').returns({
      isActive: true,
      exports: {
        getAPI: () => ({
          repositories: [{
            rootUri: { fsPath: '/test/path' },
            state: {
              remotes: []
            }
          }],
          onDidOpenRepository: () => {
            return { dispose: () => {} }
          }
        })
      }
    })

    const urlPromise = _main.getGithubUrl(vsCodeMock.window.activeTextEditor)

    await clock.tickAsync(500 * 10)

    try {
      await urlPromise
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert(error.message.includes('Timeout waiting for repository'))
    } finally {
      clock.restore()
    }
  })

  test('getGithubUrlFromRemotes should handle SSH URLs', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [{ name: 'origin', fetchUrl: 'git@github.com:user/repo.git' }]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.com/user/repo')
  })

  test('getGithubUrlFromRemotes should handle git+https URLs', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [{ name: 'origin', fetchUrl: 'git+https://github.com/user/repo.git' }]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.com/user/repo')
  })

  test('getDefaultBranch should get default branch from git config', async function () {
    const mockConfig = `
[core]
  repositoryformatversion = 0
  filemode = true
[remote "origin"]
  url = https://github.com/user/repo.git
  fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
  remote = origin
  merge = refs/heads/main
[branch "develop"]
  remote = origin
  merge = refs/heads/develop
`
    sandbox.stub(fs.promises, 'readFile')
      .withArgs('/test/path/.git/config')
      .resolves(mockConfig)

    const repository = {
      rootUri: { fsPath: '/test/path' }
    }

    const branch = await _main.getDefaultBranch(repository)
    assert.strictEqual(branch, 'main')
  })

  test('getDefaultBranch should use git branch -r when git config fails', async function () {
    const clock = sandbox.useFakeTimers({
      shouldAdvanceTime: true,
      shouldClearNativeTimers: true
    })

    sandbox.stub(fs.promises, 'readFile').throws(new Error('ENOENT'))

    sandbox.stub(cp, 'exec')
      .withArgs('git branch -r', { cwd: '/test/path' })
      .callsFake((command, options, callback) => {
        callback(null, `
origin/HEAD -> origin/main
origin/develop
origin/main
origin/feature/123
      `)
      })

    const repository = {
      rootUri: { fsPath: '/test/path' }
    }

    const branchPromise = _main.getDefaultBranch(repository)
    await clock.tickAsync(500 * 3) // Advance through all retry attempts

    const branch = await branchPromise
    assert.strictEqual(branch, 'main')

    clock.restore()
  })

  test('getDefaultBranch should retry on temporary git branch -r failures', async function () {
    const clock = sandbox.useFakeTimers({
      shouldAdvanceTime: true,
      shouldClearNativeTimers: true
    })

    sandbox.stub(fs.promises, 'readFile').throws(new Error('ENOENT'))

    const execStub = sandbox.stub(cp, 'exec')
      .withArgs('git branch -r', { cwd: '/test/path' })

    // Fail twice, succeed on third try
    execStub.onFirstCall().callsFake((cmd, opts, cb) => cb(new Error('git index locked')))
    execStub.onSecondCall().callsFake((cmd, opts, cb) => cb(new Error('git index locked')))
    execStub.onThirdCall().callsFake((cmd, opts, cb) => cb(null, 'origin/HEAD -> origin/main'))

    const repository = {
      rootUri: { fsPath: '/test/path' }
    }

    const branchPromise = _main.getDefaultBranch(repository)
    await clock.tickAsync(500 * 3) // Advance through 3 retry attempts

    const branch = await branchPromise
    assert.strictEqual(branch, 'main')
    assert.strictEqual(execStub.callCount, 3)

    clock.restore()
  })

  test('getDefaultBranch should use fallback when git branch -r fails', async function () {
    const clock = sandbox.useFakeTimers({
      shouldAdvanceTime: true,
      shouldClearNativeTimers: true
    })

    sandbox.stub(fs.promises, 'readFile').throws(new Error('ENOENT'))

    sandbox.stub(cp, 'exec')
      .withArgs('git branch -r', { cwd: '/test/path' })
      .callsFake((command, options, callback) => callback(new Error('git command failed')))

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => key === 'defaultBranchFallback' ? 'main' : undefined
    })

    const repository = {
      rootUri: { fsPath: '/test/path' }
    }

    const branchPromise = _main.getDefaultBranch(repository)
    await clock.tickAsync(500 * 3) // Advance through retry attempts

    const branch = await branchPromise
    assert.strictEqual(branch, 'main')

    clock.restore()
  })

  test('getDefaultBranch should throw helpful error when no fallback configured', async function () {
    const clock = sandbox.useFakeTimers({
      shouldAdvanceTime: true,
      shouldClearNativeTimers: true
    })

    sandbox.stub(fs.promises, 'readFile').throws(new Error('ENOENT'))

    sandbox.stub(cp, 'exec')
      .withArgs('git branch -r', { cwd: '/test/path' })
      .callsFake((command, options, callback) => callback(new Error('git command failed')))

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined
    })

    const repository = {
      rootUri: { fsPath: '/test/path' }
    }

    const branchPromise = _main.getDefaultBranch(repository)
    await clock.tickAsync(500 * 3) // Advance through retry attempts

    try {
      await branchPromise
      assert.fail('Should have thrown')
    } catch (error) {
      assert(error.message.includes('Configure copyGithubUrl.defaultBranchFallback'))
    } finally {
      clock.restore()
    }
  })

  test('getGithubUrlFromRemotes should handle enterprise GitHub URLs', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [{ name: 'origin', fetchUrl: 'git@github.enterprise.com:user/repo.git' }]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => key === 'gitUrl' ? 'github.enterprise.com' : undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.enterprise.com/user/repo')
  })

  test('getGithubUrlFromRemotes should handle enterprise URLs without config', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [{ name: 'origin', fetchUrl: 'https://github.enterprise.com/user/repo.git' }]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.enterprise.com/user/repo')
  })

  test('getGithubUrlFromRemotes should handle arbitrary enterprise domains', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [{ name: 'origin', fetchUrl: 'git@git.company.com:user/repo.git' }]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => key === 'gitUrl' ? 'git.company.com' : undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://git.company.com/user/repo')
  })

  test('getGithubUrlFromRemotes should handle multiple remotes', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [
          { name: 'origin', fetchUrl: 'git@gitlab.com:user/repo.git' },
          { name: 'upstream', fetchUrl: 'git@git.internal.org:user/repo.git' }
        ]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => key === 'gitUrl' ? 'git.internal.org' : undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://git.internal.org/user/repo')
  })

  test('getGithubUrlFromRemotes should handle all Git URL formats', async function () {
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined
    })

    const testCases = [
      // HTTPS formats
      {
        input: 'https://github.com/user/repo.git',
        expected: 'https://github.com/user/repo'
      },
      {
        input: 'https://github.enterprise.com/user/repo.git',
        expected: 'https://github.enterprise.com/user/repo'
      },
      // Without .git suffix
      {
        input: 'https://github.com/user/repo',
        expected: 'https://github.com/user/repo'
      },
      {
        input: 'git@github.com:user/repo',
        expected: 'https://github.com/user/repo'
      },
      // SSH formats
      {
        input: 'git@github.com:user/repo.git',
        expected: 'https://github.com/user/repo'
      },
      {
        input: 'git@github.enterprise.com:user/repo.git',
        expected: 'https://github.enterprise.com/user/repo'
      },
      // Git+HTTPS protocol
      {
        input: 'git+https://github.com/user/repo.git',
        expected: 'https://github.com/user/repo'
      },
      {
        input: 'git+https://github.enterprise.com/user/repo.git',
        expected: 'https://github.enterprise.com/user/repo'
      },
      // Git+SSH protocol
      {
        input: 'git+ssh://git@github.com/user/repo.git',
        expected: 'https://github.com/user/repo'
      },
      {
        input: 'git+ssh://git@github.enterprise.com/user/repo.git',
        expected: 'https://github.enterprise.com/user/repo'
      },
      // With hash fragments (should be removed)
      {
        input: 'https://github.com/user/repo.git#main',
        expected: 'https://github.com/user/repo'
      },
      {
        input: 'git@github.com:user/repo.git#main',
        expected: 'https://github.com/user/repo'
      }
    ]

    await Promise.all(testCases.map(async ({ input, expected }) => {
      const repository = {
        state: {
          HEAD: { name: 'main' },
          refs: [],
          remotes: [{ name: 'origin', fetchUrl: input }]
        }
      }

      const url = await _main.getGithubUrlFromRemotes(repository)
      assert.strictEqual(url, expected, `Failed to handle URL format: ${input}`)
    }))
  })

  test('getGithubUrlFromRemotes should use branch-specific remote first', async function () {
    const repository = {
      state: {
        HEAD: { name: 'feature' },
        refs: [{ name: 'feature', remote: 'upstream' }],
        remotes: [
          { name: 'origin', fetchUrl: 'https://github.com/user1/repo.git' },
          { name: 'upstream', fetchUrl: 'https://github.com/user2/repo.git' }
        ]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.com/user2/repo')
  })

  test('getGithubUrlFromRemotes should handle enterprise URLs with both gitUrl and domain', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [
          { name: 'origin', fetchUrl: 'git@git.company.com:user/repo.git' }
        ]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => key === 'gitUrl' ? 'git.company.com' : undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://git.company.com/user/repo')
  })

  test('getGithubUrlFromRemotes should fallback to other remotes when branch remote not found', async function () {
    const repository = {
      state: {
        HEAD: { name: 'feature' },
        refs: [{ name: 'feature', remote: 'missing' }],
        remotes: [
          { name: 'origin', fetchUrl: 'https://github.com/user/repo.git' }
        ]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.com/user/repo')
  })

  test('getGithubUrlFromRemotes should handle enterprise URLs without github in domain', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [{ name: 'origin', fetchUrl: 'git@git.internal.acme.corp:user/repo.git' }]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => key === 'gitUrl' ? 'git.internal.acme.corp' : undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://git.internal.acme.corp/user/repo')
  })

  test('getRepository should use rootGitFolder configuration', async function () {
    const workspacePath = '/workspace/root'
    const gitPath = 'nested/git/repo'
    const fullGitPath = [workspacePath, gitPath].join('/')
    const vsCodeMock = getVsCodeMock({
      projectDirectory: workspacePath,
      filePath: gitPath + '/file.txt'
    })

    stubWorkspace(sandbox, _main, workspacePath)

    // Mock the configuration
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => {
        if (key === 'copyGithubUrl.rootGitFolder') return gitPath
        return undefined
      }
    })

    // Create repository with proper URI structure
    const repository = {
      rootUri: vscode.Uri.file(fullGitPath),
      state: {
        remotes: [
          { name: 'origin', fetchUrl: 'https://github.com/user/repo.git' }
        ]
      }
    }

    // Use stubGitExtension with custom options
    stubGitExtension(sandbox, {
      rootUri: repository.rootUri,
      repoUrl: repository.state.remotes[0].fetchUrl
    })

    const gitApi = {
      repositories: [repository],
      onDidOpenRepository: () => {
        return { dispose: () => {} }
      }
    }

    const result = await _main.getRepository(gitApi, vsCodeMock.window.activeTextEditor)
    assert.strictEqual(result, repository)
  })

  test('getGithubUrlFromRemotes should prioritize configured gitUrl', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [
          { name: 'origin', fetchUrl: 'https://github.com/user/repo.git' },
          { name: 'enterprise', fetchUrl: 'https://github.enterprise.com/user/repo.git' }
        ]
      }
    }

    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => key === 'gitUrl' ? 'github.enterprise.com' : undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.enterprise.com/user/repo')
  })

  test('getGithubUrlFromRemotes should auto-detect enterprise domains', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [{
          name: 'origin',
          fetchUrl: 'git@github.custom.internal:user/repo.git'
        }]
      }
    }

    // No gitUrl configuration
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined
    })

    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.custom.internal/user/repo')
  })

  test('getRepository should find correct repository for active document with multiple repos', async function () {
    const workspacePath = '/workspace/root'
    const repo1Path = '/workspace/root/project1'
    const repo2Path = '/workspace/root/project2'
    const activeFilePath = 'src/file.js'

    const vsCodeMock = getVsCodeMock({
      projectDirectory: repo2Path,
      filePath: activeFilePath
    })

    stubWorkspace(sandbox, _main, workspacePath)

    // Create two repositories
    const repo1 = {
      rootUri: vscode.Uri.file(repo1Path),
      state: {
        remotes: [{ name: 'origin', fetchUrl: 'https://github.com/user/repo1.git' }]
      }
    }

    const repo2 = {
      rootUri: vscode.Uri.file(repo2Path),
      state: {
        remotes: [{ name: 'origin', fetchUrl: 'https://github.com/user/repo2.git' }]
      }
    }

    const gitApi = {
      repositories: [repo1, repo2],
      onDidOpenRepository: () => ({ dispose: () => {} })
    }

    const result = await _main.getRepository(gitApi, vsCodeMock.window.activeTextEditor)
    assert.strictEqual(result, repo2, 'Should find repository containing active document')
  })

  test('getRepository should wait for repository to be discovered', async function () {
    const workspacePath = '/workspace/root'
    const activeFilePath = 'src/file.js'
    const vsCodeMock = getVsCodeMock({
      projectDirectory: workspacePath,
      filePath: activeFilePath
    })
    stubWorkspace(sandbox, _main, workspacePath)

    const clock = sandbox.useFakeTimers()

    const repo = {
      rootUri: vscode.Uri.file(workspacePath),
      state: {
        remotes: [{ name: 'origin', fetchUrl: 'https://github.com/foo/bar-baz.git' }]
      }
    }
    const gitApi = {
      repositories: [],
      onDidOpenRepository: (callback) => {
        setTimeout(() => callback(repo), 100)
        return { dispose: () => {} }
      }
    }

    const repoPromise = _main.getRepository(gitApi, vsCodeMock.window.activeTextEditor)
    await clock.tickAsync(100) // Advance time to trigger callback

    const result = await repoPromise
    assert.strictEqual(result, repo, 'Should find repository after delay')
  })

  test('getRepository should only use rootGitFolder as fallback', async function () {
    const workspacePath = '/workspace/root'
    const gitPath = 'nested/git/repo'
    const fullGitPath = [workspacePath, gitPath].join('/')
    const vsCodeMock = getVsCodeMock({
      projectDirectory: workspacePath,
      filePath: 'other/repo/file.txt' // File in a different repo
    })

    stubWorkspace(sandbox, _main, workspacePath)

    // Mock rootGitFolder configuration
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key) => {
        if (key === 'copyGithubUrl.rootGitFolder') return gitPath
        return undefined
      }
    })

    // Create two repositories
    const configuredRepo = {
      rootUri: vscode.Uri.file(fullGitPath),
      state: {
        remotes: [{ name: 'origin', fetchUrl: 'https://github.com/user/configured-repo.git' }]
      }
    }

    const activeRepo = {
      rootUri: vscode.Uri.file('/workspace/root/other/repo'),
      state: {
        remotes: [{ name: 'origin', fetchUrl: 'https://github.com/user/active-repo.git' }]
      }
    }

    const gitApi = {
      repositories: [configuredRepo, activeRepo],
      onDidOpenRepository: () => ({ dispose: () => {} })
    }

    const result = await _main.getRepository(gitApi, vsCodeMock.window.activeTextEditor)
    assert.strictEqual(result, activeRepo, 'Should use repository containing active document instead of rootGitFolder')
  })
})
