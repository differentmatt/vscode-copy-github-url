"use strict";

let vscode = require('vscode');
let parseConfig = require('parse-git-config');
let gitBranch = require('git-branch');
let githubUrlFromGit = require('github-url-from-git');

module.exports = {
  /**
   * Returns a GitHub URL to the currently selected line in VSCode instance.
   *
   * @param {mixed} vscode
   * @returns {String/null} Returns an URL or `null` if could not be determined.
   */
  getGithubUrl: function( vscode ) {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.error('No open text editor');
      return null;
    }
    let lineIndex = editor.selection.active.line + 1;
    let cwd = vscode.workspace.rootPath;
    let gitInfo = this._getGitInfo( vscode );
    let subdir = editor.document.fileName.substring(cwd.length);

    let url = `${gitInfo.githubUrl}/blob/${gitInfo.branch}${subdir}#L${lineIndex}`;
    url = url.replace(/\\/g, '/'); // Flip subdir slashes on Windows
    return url;
  },

  /**
   * Returns git repo information object for given `vscode` instance.
   *
   * @private
   * @param {mixed} vscode
   * @returns {Object} return
   * @returns {String} return.branch Current branch name.
   * @returns {String} return.remote Currently set upstream, will fallback to 'origin' if none set.
   * @returns {String} return.url URL to a Git repository.
   * @returns {String} return.githubUrl URL to a GitHub page for given repository.
   */
  _getGitInfo: function( vscode ) {
    let cwd = vscode.workspace.rootPath;
    let config = parseConfig.sync({cwd: cwd});
    let branch = gitBranch.sync(cwd);
    let remoteConfig = config[`branch "${branch}"`];
    let remoteName = remoteConfig && remoteConfig.remote ? remoteConfig.remote : 'origin';

    if ( !config[`remote "${remoteName}"`] ) {
      throw new Error( `Could not fetch information about "${remoteName}" remote.` );
    }

    return {
      branch: branch,
      remote: remoteName,
      url: config[`remote "${remoteName}"`].url, // An URL to git repository itself.
      githubUrl: githubUrlFromGit(config[`remote "${remoteName}"`].url) // An URL to the GitHub page for given repository.
    };
  }
};