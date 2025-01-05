const assert = require('assert')
const sinon = require('sinon')
const vscode = require('vscode')
const { getVsCodeMock } = require('../helpers/mockFactory')
const { stubWorkspace, stubGitExtension } = require('../helpers/stubs')

// Tests GitHub URL generation
// - Path handling for Windows and Unix
// - Line number and selection ranges
// - Special character encoding
// - Multi-workspace support
suite('URL Generation', function () {
  let sandbox
  let extension
  let _main

  setup(async () => {
    sandbox = sinon.createSandbox()
    extension = await vscode.extensions.getExtension('mattlott.copy-github-url')
    _main = await extension.activate()
    _main.setTestEnvironment(true)
  })

  teardown(() => {
    sandbox.restore()
    _main.setTestEnvironment(false)
  })

  test('getGithubUrl should generate correct URL for Windows file paths', async function () {
    const pathSeparator = '\\'
    const projectDirectory = 'F:\\my\\workspace\\foo'
    const vsCodeMock = getVsCodeMock({
      startLine: 4,
      projectDirectory,
      filePath: 'subdir1\\subdir2\\myFileName.txt',
      sep: pathSeparator
    })
    stubWorkspace(sandbox, _main, projectDirectory, pathSeparator)
    stubGitExtension(sandbox, { projectDirectory })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor)
    assert.strictEqual(
      url,
      'https://github.com/foo/bar-baz/blob/test-branch/subdir1/subdir2/myFileName.txt#L5'
    )
  })

  test('getGithubUrl should handle Unix-style file paths', async function () {
    const projectDirectory = '/home/user/workspace/foo'
    const vsCodeMock = getVsCodeMock({
      startLine: 4,
      projectDirectory,
      filePath: 'subdir1/subdir2/myFileName.txt'
    })
    stubWorkspace(sandbox, _main, projectDirectory)
    stubGitExtension(sandbox, { projectDirectory })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor)
    assert.strictEqual(
      url,
      'https://github.com/foo/bar-baz/blob/test-branch/subdir1/subdir2/myFileName.txt#L5'
    )
  })

  test('getGithubUrl - windows path file directly in project dir', async function () {
    const pathSeparator = '\\'
    const projectDirectory = 'T:\\foo'
    const vsCodeMock = getVsCodeMock({
      startLine: 102,
      projectDirectory,
      filePath: 'bar.md',
      sep: pathSeparator
    })
    stubWorkspace(sandbox, _main, projectDirectory, pathSeparator)
    stubGitExtension(sandbox, { projectDirectory })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor)
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/test-branch/bar.md#L103', 'Invalid URL returned')
  })

  test('getGithubUrl should generate URL with current branch for single line selection', async function () {
    const pathSeparator = '\\'
    const projectDirectory = 'T:\\lorem'
    const vsCodeMock = getVsCodeMock({
      startLine: 0,
      endLine: 1,
      projectDirectory,
      filePath: 'ipsum.md',
      sep: pathSeparator
    })
    stubWorkspace(sandbox, _main, projectDirectory, pathSeparator)
    stubGitExtension(sandbox, { projectDirectory })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor)
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/test-branch/ipsum.md#L1-L2', 'Invalid URL returned')
  })

  test('getGithubUrl should handle multi-line selections', async function () {
    const pathSeparator = '\\'
    const projectDirectory = 'T:\\foo'
    const vsCodeMock = getVsCodeMock({
      startLine: 30,
      endLine: 40,
      projectDirectory,
      filePath: 'bar.md',
      sep: pathSeparator
    })
    stubWorkspace(sandbox, _main, projectDirectory, pathSeparator)
    stubGitExtension(sandbox, { projectDirectory })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor)
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/test-branch/bar.md#L31-L41', 'Invalid URL returned')
  })

  test('getGithubUrl should generate commit-specific URLs', async function () {
    const pathSeparator = '\\'
    const projectDirectory = 'T:\\lorem'
    const vsCodeMock = getVsCodeMock({
      startLine: 0,
      endLine: 1,
      projectDirectory,
      filePath: 'ipsum.md',
      sep: pathSeparator
    })
    stubWorkspace(sandbox, _main, projectDirectory, pathSeparator)
    stubGitExtension(sandbox, {
      commit: '75bf4eea9aa1a7fd6505d0d0aa43105feafa92ef',
      projectDirectory
    })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor, { perma: true })
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/75bf4eea9aa1a7fd6505d0d0aa43105feafa92ef/ipsum.md#L1-L2', 'Invalid URL returned')
  })

  test('getGithubUrl should generate URL for default branch', async function () {
    const pathSeparator = '\\'
    const projectDirectory = 'T:\\lorem'
    const vsCodeMock = getVsCodeMock({
      startLine: 0,
      endLine: 1,
      projectDirectory,
      filePath: 'ipsum.md',
      sep: pathSeparator
    })
    sandbox.stub(_main, 'getDefaultBranch').resolves('main')
    stubWorkspace(sandbox, _main, projectDirectory, pathSeparator)
    stubGitExtension(sandbox, { projectDirectory })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor, { default: true })
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/main/ipsum.md#L1-L2', 'Invalid URL returned')
  })

  test('getGithubUrl - same active.line as end.line', async function () {
    const pathSeparator = '\\'
    const projectDirectory = 'F:\\my\\workspace\\foo'
    const vsCodeMock = getVsCodeMock({
      startLine: 4,
      endLine: 4,
      projectDirectory,
      filePath: 'subdir1\\subdir2\\myFileName.txt',
      sep: pathSeparator
    })
    stubWorkspace(sandbox, _main, projectDirectory, pathSeparator)
    stubGitExtension(sandbox, {
      branch: 'test-branch',
      projectDirectory,
      repoUrl: 'https://github.com/foo/bar-baz.git'
    })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor)
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/test-branch/subdir1/subdir2/myFileName.txt#L5')
  })

  test('getGithubUrl - permalink for a file that contains symbols with / path separator', async function () {
    const projectDirectory = '/foo'
    const vsCodeMock = getVsCodeMock({
      startLine: 0,
      endLine: 1,
      projectDirectory,
      filePath: 'a !"#$%&\'()*+,-.:;<=>?@[\\]^`{|}~.md'
    })
    stubWorkspace(sandbox, _main, projectDirectory)
    stubGitExtension(sandbox, {
      commit: '75bf4eea9aa1a7fd6505d0d0aa43105feafa92ef',
      projectDirectory
    })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor, { perma: true })
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/75bf4eea9aa1a7fd6505d0d0aa43105feafa92ef/a%20!%22%23$%25&\'()*+,-.:;%3C=%3E%3F@%5B%5C%5D%5E%60%7B%7C%7D~.md#L1-L2', 'Invalid URL returned')
  })

  test('getGithubUrl - permalink for a file that contains symbols with \\ path separator', async function () {
    const pathSeparator = '\\'
    const projectDirectory = 'T:\\foo'
    const vsCodeMock = getVsCodeMock({
      startLine: 0,
      endLine: 1,
      projectDirectory,
      filePath: 'a !"#$%&\'()*+,-.:;<=>?@[\\]^`{|}~.md',
      sep: pathSeparator
    })
    stubWorkspace(sandbox, _main, projectDirectory, pathSeparator)
    stubGitExtension(sandbox, {
      commit: '75bf4eea9aa1a7fd6505d0d0aa43105feafa92ef',
      projectDirectory
    })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor, { perma: true })
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/75bf4eea9aa1a7fd6505d0d0aa43105feafa92ef/a%20!%22%23$%25&\'()*+,-.:;%3C=%3E%3F@%5B/%5D%5E%60%7B%7C%7D~.md#L1-L2', 'Invalid URL returned')
  })

  test('getGithubUrl should handle workspace with multiple folders', async function () {
    const projectDirectory = '/Users/mattlott/GitHub/workspace1/folder2'
    const vsCodeMock = getVsCodeMock({
      startLine: 10,
      projectDirectory,
      filePath: 'src/main.js',
      workspaceFolders: [
        { uri: { fsPath: '/Users/mattlott/GitHub/workspace1/folder1' } },
        { uri: { fsPath: '/Users/mattlott/GitHub/workspace1/folder2' } }
      ]
    })
    stubWorkspace(sandbox, _main, projectDirectory)
    stubGitExtension(sandbox, { projectDirectory })

    const url = await _main.getGithubUrl(vsCodeMock.window.activeTextEditor)
    assert.strictEqual(url, 'https://github.com/foo/bar-baz/blob/test-branch/src/main.js#L11')
  })

  test('getGithubUrlFromRemotes should parse remote URL correctly', async function () {
    const repository = {
      state: {
        HEAD: { name: 'main' },
        refs: [],
        remotes: [{ name: 'origin', fetchUrl: 'https://github.com/user/repo.git' }]
      }
    }
    const url = await _main.getGithubUrlFromRemotes(repository)
    assert.strictEqual(url, 'https://github.com/user/repo')
  })
})
