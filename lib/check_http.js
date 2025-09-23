const http = require('http')
const https = require('https')
const logger = require('./logger')

function check (svc, callback) {
  const result = {
    checker: 'http', passed: false, info: [], warnings: [], errors: []
  }
  const options = {
    agent: false, // use one time agent to TLS cert checked every time.
    host: svc.host || svc.name,
    port: svc.port || 3000,
    path: svc.path || '/'
  }
  var client = http

  if (svc.protocol === 'https') {
    client = https
    options.checkServerIdentity = (servername, cert) => {
      if (servername !== cert.subject.CN) {
        result.warnings.push(`Server name (${servername}) != certificate name (${cert.subject.CN})`)
      }
      return undefined
    }
    if (svc.allowSelfSigned === true) {
      options.rejectUnauthorized = false
      result.warnings.push('Self Signed Certifate allowed.')
    }
  }

  logger.log('verbose', `Making HTTP connection to (${options.host}:${options.port})...`)

  var req = client.request(options, (response) => {
    let body = ''
    response.on('data', function (chunk) {
      body += chunk
    })

    response.on('end', function () {
      try {
        let statusCode = response.statusCode
        if (('' + statusCode).match(/^2\d\d$/)) {
          result.info.push('HTTP Body: ' + body)
          result.passed = true
        } else {
          result.errors.push('Response Code: ' + response.statusCode + 'HTTP Body: ' + body)
          result.passed = false
        }
      } catch (err) {
        result.errors.push(err)
        result.passed = false
      }
      callback(result)
    })
  })

  req.on('error', function (err) {
    result.errors.push(err)
    result.passed = false
    callback(result)
  })

  req.end()
}

module.exports = check
