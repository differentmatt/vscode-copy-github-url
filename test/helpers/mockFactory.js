const { createGitApi } = require('./gitApiFactory')

/**
 * A helper function to return a vscode object imitation.
 *
 * @param {Object} [options]
 * @param {String} [options.accessToken] Mock authentication token
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
 * @param {Boolean} [options.isNonTextFile] If true, simulates a non-text file like an image
 * @returns {Object} An `vscode` alike object
 */
function getVsCodeMock (options) {
  if (!options.projectDirectory) throw new Error('projectDirectory is required for getVsCodeMock. Please provide an absolute path to the project directory.')
  const projectRoot = options.projectDirectory
  const fullPath = options.filePath
    ? [projectRoot, options.filePath].join(options.sep || '/')
    : [projectRoot, 'subdir1', 'subdir2', 'myFileName.txt'].join(options.sep || '/')

  const startLine = options.startLine !== undefined ? options.startLine : 1
  const endLine = options.endLine !== undefined ? options.endLine : startLine

  const editorMock = options.isNonTextFile
    ? null
    : {
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

  // For non-text files, we'll add activeEditorPane
  const activeEditorPane = options.isNonTextFile
    ? {
        input: {
          uri: {
            fsPath: fullPath
          }
        }
      }
    : undefined

  // Setup Tab Groups for non-text files
  const tabGroups = options.isNonTextFile
    ? {
        activeTabGroup: {
          activeTab: {
            label: options.filePath.split('/').pop(),
            input: {
              uri: {
                fsPath: fullPath,
                toString: () => `file://${fullPath}`
              }
            }
          },
          tabs: [{
            label: options.filePath.split('/').pop(),
            input: {
              uri: {
                fsPath: fullPath,
                toString: () => `file://${fullPath}`
              }
            }
          }]
        }
      }
    : undefined

  return {
    workspace: {
      workspaceFolders: options.workspaceFolders || [{ uri: { fsPath: projectRoot } }]
    },
    Uri: {
      file: (path) => ({ fsPath: path }),
      parse: (uriString) => ({ fsPath: uriString })
    },
    window: {
      activeTextEditor: editorMock,
      activeEditorPane,
      visibleTextEditors: [],
      tabGroups
    },
    extensions: {
      getExtension: (extensionId) => {
        if (extensionId !== 'vscode.git') {
          return undefined
        }
        return {
          exports: {
            getAPI: () => createGitApi(options)
          }
        }
      }
    }
  }
}

module.exports = { getVsCodeMock }
