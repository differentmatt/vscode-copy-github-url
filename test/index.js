process.env.NODE_ENV = 'test'

const path = require('path')
const Mocha = require('mocha')
const { globSync } = require('glob')

function run () {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  })

  const testsRoot = path.resolve(__dirname)

  return new Promise((resolve, reject) => {
    const files = globSync('**/**.test.js', { cwd: testsRoot }) // Only find tests in test directory

    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)))

    try {
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`))
        } else {
          resolve()
        }
      })
    } catch (err) {
      console.error(err)
      reject(err)
    }
  })
}

module.exports = {
  run
}
