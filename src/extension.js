'use strict'

const vscode = require('vscode')
const main = require('./main')
const TelemetryReporter = require('@vscode/extension-telemetry').default
const path = require('path')

const INSTRUMENTATION_KEY = process.env.INSTRUMENTATION_KEY || __INSTRUMENTATION_KEY__
let reporter

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate (context) {
  const isDevelopment = context.extensionMode === vscode.ExtensionMode.Development
  const isTest = context.extensionMode === vscode.ExtensionMode.Test
  main.setTestEnvironment(isTest)

  if (!isTest && INSTRUMENTATION_KEY !== '__INSTRUMENTATION_KEY__') {
    reporter = new TelemetryReporter(INSTRUMENTATION_KEY)
    context.subscriptions.push(reporter)
  }

  // Function to handle errors
  const handleError = (e) => {
    console.error('GitHub URL Extension Error:', e)

    try {
      // Extract useful error properties
      const telemetryData = {
        name: e.name,
        message: e.message,
        code: e.code, // Git errors often have codes
        errorStack: e.stack?.split('\n')[0],
        command: e.command, // For Git command failures
        stderr: e.stderr, // For Git command output
        path: e.path // For file system errors
      }
      // Clean undefined values
      Object.keys(telemetryData).forEach(key =>
        telemetryData[key] === undefined && delete telemetryData[key]
      )
      reporter?.sendTelemetryEvent('error', telemetryData)
    } catch (e) {
      if (isDevelopment) console.error('Error sending telemetry event:', e)
    }

    let errorMessage = 'Failed to copy GitHub URL. '
    if (e.message.includes('remotes')) {
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

          try {
            const relativePath = vscode.window.activeTextEditor?.document?.fileName?.split(path.sep).join('/') || 'unknown'
            const telemetryData = {
              urlType: config.perma ? 'permalink' : (config.default ? 'default' : 'current'),
              hasLineRange: url.includes('-L'), // Single line vs range selection
              hasCustomDefaultBranch: !!vscode.workspace.getConfiguration('copyGithubUrl').get('defaultBranchFallback'),
              hasCustomGitUrl: !!vscode.workspace.getConfiguration('copyGithubUrl').get('gitUrl'),
              hasCustomRootGitFolder: !!vscode.workspace.getConfiguration('copyGithubUrl').get('rootGitFolder'),
              pathDepth: relativePath.split('/').length, // How deep in repo structure
              isWorkspaceRoot: relativePath.split('/').length === 1, // File at root level
              fileExtension: path.extname(relativePath || '') || 'none', // File type being shared
              isMultiWorkspace: vscode.workspace.workspaceFolders?.length > 1
            }
            reporter?.sendTelemetryEvent('url_copied', telemetryData)
          } catch (e) {
            if (isDevelopment) console.error('Error sending telemetry event:', e)
          }

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
