const dns = require('dns')
const util = require('util')
const logger = require('./logger')

function check (svc, callback) {
  const name = svc.host || svc.name
  const result = {
    checker: 'dns',
    passed: false,
    info: [],
    errors: [],
    warnings: [],
    metrics: {}
  }

  logger.log('verbose', `[dns] dns.lookup('${name}')`)
  // dns.resolve(svc.name, (err, address) => {
  dns.lookup(name, (err, address) => {
    if (err) {
      result.address = err.code
      result.errors.push(err)
      result.metrics['DNS resovled'] = 0
      logger.error(`[dns] Error resolving DNS : ${name} ${err}`)
    } else {
      result.address = address
      result.info.push(util.format('dns.lookup(%s) => %j', name, address))
      result.metrics['DNS resovled'] = 1
      result.passed = true
    }
    callback(result)
  })
}

module.exports = check
