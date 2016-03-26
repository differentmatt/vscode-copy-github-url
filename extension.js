"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
let vscode = require('vscode');
let parseConfig = require('parse-git-config');
let gitBranch = require('git-branch');
let githubUrlFromGit = require('github-url-from-git');
let copyPaste = require("copy-paste");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('extension.gitHubUrl', () => {
    
    // The code you place here will be executed every time your command is executed
    try {
      let editor = vscode.window.activeTextEditor;
      if (!editor) {
        console.error('No open text editor');
        return;
      }
      let lineIndex = editor.selection.active.line + 1;
      let cwd = vscode.workspace.rootPath;
      let config = parseConfig.sync({cwd: cwd});
      let branch = gitBranch.sync(cwd)
      if (config['remote \"origin\"']) {
        let githubRootUrl = githubUrlFromGit(config['remote \"origin\"'].url);
        let subdir = editor.document.fileName.substring(cwd.length);
        let url = `${githubRootUrl}/blob/${branch}${subdir}#L${lineIndex}`
        copyPaste.copy(url);
      }
    }
    catch (e) {
      console.log(e);
      let errorMessage = "GitHub Copy URL extension failed to copy.  See debug console for details.";
      if (e.name && e.message) errorMessage = `(Copy GitHub URL) ${e.name}: ${e.message}`;
      vscode.window.showErrorMessage(errorMessage);
      return;
    }
  });
  context.subscriptions.push(disposable);
}
exports.activate = activate;
