'use strict'

const main = require('./main')
const path = require('path')

const vscode = require('vscode')
const TelemetryReporter = require('@vscode/extension-telemetry').default

const INSTRUMENTATION_KEY = process.env.INSTRUMENTATION_KEY || __INSTRUMENTATION_KEY__
const relativePath = vscode.window.activeTextEditor?.document?.fileName?.split(path.sep).join('/') || 'unknown'
const configSettings = vscode.workspace.getConfiguration('copyGithubUrl')
const baseTelemetryData = {
  hasCustomDefaultBranch: !!configSettings.get('defaultBranchFallback'),
  hasCustomGitUrl: !!configSettings.get('gitUrl'),
  hasCustomRootGitFolder: !!configSettings.get('rootGitFolder'),
  isWorkspaceRoot: vscode.workspace.workspaceFolders?.some(folder =>
    path.dirname(vscode.window.activeTextEditor?.document?.uri.fsPath) === folder.uri.fsPath),
  isMultiWorkspace: vscode.workspace.workspaceFolders?.length > 1,
  fileExtension: path.extname(relativePath || '') || 'none' // File type being shared
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
        errorStack: e.stack?.split('\n')[0]
      }
      // Clean undefined values
      Object.keys(telemetryData).forEach(key =>
        telemetryData[key] === undefined && delete telemetryData[key]
      )
      reporter?.sendTelemetryEvent('error', { ...baseTelemetryData, ...telemetryData })
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
            reporter?.sendTelemetryEvent('url_copied', { ...baseTelemetryData, ...telemetryData })
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

/**
 * Sanitizes error messages by removing potentially sensitive information
 * @param {string|Error} error - Error object or message to sanitize
 * @returns {string} Sanitized error message
 */
function sanitizeErrorMessage (error) {
  // Convert error to string if it's an Error object
  let message = error instanceof Error ? error.message : String(error)

  // Sanitize common patterns that might contain sensitive data
  const sanitizationRules = [
    // File paths - replace with basename
    {
      pattern: /(?:\/[\w\-.]+)+\/[\w\-./]+/g,
      replacement: (match) => `<file>${match.split('/').pop()}`
    },
    // Windows file paths
    {
      pattern: /(?:[A-Za-z]:\\[\w\-\\]+\\[\w\-.\\]+)/g,
      replacement: (match) => `<file>${match.split('\\').pop()}`
    },
    // Email addresses
    {
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      replacement: '<email>'
    },
    // URLs with potential query parameters
    {
      pattern: /(https?:\/\/[^\s<>"]+?)(?:\?[^\s<>"]+)?/g,
      replacement: (match, url) => {
        try {
          const parsedUrl = new URL(url)
          return `${parsedUrl.protocol}//${parsedUrl.hostname}<path>`
        } catch {
          return '<url>'
        }
      }
    },
    // IP addresses (both IPv4 and IPv6)
    {
      pattern: /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g,
      replacement: '<ip>'
    },
    {
      pattern: /(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}/g,
      replacement: '<ip>'
    },
    // API keys, tokens, and other credentials
    {
      pattern: /(?:api[_-]?key|token|key|secret|password|pwd|auth)[:=]\s*['"]?\w+['"]?/gi,
      replacement: (match) => `${match.split(/[:=]\s*/)[0]}=<redacted>`
    },
    // UUIDs
    {
      pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      replacement: '<uuid>'
    },
    // Base64 strings (potential credentials or personal data)
    {
      pattern: /(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g,
      replacement: (match) => {
        // Only replace if it's likely a real base64 string (length > 20)
        return match.length > 20 ? '<base64>' : match
      }
    }
  ]

  // Apply each sanitization rule
  sanitizationRules.forEach(({ pattern, replacement }) => {
    const replaceFunction = typeof replacement === 'function' ? replacement : () => replacement
    message = message.replace(pattern, replaceFunction)
  })

  // Remove any remaining special characters or whitespace sequences
  message = message
    .replace(/\s+/g, ' ')
    .trim()

  // Truncate if too long (e.g., 500 characters)
  const MAX_LENGTH = 500
  if (message.length > MAX_LENGTH) {
    message = message.substring(0, MAX_LENGTH) + '...'
  }

  return message
}

module.exports = { activate }
