'use restric';

//
// The pure node-zookeeper-client version of zookeeper checkers
//

const util = require('util');
const zookeeper = require('node-zookeeper-client');
const logger = require('./logger');

function check_zookeeper(svc, callback) {
  logger.log('verbose', `[check_zk] check_zookeeper('${svc.name}')`);
  var result = {checker: 'zookeeper', passed: false, info:[], errors:[], warnings:[]};
  var host = svc.host || svc.name,
      port = svc.port || 2181,
      server = util.format('%s:%d', host, port);

  var client = zookeeper.createClient(server);

  client.once('connected', function(){
    var session_id = client.getSessionId()
    logger.log('verbose', `connected to Zookeeper server: ${server}`);
    // make sure timeout won't close this client
    let tmpClient = client;
    client = null;
    tmpClient.close();
    result.info.push(
      util.format('%s: zk session established, id=%s',
                  server, session_id.toString('hex')));
    result.passed = true;
    callback(result);
  });

  client.connect();

  // The zookeeper node.js client will never finish or send any event
  // in the case of the server address or port number is invalid, so
  // to workaround that, I'm using a timeout to forcefully close the
  // client
  setTimeout(function closeZookeeprClient() {
    if (client === null) {
      return;
    }
    result.errors.push(util.format('%s: connect to Zookeeper timed out.', svc.name));
    client.close();
    result.passed = false;
    callback(result);
  }, 5000);
}

module.exports = check_zookeeper;
