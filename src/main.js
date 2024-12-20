'use strict'

const gitBranch = require('git-branch')
const gitDefaultBranch = require('default-branch')
const githubUrlFromGit = require('github-url-from-git')
const gitRevSync = require('git-rev-sync')
const parseConfig = require('parse-git-config')
const path = require('path')
module.exports = {
  /**
   * Returns a GitHub URL to the currently selected line in VSCode instance.
   *
   * @param {Object} vscode
   * @param {Object} [config={}]
   * @returns {Promise<string|null>} Returns an URL or `null` if could not be determined.
   */
  getGithubUrl: async function (vscode, config = {}) {
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

    const vscodeConfig = this._getVscodeConfig(vscode)
    const cwd = this._getCwd(vscode, editor);
    const gitConfig = this._getGitConfig(cwd, vscode, vscodeConfig)
    const gitInfo = this._getGitInfo(cwd, vscodeConfig, gitConfig)

    const branch = config.default ? await this._getDefaultBranch(gitInfo.githubUrl, vscodeConfig) : config.perma ? this._getGitLongHash(cwd) : gitInfo.branch

    const subdir = editor.document.fileName.substring(cwd.length)

    let pathSeparator = config.pathSeparator || path.sep;

    // If the file contains symbols, we need to encode by using encodeURI function.
    // Additionally `#` and `?` in the pathname should be replaced with `%23` and `%3F` respectively.
    const subdirEncoded = subdir.split(pathSeparator).map((p) => encodeURI(p).replace('#', '%23').replace('?', '%3F')).join('/')
    let url = `${gitInfo.githubUrl}/blob/${branch}${subdirEncoded}#${lineQuery}`;
    return url
  },

   _getVscodeConfig: (vscode) => vscode.workspace.getConfiguration('copyGithubUrl'),
   _getCwd: (vscode, editor) => vscode.workspace.getWorkspaceFolder(editor.document.uri).uri.path,

  /**
   * Returns git config and cwd for given vscode and vscode config
   *
   * @private
   * @param {Object} vscode
   * @param {Object} vscodeConfig
   * @returns {Object} return
   * @returns {Object} return.cwd
   * @returns {Object} return.gitConfig
  */
  _getGitConfig: function (cwd, vscode, vscodeConfig) {
    let gitConfig = parseConfig.sync({ cwd: cwd, path: '.git/config' })

    if (Object.keys(gitConfig || {}).length === 0) {
      const rootGitFolder = vscodeConfig.get('rootGitFolder')

      if (rootGitFolder) {
        cwd = path.resolve(cwd, rootGitFolder)
        gitConfig = parseConfig.sync({ cwd: cwd })
      }
    }
    return gitConfig
  },

  /**
   * Returns git repo information object for given vscode and git configs.
   *
   * @private
   * @param {String} cwd
   * @param {Object} vscodeConfig
   * @param {Object} gitConfig
   * @returns {{
   *   branch: String,  // Current branch name
   *   remote: String,  // Currently set upstream, will fallback to 'origin' if none set
   *   url: String,     // URL to a Git repository
   *   githubUrl: String // URL to a GitHub page for given repository
   * }}
   */
  _getGitInfo: function (cwd, vscodeConfig, gitConfig) {
    const gitUrl = vscodeConfig.get('gitUrl')

    const branch = gitBranch.sync(cwd)
    const remoteConfig = gitConfig[`branch "${branch}"`]
    const remoteName = remoteConfig && remoteConfig.remote ? remoteConfig.remote : 'origin'

    if (!gitConfig[`remote "${remoteName}"`]) {
      throw new Error(`Could not fetch information about "${remoteName}" remote.`)
    }

    const githubUrl = githubUrlFromGit(gitConfig[`remote "${remoteName}"`].url, gitUrl && {extraBaseUrls: [gitUrl]})

    return {
      branch: branch,
      remote: remoteName,
      url: gitConfig[`remote "${remoteName}"`].url, // An URL to git repository itself.
      githubUrl: githubUrl // An URL to the GitHub page for given repository.
    }
  },

  /**
   * Returns default branch for githubURL. Does not work for private repos, falls back to 'main'.
   *
   * @private
   * @param {String} githubUrl
   * @param {Object} vscodeConfig
   * @returns {Promise<string>}
   */
   _getDefaultBranch: async function (githubUrl, vscodeConfig) {
      try {
        return await gitDefaultBranch(githubUrl)
      } catch (e) {
        // Maybe private repo, use configured value or GitHub default
        const defaultBranch = vscodeConfig.get('defaultBranchFallback')
        if (defaultBranch) return defaultBranch
        return 'main'
      }
   },

  _getGitLongHash: (cwd) => gitRevSync.long(cwd)
}
