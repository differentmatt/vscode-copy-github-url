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

  return glob('**/**.test.js', { cwd: testsRoot })
    .then(files => {
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)))

      return new Promise((resolve, reject) => {
        mocha.run(failures => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`))
          } else {
            resolve()
          }
        })
      })
    })
    .catch(err => {
      console.error(err)
      throw err
    })
}

module.exports = {
  run
}
