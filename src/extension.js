'use strict'

const main = require('./main')
const path = require('path')
const { sanitizeErrorMessage } = require('./utils')
const vscode = require('vscode')
const TelemetryReporter = require('@vscode/extension-telemetry').default

const INSTRUMENTATION_KEY = process.env.INSTRUMENTATION_KEY || __INSTRUMENTATION_KEY__
function getBaseTelemetryData () {
  // Try to get the file path from either text editor or active editor pane
  let filePath = vscode.window.activeTextEditor?.document?.fileName

  // If no text editor is active, try to get the file path from various VS Code APIs (for non-text files)
  if (!filePath) {
    // Try activeEditorPane first
    if (vscode.window.activeEditorPane?.input?.uri) {
      filePath = vscode.window.activeEditorPane.input.uri.fsPath
    } else if (vscode.window.tabGroups?.activeTabGroup?.activeTab?.input?.uri) {
      // If that fails, try Tab Groups API (VS Code 1.46+)
      filePath = vscode.window.tabGroups.activeTabGroup.activeTab.input.uri.fsPath
    }
  }

  const relativePath = filePath ? filePath.split(path.sep).join('/') : 'unknown'
  const configSettings = vscode.workspace.getConfiguration('copyGithubUrl')

  // Determine if file is in workspace root
  let isWorkspaceRoot = false
  if (filePath) {
    const fileDir = path.dirname(filePath)
    isWorkspaceRoot = vscode.workspace.workspaceFolders?.some(folder => fileDir === folder.uri.fsPath) || false
  }

  return {
    hasCustomDefaultBranch: !!configSettings.get('defaultBranchFallback'),
    hasCustomGitUrl: !!configSettings.get('gitUrl'),
    hasCustomDomainOverride: !!configSettings.get('domainOverride'),
    hasCustomRootGitFolder: !!configSettings.get('rootGitFolder'),
    isWorkspaceRoot,
    isMultiWorkspace: vscode.workspace.workspaceFolders?.length > 1,
    fileExtension: path.extname(relativePath || '') || 'none', // File type being shared
    isTextFile: !!vscode.window.activeTextEditor // Whether it's a text file (with editor) or not
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
        // Get the active editor or active file in the explorer
        const activeTextEditor = vscode.window.activeTextEditor
        let url

        if (activeTextEditor) {
          // Handle text files with line numbers
          url = await main.getGithubUrl(activeTextEditor, config)
        } else {
          // Handle non-text files without line numbers
          // Try multiple VS Code APIs to find the active file
          let fileUri = null

          // Method 1: Check visible text editors
          const activeEditor = vscode.window.visibleTextEditors.find(e => e.visibleRanges.length > 0)
          if (activeEditor) {
            // Use the visible editor
            url = await main.getGithubUrl(activeEditor, config)

          // Method 2: Check activeEditorPane.input.uri (works for some non-text files)
          } else if (vscode.window.activeEditorPane?.input?.uri) {
            fileUri = vscode.window.activeEditorPane.input.uri

          // Method 3: Use Tab Groups API (for VS Code 1.46+, most reliable for non-text files)
          } else if (vscode.window.tabGroups?.activeTabGroup?.activeTab?.input?.uri) {
            fileUri = vscode.window.tabGroups.activeTabGroup.activeTab.input.uri
          }

          // If we found a URI through method 2 or 3, use it
          if (fileUri) {
            url = await main.getGithubUrl(null, config, fileUri)
          } else {
            console.error('No active file found. Debug info:', {
              hasActiveEditorPane: !!vscode.window.activeEditorPane,
              hasInput: !!vscode.window.activeEditorPane?.input,
              hasTabGroups: !!vscode.window.tabGroups,
              hasActiveTabGroup: !!vscode.window.tabGroups?.activeTabGroup,
              hasActiveTab: !!vscode.window.tabGroups?.activeTabGroup?.activeTab,
              activeTabName: vscode.window.tabGroups?.activeTabGroup?.activeTab?.label || null
            })
            throw new Error('No active file found')
          }
        }

        if (url) {
          await vscode.env.clipboard.writeText(url)

          try {
            const telemetryData = {
              urlType: config.perma ? 'permalink' : (config.default ? 'default' : 'current'),
              hasLineRange: url.includes('-L'), // Single line vs range selection
              isTextFile: !!activeTextEditor
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

  // Diagnostic command to help debug non-text file handling
  const debugDisposable = vscode.commands.registerCommand('extension.gitHubUrlDebug', async () => {
    try {
      const info = {
        activeTextEditor: !!vscode.window.activeTextEditor,
        activeEditorPane: !!vscode.window.activeEditorPane,
        activeEditorPane_input: !!vscode.window.activeEditorPane?.input,
        activeEditorPane_uri: !!vscode.window.activeEditorPane?.input?.uri,
        activeNotebookEditor: !!vscode.window.activeNotebookEditor,
        visibleTextEditors: vscode.window.visibleTextEditors.length,
        tabGroups: vscode.window.tabGroups?.activeTabGroup?.tabs?.length || 0,
        activeTab: vscode.window.tabGroups?.activeTabGroup?.activeTab?.label || null,
        activeTabInput: !!vscode.window.tabGroups?.activeTabGroup?.activeTab?.input
      }

      // Try to get resource URI from tabs API (VSCode 1.46+)
      if (vscode.window.tabGroups?.activeTabGroup?.activeTab?.input) {
        info.activeTabInputUri = !!vscode.window.tabGroups.activeTabGroup.activeTab.input.uri
        if (vscode.window.tabGroups.activeTabGroup.activeTab.input.uri) {
          info.uri = vscode.window.tabGroups.activeTabGroup.activeTab.input.uri.toString()
          info.fsPath = vscode.window.tabGroups.activeTabGroup.activeTab.input.uri.fsPath
        }
      }

      console.log('Debug info:', JSON.stringify(info, null, 2))
      vscode.window.showInformationMessage('Debug info logged to console. See Developer Tools.')

      // Show in notification for easy viewing
      await vscode.window.showInformationMessage(JSON.stringify(info, null, 2))
    } catch (e) {
      console.error('Error in debug command:', e)
      vscode.window.showErrorMessage('Error in debug command: ' + e.message)
    }
  })

  // Add to a list of disposables which are disposed when this extension is deactivated.
  context.subscriptions.push(disposable)
  context.subscriptions.push(permaDisposable)
  context.subscriptions.push(defaultDisposable)
  context.subscriptions.push(debugDisposable)

  return main
}

module.exports = { activate }
