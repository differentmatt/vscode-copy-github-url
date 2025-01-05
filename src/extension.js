'use strict'

const vscode = require('vscode')
const main = require('./main')

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate (context) {
  const isTest = context.extensionMode === vscode.ExtensionMode.Test
  main.setTestEnvironment(isTest)

  // Function to handle errors
  const handleError = (e) => {
    console.error('GitHub URL Extension Error:', e)
    let errorMessage = 'Failed to copy GitHub URL. '

    if (e.message.includes('authentication')) {
      errorMessage += 'Please sign in to GitHub.'
    } else if (e.message.includes('remotes')) {
      errorMessage += 'No GitHub remote found in this repository.'
    } else if (e.name && e.message) {
      errorMessage += `${e.name}: ${e.message}`
    }

    vscode.window.showErrorMessage(errorMessage)
  }

  // Function to generate the command body
  const generateCommandBody = (config) => {
    return async () => {
      try {
        const url = await main.getGithubUrl(vscode.window.activeTextEditor, config)
        if (url) {
          await vscode.env.clipboard.writeText(url)
          vscode.window.showInformationMessage('GitHub URL copied to clipboard!')
        }
      } catch (e) {
        handleError(e)
      }
    }
  }

  // Register commands defined in package.json
  const disposable = vscode.commands.registerCommand('extension.gitHubUrl', generateCommandBody({}))
  const permaDisposable = vscode.commands.registerCommand('extension.gitHubUrlPerma', generateCommandBody({ perma: true }))
  const defaultDisposable = vscode.commands.registerCommand('extension.gitHubUrlDefault', generateCommandBody({ default: true }))

  // Add to a list of disposables which are disposed when this extension is deactivated.
  context.subscriptions.push(disposable)
  context.subscriptions.push(permaDisposable)
  context.subscriptions.push(defaultDisposable)

  return main
}

module.exports = { activate }
