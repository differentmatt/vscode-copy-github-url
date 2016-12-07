"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
let vscode = require('vscode');
let main = require('./src/main');
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
      copyPaste.copy(main.getGithubUrl(vscode));
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
