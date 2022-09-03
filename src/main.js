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
   * @param {mixed} vscode
   * @param {Boolean} [permalink=false] Should it be permalink? If `true` it will link to current revision hash
   * rather than branch.
   * @returns {String/null} Returns an URL or `null` if could not be determined.
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
    const {cwd, gitConfig} = this._getGitConfig(vscode, vscodeConfig)
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

  /**
   * Returns git config and cwd for given vscode and vscode config
   *
   * @private
   * @param {mixed} vscode
   * @param {Object} vscodeConfig
   * @returns {Object} return
   * @returns {Object} return.cwd
   * @returns {Object} return.gitConfig
  */
   _getGitConfig: function (vscode, vscodeConfig) {
    let cwd = vscode.workspace.rootPath
    let gitConfig = parseConfig.sync({ cwd: cwd, path: '.git/config' })

    if (Object.keys(gitConfig || {}).length === 0) {
      const rootGitFolder = vscodeConfig.get('rootGitFolder')

      if (rootGitFolder) {
        cwd = path.resolve(vscode.workspace.rootPath, rootGitFolder)
        gitConfig = parseConfig.sync({ cwd: cwd })
      }
    }
    return {cwd, gitConfig}
  },

  /**
   * Returns git repo information object for given vscode and git configs.
   *
   * @private
   * @param {String} cwd
   * @param {Object} vscodeConfig
   * @param {Object} gitConfig
   * @returns {Object} return
   * @returns {String} return.branch Current branch name.
   * @returns {String} return.remote Currently set upstream, will fallback to 'origin' if none set.
   * @returns {String} return.url URL to a Git repository.
   * @returns {String} return.githubUrl URL to a GitHub page for given repository.
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
   * @returns {String}
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
