'use strict';

const clipboardy = require('clipboardy');
const vscode = require('vscode');

const main = require('./src/main');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
  let generateCommandBody = (config) => {
    return () => {// The code you place here will be executed every time your command is executed
      try {
        let url = main.getGithubUrl(vscode, config);

        if (url) {
          clipboardy.writeSync(url);
        }
      }
      catch (e) {
        console.log(e);
        let errorMessage = 'GitHub Copy URL extension failed to copy. See debug console for details.';
        if (e.name && e.message) errorMessage = `(Copy GitHub URL) ${e.name}: ${e.message}`;
        vscode.window.showErrorMessage(errorMessage);
        return;
      }
    }
  };

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('extension.gitHubUrl', generateCommandBody());
  let permaDisposable = vscode.commands.registerCommand('extension.gitHubUrlPerma', generateCommandBody({perma:true}));
  let masterDisposable = vscode.commands.registerCommand('extension.gitHubUrlMaster', generateCommandBody({perma:true, master:true}));

  // Add to a list of disposables which are disposed when this extension is deactivated.
  context.subscriptions.push(disposable);
  context.subscriptions.push(permaDisposable);
}
exports.activate = activate;
