'use strict'

const main = require('./main')
const path = require('path')
const { sanitizeErrorMessage } = require('./utils')
const vscode = require('vscode')
const TelemetryReporter = require('@vscode/extension-telemetry').default

const INSTRUMENTATION_KEY = process.env.INSTRUMENTATION_KEY || __INSTRUMENTATION_KEY__
function getBaseTelemetryData () {
  const relativePath = vscode.window.activeTextEditor?.document?.fileName?.split(path.sep).join('/') || 'unknown'
  const configSettings = vscode.workspace.getConfiguration('copyGithubUrl')
  return {
    hasCustomDefaultBranch: !!configSettings.get('defaultBranchFallback'),
    hasCustomGitUrl: !!configSettings.get('gitUrl'),
    hasCustomRootGitFolder: !!configSettings.get('rootGitFolder'),
    isWorkspaceRoot: vscode.workspace.workspaceFolders?.some(folder =>
      path.dirname(vscode.window.activeTextEditor?.document?.uri.fsPath) === folder.uri.fsPath),
    isMultiWorkspace: vscode.workspace.workspaceFolders?.length > 1,
    fileExtension: path.extname(relativePath || '') || 'none' // File type being shared
  }
}
let reporter

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate (context) {
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
        message: sanitizeErrorMessage(e.message),
        code: e.code, // Git errors often have codes
        errorStack: e.stack ? sanitizeErrorMessage(e.stack.split('\n')[0]) : undefined
      }
      // Clean undefined values
      Object.keys(telemetryData).forEach(key =>
        telemetryData[key] === undefined && delete telemetryData[key]
      )
      reporter?.sendTelemetryEvent('error', { ...getBaseTelemetryData(), ...telemetryData })
    } catch (e) {
      console.error('Error sending telemetry event:', e)
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
            const telemetryData = {
              urlType: config.perma ? 'permalink' : (config.default ? 'default' : 'current'),
              hasLineRange: url.includes('-L') // Single line vs range selection
            }
            reporter?.sendTelemetryEvent('url_copied', { ...getBaseTelemetryData(), ...telemetryData })
          } catch (e) {
            console.error('Error sending telemetry event:', e)
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
