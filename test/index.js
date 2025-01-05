process.env.NODE_ENV = 'test'

const path = require('path')
const Mocha = require('mocha')
const { glob } = require('glob')

function run () {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  })

  const testsRoot = path.resolve(__dirname)

  return new Promise(async (resolve, reject) => {
    try {
      const files = await glob('**/**.test.js', { cwd: testsRoot })
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)))

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
