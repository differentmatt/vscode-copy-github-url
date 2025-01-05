const vscode = require('vscode')
const { createGitApi } = require('./gitApiFactory')

/**
 * Stubs VSCode's Git extension with test data
 * @param {sinon.SinonSandbox} sandbox Sinon sandbox
 * @param {Object} options Git configuration options
 */
function stubGitExtension (sandbox, options = {}) {
  return sandbox.stub(vscode.extensions, 'getExtension').returns({
    id: 'git',
    extensionUri: vscode.Uri.file('/'),
    extensionPath: '/',
    isActive: true,
    packageJSON: {},
    extensionKind: vscode.ExtensionKind.Workspace,
    activate: () => Promise.resolve(),
    exports: {
      getAPI: () => createGitApi(options)
    }
  })
}

/**
 * Stubs VSCode's workspace functionality for testing
 * @param {sinon.SinonSandbox} sandbox Sinon sandbox
 * @param {Object} main Extension's main module
 * @param {string} workspacePath Root path of the workspace
 * @param {string} pathSeparator Path separator to use ('/' or '\\')
 */
function stubWorkspace (sandbox, main, workspacePath = '/test/workspace', pathSeparator = '/') {
  const workspaceUri = typeof workspacePath === 'string'
    ? vscode.Uri.file(workspacePath)
    : workspacePath

  // Ensure we have a valid fsPath
  if (!workspaceUri?.fsPath) {
    throw new Error('Invalid workspace path')
  }

  // Stub workspace folders with static value
  sandbox.stub(vscode.workspace, 'workspaceFolders').value([{
    uri: workspaceUri,
    name: 'workspace',
    index: 0
  }])

  const pathRelativeStub = sandbox.stub(main.path, 'relative')
    .callsFake((from, to) => {
      const fromStr = from.toString()
      const toStr = to.toString()
      const normalizedFrom = fromStr.split(pathSeparator).join('/').toLowerCase()
      const normalizedTo = toStr.split(pathSeparator).join('/').toLowerCase()

      if (normalizedTo.startsWith(normalizedFrom + '/')) {
        return toStr.split(pathSeparator).join('/').slice(fromStr.split(pathSeparator).join('/').length + 1)
      }
      return toStr.split(pathSeparator).join('/')
    })

  // Stub path normalization for GitHub URLs
  const normalizePathStub = sandbox.stub(main, 'normalizePathForGitHub')
    .callsFake((inputPath) => {
      return (typeof inputPath === 'string' ? inputPath : inputPath.toString()).split(pathSeparator)
        .map((p) => encodeURI(p).replace('#', '%23').replace('?', '%3F'))
        .join('/')
    })

  const getWorkspaceFolderStub = sandbox.stub(vscode.workspace, 'getWorkspaceFolder')
    .callsFake(() => {
      return {
        uri: workspaceUri,
        name: 'workspace',
        index: 0
      }
    })

  return {
    pathRelativeStub,
    normalizePath: normalizePathStub,
    getWorkspaceFolder: getWorkspaceFolderStub
  }
}

module.exports = {
  stubGitExtension,
  stubWorkspace
}
