const path = require('path')
const { runTests } = require('@vscode/test-electron')

async function main () {
  try {
    process.env.NODE_ENV = 'test'
    const extensionDevelopmentPath = path.resolve(__dirname, '../')
    const extensionTestsPath = path.resolve(__dirname, './index')
    const launchArgs = ['--disable-extensions']

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs
    })
  } catch (err) {
    console.error('Failed to run tests:', err)
    process.exit(1)
  }
}

main()
