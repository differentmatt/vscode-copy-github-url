const { createGitApi } = require('./gitApiFactory')

/**
 * A helper function to return a vscode object imitation.
 *
 * @param {Object} [options]
 * @param {String} [options.branch] Branch name
 * @param {String} [options.commit] Commit hash
 * @param {Number} [options.endLine] Line number where the current selection ends
 * @param {String} [options.filePath] File path **relative to** `projectDirectory`
 * @param {String} [options.gitRoot] Root URI for the Git repository
 * @param {String} [options.projectDirectory] Absolute path to the project directory
 * @param {String} [options.repoUrl] Repository URL
 * @param {String} [options.sep] Separator to use for the path
 * @param {Number} [options.startLine] Current, focused line number
 * @param {Array} [options.workspaceFolders] Array of workspace folders
 * @returns {Object} An `vscode` alike object
 */
function getVsCodeMock (options) {
  const projectRoot = options.projectDirectory
  const fullPath = options.filePath
    ? [projectRoot, options.filePath].join(options.sep || '/')
    : [projectRoot, 'subdir1', 'subdir2', 'myFileName.txt'].join(options.sep || '/')

  const startLine = options.startLine !== undefined ? options.startLine : 1
  const endLine = options.endLine !== undefined ? options.endLine : startLine

  const editorMock = {
    selection: {
      active: { line: startLine },
      start: { line: startLine },
      end: { line: endLine },
      isSingleLine: startLine === endLine
    },
    document: {
      uri: { fsPath: fullPath }
    }
  }

  return {
    workspace: {
      workspaceFolders: options.workspaceFolders || [{ uri: { fsPath: projectRoot } }]
    },
    window: { activeTextEditor: editorMock },
    extensions: {
      getExtension: () => ({
        exports: {
          getAPI: () => createGitApi(options)
        }
      })
    },
    authentication: {
      getSession: async () => ({ accessToken: 'fake-token' })
    }
  }
}

module.exports = { getVsCodeMock }
