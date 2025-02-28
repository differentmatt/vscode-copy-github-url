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
    hasActiveTextEditor: !!vscode.window.activeTextEditor // Whether file is opened in a text editor
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

  /**
   * Helper function to get the URI of the active file using multiple VS Code APIs
   *
   * @returns {Object} Object containing editor and/or fileUri
   */
  const getActiveFileInfo = () => {
    // Method 1: Check primary active text editor first
    if (vscode.window.activeTextEditor) {
      return { editor: vscode.window.activeTextEditor, fileUri: null }
    }

    // Method 2: Check other visible text editors
    const visibleEditor = vscode.window.visibleTextEditors.find(e => e.visibleRanges.length > 0)
    if (visibleEditor) {
      return { editor: visibleEditor, fileUri: null }
    }

    // Method 3: Check activeEditorPane API for non-text files
    if (vscode.window.activeEditorPane?.input?.uri) {
      return { editor: null, fileUri: vscode.window.activeEditorPane.input.uri }
    }

    // Method 4: Use Tab Groups API for non-text files (VS Code 1.46+)
    if (vscode.window.tabGroups?.activeTabGroup?.activeTab?.input?.uri) {
      return { editor: null, fileUri: vscode.window.tabGroups.activeTabGroup.activeTab.input.uri }
    }

    // No active file found - return without logging any potentially sensitive paths
    return { editor: null, fileUri: null }
  }

  // Function to generate the command body
  const generateCommandBody = (config) => {
    return async () => {
      try {
        // Get info about the active file
        const { editor, fileUri } = getActiveFileInfo()
        let url

        if (editor) {
          // Handle text files with line numbers
          url = await main.getGithubUrl(editor, config)
        } else if (fileUri) {
          // Handle non-text files without line numbers
          url = await main.getGithubUrl(null, config, fileUri)
        } else {
          // If no file found, log debug info and throw error
          const debugInfo = {
            hasActiveEditorPane: !!vscode.window.activeEditorPane,
            hasInput: !!vscode.window.activeEditorPane?.input,
            hasTabGroups: !!vscode.window.tabGroups,
            hasActiveTabGroup: !!vscode.window.tabGroups?.activeTabGroup,
            hasActiveTab: !!vscode.window.tabGroups?.activeTabGroup?.activeTab,
            activeTabName: vscode.window.tabGroups?.activeTabGroup?.activeTab?.label || null
          }

          console.error('No active file found. Debug info:', debugInfo)
          throw new Error('No active file found')
        }

        if (url) {
          await vscode.env.clipboard.writeText(url)

          try {
            const telemetryData = {
              urlType: config.perma ? 'permalink' : (config.default ? 'default' : 'current'),
              hasLineRange: url.includes('-L'), // Single line vs range selection
              hasActiveTextEditor: !!editor // Whether from text editor or other editor type
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
          // Include full path information for local debugging
          info.uri = vscode.window.tabGroups.activeTabGroup.activeTab.input.uri.toString()
          info.fsPath = vscode.window.tabGroups.activeTabGroup.activeTab.input.uri.fsPath
        }
      }

      // Log detailed debug info to local console
      console.log('Debug info:', JSON.stringify(info, null, 2))
      vscode.window.showInformationMessage('Debug info logged to console. Check Developer Tools to view.')

      // Show complete debug info in the notification for easier troubleshooting
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
