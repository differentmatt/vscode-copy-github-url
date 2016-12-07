"use strict";

let vscode = require('vscode');
let parseConfig = require('parse-git-config');
let gitBranch = require('git-branch');
let githubUrlFromGit = require('github-url-from-git');

module.exports = {
  /**
   * Returns a GitHub URL to the currently selected line in VSCode instance.
   *
   * @param mixed vscode
   * @returns String/null Returns an URL or `null` if could not be determined.
   */
  getGithubUrl: function( vscode ) {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.error('No open text editor');
      return;
    }
    let lineIndex = editor.selection.active.line + 1;
    let cwd = vscode.workspace.rootPath;
    let config = parseConfig.sync({cwd: cwd});
    let branch = gitBranch.sync(cwd);
    let remoteConfig = config[`branch "${branch}"`];
    let remoteName = remoteConfig && remoteConfig.remote ? remoteConfig.remote : 'origin';

    if (config[`remote "${remoteName}"`]) {
      let githubRootUrl = githubUrlFromGit(config[`remote "${remoteName}"`].url);
      let subdir = editor.document.fileName.substring(cwd.length);
      let url = `${githubRootUrl}/blob/${branch}${subdir}#L${lineIndex}`;
      url = url.replace(/\\/g, '/'); // Flip subdir slashes on Windows
      return url;
    } else {
      return null;
    }
  }
};