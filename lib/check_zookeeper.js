'use restric'

const util = require('util')
const Zookeeper = require('zookeeper')
const logger = require('./logger')

function check_zookeeper (svc, callback) {
  var result = { checker: 'zookeeper', passed: false, info: [], errors: [], warnings: [] }
  logger.log('verbose', `[check_zookeeper] check_zookeeper(${svc.name})`)
  var host = svc.host || svc.name

  var port = svc.port || 2181
  var zkpr = new Zookeeper({
    connect: util.format('%s:%d', host, port),
    debug_level: Zookeeper.ZOO_LOG_LEVEL_WARN,
    timeout: 2000
  })
  zkpr.connect(function (err, client) {
    // console.log('zk.connect(%j)', err);
    if (err) {
      result.errors.push(err)
      result.passed = false
      callback(result)
      return
    }
    result.info.push(
      util.format('%s: zk session established, client_id=%s',
        svc.name, zkpr.client_id))
    zkpr.close()
    zkpr = null
    result.passed = true
    callback()
  })

  // The zookeeper node.js client will never finish or send any event
  // in the case of the server address or port number is invalid, so
  // to workaround that, I'm using a timeout to forcefully close the
  // client
  setTimeout(function closeZookeeprClient () {
    if (zkpr === null) {
      return
    }
    result.errors.push(util.format('%s: connect to Zookeepr timed out.', svc.name))
    zkpr.close()
    result.passed = false
    callback(result)
  }, 5000)
}

module.exports = check_zookeeper
