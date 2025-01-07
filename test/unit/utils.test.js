const assert = require('assert')
const { sanitizeErrorMessage } = require('../../src/utils')

suite('Utils', function () {
  test('should sanitize file paths', function () {
    const error = 'Error reading file /home/user/secret/file.txt'
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Error reading file <file>file.txt')
  })

  test('should sanitize Windows file paths', function () {
    const error = 'Failed to access C:\\Users\\john\\Documents\\secret.pdf'
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Failed to access <file>secret.pdf')
  })

  test('should sanitize email addresses', function () {
    const error = 'Invalid user: john.doe@company.com'
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Invalid user: <email>')
  })

  test('should sanitize URLs with query parameters', function () {
    const error = 'Failed to fetch https://api.github.com/repos/user/repo?token=secret123'
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Failed to fetch https:/<file>repo?token=<redacted>')
  })

  test('should sanitize IP addresses', function () {
    const error = 'Connection failed to 192.168.1.1 and 2001:0db8:85a3:0000:0000:8a2e:0370:7334'
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Connection failed to <ip> and <ip>')
  })

  test('should sanitize API keys and tokens', function () {
    const error = 'API failed: api_key=abcd1234 and auth_token="xyz789"'
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'API failed: api_key=<redacted> and auth_token=<redacted>')
  })

  test('should sanitize UUIDs', function () {
    const error = 'Resource not found: 550e8400-e29b-41d4-a716-446655440000'
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Resource not found: <uuid>')
  })

  test('should sanitize base64 strings', function () {
    const base64Data = Buffer.from('some binary data \x00\x01\x02', 'binary').toString('base64')
    const error = `Encoded data: ${base64Data}`
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Encoded data: <base64>')
  })

  test('should not sanitize regular text that looks like base64', function () {
    const error = 'Regular text: TWFueSBoYW5kcw==' // "Many hands" in base64
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Regular text: TWFueSBoYW5kcw==')
  })

  test('should handle Error objects', function () {
    const error = new Error('Failed to access C:\\Users\\john\\secret.txt')
    const sanitized = sanitizeErrorMessage(error)
    assert.strictEqual(sanitized, 'Failed to access <file>secret.txt')
  })

  test('should truncate long messages', function () {
    const error = 'This is a very long error message! '.repeat(50) // Non-base64 pattern
    const sanitized = sanitizeErrorMessage(error)
    assert.ok(sanitized.length <= 503, 'Message should be truncated to 500 chars + ...')
    assert.ok(sanitized.endsWith('...'), 'Truncated message should end with ...')
  })
})
