const vscode = require('vscode')

/**
 * Creates a Git API object for testing.
 *
 * @param {Object} [options]
 * @param {String} [options.branch] Branch name
 * @param {String} [options.commit] Commit hash
 * @param {String} [options.projectDirectory] Project root directory
 * @param {String} [options.repoUrl] Repository URL
 * @param {vscode.Uri} [options.rootUri] Root URI for the Git repository
 * @param {Array} [options.repositories] Array of repositories
 * @param {Function} [options.onDidOpenRepository] Custom repository discovery handler
 * @returns {Object} A Git API object
 */
function createGitApi (options = {}) {
  const repository = {
    rootUri: options.rootUri || vscode.Uri.file(options.projectDirectory || '/test/path'),
    state: {
      HEAD: {
        commit: options.commit || '123456',
        name: options.branch || 'test-branch'
      },
      refs: [],
      remotes: [{
        name: 'origin',
        fetchUrl: options.repoUrl || 'https://github.com/foo/bar-baz.git'
      }]
    }
  }

  return {
    repositories: options.repositories || [repository],
    onDidOpenRepository: options.onDidOpenRepository || (() => ({ dispose: () => {} }))
  }
}

module.exports = { createGitApi }
