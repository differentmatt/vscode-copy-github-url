'use strict'

const gitBranch = require('git-branch')
const githubUrlFromGit = require('github-url-from-git')
const gitRevSync = require('git-rev-sync')
const parseConfig = require('parse-git-config')
const path = require('path')
module.exports = {
  /**
   * Returns a GitHub URL to the currently selected line in VSCode instance.
   *
   * @param {mixed} vscode
   * @param {Boolean} [permalink=false] Should it be permalink? If `true` it will link to current revision hash
   * rather than branch.
   * @returns {String/null} Returns an URL or `null` if could not be determined.
   */
  getGithubUrl: function (vscode, config = {}) {
    const editor = vscode.window.activeTextEditor
    const selection = editor.selection
    if (!editor) {
      console.error('No open text editor')
      return null
    }

    let lineQuery = 'L' + (selection.start.line + 1)

    if (!selection.isSingleLine) {
      // Selection might be spanned across multiple lines.
      lineQuery += ('-L' + (selection.end.line + 1))
    }

    const cwd = vscode.workspace.rootPath
    const gitInfo = this._getGitInfo(vscode, config.perma)
    const subdir = editor.document.fileName.substring(cwd.length)
    const branch = config.master ? 'master' : config.perma && gitInfo.hash ? gitInfo.hash : gitInfo.branch

    let url = `${gitInfo.githubUrl}/blob/${branch}${subdir}#${lineQuery}`
    url = url.replace(/\\/g, '/') // Flip subdir slashes on Windows
    return url
  },

  /**
   * Returns git repo information object for given `vscode` instance.
   *
   * @private
   * @param {mixed} vscode
   * @param {Boolean} [includeHash=false]
   * @returns {Object} return
   * @returns {String} return.branch Current branch name.
   * @returns {String} return.remote Currently set upstream, will fallback to 'origin' if none set.
   * @returns {String} return.url URL to a Git repository.
   * @returns {String} return.githubUrl URL to a GitHub page for given repository.
   * @returns {String} [return.hash] A hash for the current repository. This property is available only if `includeHash` was set to `true`.
   */
  _getGitInfo: function (vscode, includeHash) {
    let cwd = vscode.workspace.rootPath;
    let config = parseConfig.sync({ cwd: cwd });
    
    const vscodeConfig = vscode.workspace.getConfiguration('copyGithubUrl');
    const gitUrl = vscodeConfig.get('gitUrl');

    if (!config) {
      const rootGitFolder = vscodeConfig.get('rootGitFolder');

      if (rootGitFolder) {
        cwd = path.resolve(vscode.workspace.rootPath, rootGitFolder)
        config = parseConfig.sync({ cwd: cwd })
      }
    }
    const branch = gitBranch.sync(cwd)
    const remoteConfig = config[`branch "${branch}"`]
    const remoteName = remoteConfig && remoteConfig.remote ? remoteConfig.remote : 'origin'

    if (!config[`remote "${remoteName}"`]) {
      throw new Error(`Could not fetch information about "${remoteName}" remote.`)
    }

    return {
      branch: branch,
      remote: remoteName,
      url: config[`remote "${remoteName}"`].url, // An URL to git repository itself.
      githubUrl: githubUrlFromGit(config[`remote "${remoteName}"`].url, gitUrl && {extraBaseUrls: [gitUrl]}), // An URL to the GitHub page for given repository.
      // Include hash only on demand as it might be a costy operation.
      hash: includeHash ? gitRevSync.short(cwd) : null
    }
  }
}
