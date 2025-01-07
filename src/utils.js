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
      pattern: /(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})/g,
      replacement: (match) => {
        try {
          // Only attempt base64 decode if it matches base64 pattern
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(match)) {
            return match
          }

          // Try decoding and check if result contains non-printable characters
          const decoded = Buffer.from(match, 'base64').toString('binary')
          // eslint-disable-next-line no-control-regex
          const hasNonPrintable = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(decoded)

          return (match.length > 20 && hasNonPrintable) ? '<base64>' : match
        } catch {
          return match
        }
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

module.exports = { sanitizeErrorMessage }
