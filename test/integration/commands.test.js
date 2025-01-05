const assert = require('assert')
const sinon = require('sinon')
const vscode = require('vscode')
const { getVsCodeMock } = require('../helpers/mockFactory')
const { stubWorkspace, stubGitExtension } = require('../helpers/stubs')

// Tests VSCode command registration and execution
// - Verifies command registration
// - Tests command execution with different parameters
// - Handles error cases for commands
suite('Extension Commands', function () {
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

  test('extension.gitHubUrl should copy current branch URL to clipboard', async function () {
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

    // Stub the active editor
    sandbox.stub(vscode.window, 'activeTextEditor').value(vsCodeMock.window.activeTextEditor)

    // Stub the clipboard
    const writeTextStub = sandbox.stub().resolves()
    sandbox.stub(vscode.env, 'clipboard').value({
      writeText: writeTextStub
    })

    // Execute the actual command
    await vscode.commands.executeCommand('extension.gitHubUrl')

    assert(writeTextStub.calledOnce, 'Clipboard should be called once')
    assert.strictEqual(
      writeTextStub.firstCall.args[0],
      'https://github.com/foo/bar-baz/blob/test-branch/subdir1/subdir2/myFileName.txt#L5'
    )
  })

  test('extension.gitHubUrlPerma should copy commit-specific URL to clipboard', async function () {
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
      branch: 'test-branch',
      commit: '75bf4eea9aa1a7fd6505d0d0aa43105feafa92ef',
      projectDirectory
    })

    // Stub the active editor
    sandbox.stub(vscode.window, 'activeTextEditor').value(vsCodeMock.window.activeTextEditor)

    // Stub the clipboard
    const writeTextStub = sandbox.stub().resolves()
    sandbox.stub(vscode.env, 'clipboard').value({
      writeText: writeTextStub
    })

    // Execute the actual command
    await vscode.commands.executeCommand('extension.gitHubUrlPerma')

    assert(writeTextStub.calledOnce, 'Clipboard should be called once')
    assert.strictEqual(
      writeTextStub.firstCall.args[0],
      'https://github.com/foo/bar-baz/blob/75bf4eea9aa1a7fd6505d0d0aa43105feafa92ef/ipsum.md#L1-L2'
    )
  })

  test('extension.gitHubUrlDefault should copy default branch URL to clipboard', async function () {
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
      branch: 'test-branch',
      projectDirectory
    })
    sandbox.stub(_main, 'getDefaultBranch').resolves('main')

    // Stub the active editor
    sandbox.stub(vscode.window, 'activeTextEditor').value(vsCodeMock.window.activeTextEditor)

    // Stub the clipboard
    const writeTextStub = sandbox.stub().resolves()
    sandbox.stub(vscode.env, 'clipboard').value({
      writeText: writeTextStub
    })

    // Execute the actual command
    await vscode.commands.executeCommand('extension.gitHubUrlDefault')

    assert(writeTextStub.calledOnce, 'Clipboard should be called once')
    assert.strictEqual(
      writeTextStub.firstCall.args[0],
      'https://github.com/foo/bar-baz/blob/main/ipsum.md#L1-L2'
    )
  })
})
